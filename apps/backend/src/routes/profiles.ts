import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { auditLogs } from '../db/schema/audit';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { deleteFile } from '../services/storage';

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
      db.insert(auditLogs)
        .values({
          userId: ownerId,
          action: 'create_profile',
          documentIds: [],
          metadata: { profileId: newProfile.id, name },
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

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
      db.insert(auditLogs)
        .values({
          userId: ownerId,
          action: 'update_profile',
          documentIds: [],
          metadata: { profileId: id, fields: Object.keys(updates) },
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

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
      db.insert(auditLogs)
        .values({
          userId: ownerId,
          action: 'delete_profile',
          documentIds: [],
          metadata: { profileId: id },
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

      // Return 204 No Content
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
