import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../db';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { logAudit } from '../services/audit';
import { deleteFile, getPresignedDownloadUrl } from '../services/storage';
import { buildFhirBundle } from '../services/fhir';

const router = Router();

// Apply auth protection and user synchronization to all profile endpoints
router.use(requireAuth);
router.use(getOrCreateUser);

/** Strip the encrypted key from API responses; expose only key presence + provider. */
function formatProfile(p: typeof patientProfiles.$inferSelect) {
  const { encryptedApiKey, ...rest } = p;
  return { ...rest, hasApiKey: !!encryptedApiKey };
}

// Validation Schemas
const uuidParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid profile ID format'),
  }),
};

const createProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
    relation: z.enum(['self', 'spouse', 'parent', 'child', 'other']),
    avatarKey: z.string().max(1000).optional(),
  }),
};

const updateProfileSchema = {
  params: z.object({
    id: z.string().uuid('Invalid profile ID format'),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    relation: z.enum(['self', 'spouse', 'parent', 'child', 'other']).optional(),
    avatarKey: z.string().max(1000).optional(),
  }),
};

/**
 * GET /profiles
 * Returns all profiles where ownerId = req.dbUser.id ordered by createdAt ASC.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ownerId = req.dbUser!.id;

    const profilesList = await db.query.patientProfiles.findMany({
      where: eq(patientProfiles.ownerId, ownerId),
      orderBy: asc(patientProfiles.createdAt),
    });

    res.status(200).json({
      status: 'success',
      data: profilesList.map(formatProfile),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /profiles
 * Creates and returns a new profile.
 */
router.post(
  '/',
  validate(createProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.dbUser!.id;
      const { name, dob, relation, avatarKey } = req.body;

      const [newProfile] = await db
        .insert(patientProfiles)
        .values({
          ownerId,
          name,
          dob,
          relation,
          avatarKey: avatarKey || null,
        })
        .returning();

      // Audit Log
      logAudit({
        userId: ownerId,
        action: 'create_profile',
        metadata: { profileId: newProfile.id, name },
        req,
      });

      res.status(201).json({
        status: 'success',
        data: formatProfile(newProfile),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /profiles/:id
 * Verifies profile ownership and updates profile parameters.
 */
router.patch(
  '/:id',
  validate(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.dbUser!.id;
      const { id } = req.params;
      const updates = req.body;

      // 1. Fetch profile to check ownership
      const profile = await db.query.patientProfiles.findFirst({
        where: eq(patientProfiles.id, id),
      });

      if (!profile) {
        res.status(404).json({
          status: 'error',
          message: 'Profile not found',
        });
        return;
      }

      if (profile.ownerId !== ownerId) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: You do not own this profile',
        });
        return;
      }

      // 2. Perform updates
      const [updatedProfile] = await db
        .update(patientProfiles)
        .set(updates)
        .where(eq(patientProfiles.id, id))
        .returning();

      // Audit Log
      logAudit({
        userId: ownerId,
        action: 'update_profile',
        metadata: { profileId: id, fields: Object.keys(updates) },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: formatProfile(updatedProfile),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /profiles/:id
 * Verifies profile ownership and deletes profile.
 */
router.delete(
  '/:id',
  validate(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.dbUser!.id;
      const { id } = req.params;

      // 1. Fetch profile to check ownership
      const profile = await db.query.patientProfiles.findFirst({
        where: eq(patientProfiles.id, id),
      });

      if (!profile) {
        res.status(404).json({
          status: 'error',
          message: 'Profile not found',
        });
        return;
      }

      if (profile.ownerId !== ownerId) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: You do not own this profile',
        });
        return;
      }

      // Prevent deleting the user's only remaining profile.
      const owned = await db.query.patientProfiles.findMany({
        where: eq(patientProfiles.ownerId, ownerId),
        columns: { id: true },
      });
      if (owned.length <= 1) {
        res.status(400).json({
          status: 'error',
          message: 'You must keep at least one family member.',
        });
        return;
      }

      // 2. Delete all of this profile's files from R2 (DB rows cascade on profile delete).
      const docs = await db.query.medicalDocuments.findMany({
        where: eq(medicalDocuments.profileId, id),
        columns: { fileKey: true },
      });
      await Promise.all(
        docs.map((d) =>
          deleteFile(d.fileKey).catch((err) =>
            console.error(`Warning: failed to delete R2 file ${d.fileKey}:`, err)
          )
        )
      );

      // 3. Perform deletion (cascades medical_documents rows via FK)
      await db
        .delete(patientProfiles)
        .where(eq(patientProfiles.id, id));

      // Audit Log: action='delete_profile'
      logAudit({ userId: ownerId, action: 'delete_profile', metadata: { profileId: id }, req });

      // Return 204 No Content
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /profiles/:id/fhir
 * Exports the profile and its documents as a FHIR R4 Bundle (collection) for
 * hospital handoffs. Returns the raw Bundle JSON (not wrapped in the envelope).
 */
router.get(
  '/:id/fhir',
  validate(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.dbUser!.id;
      const { id } = req.params;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, id), eq(patientProfiles.ownerId, ownerId)),
      });
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'Profile not found' });
        return;
      }

      const docs = await db.query.medicalDocuments.findMany({
        where: eq(medicalDocuments.profileId, id),
        orderBy: desc(medicalDocuments.createdAt),
      });

      const entries = await Promise.all(
        docs.map(async (document) => ({
          document,
          attachmentUrl: await getPresignedDownloadUrl(document.fileKey),
        }))
      );

      const bundle = buildFhirBundle(profile, entries);

      logAudit({
        userId: ownerId,
        action: 'fhir_export',
        documentIds: docs.map((d) => d.id),
        metadata: { profileId: id, count: docs.length },
        req,
      });

      res.status(200).json(bundle);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
