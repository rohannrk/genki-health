import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { shares } from '../db/schema/shares';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { logAudit } from '../services/audit';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

const createSchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID format'),
    documentIds: z.array(z.string().uuid()).min(1, 'Select at least one document'),
    expiresInHours: z.number().int().positive().max(24 * 30).default(72),
  }),
};

const idParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid share ID format'),
  }),
};

/** Builds the public redemption URL for a share token from the incoming request. */
function shareUrl(req: Request, token: string): string {
  return `${req.protocol}://${req.get('host')}/api/v1/share/${token}`;
}

function formatShare(req: Request, share: typeof shares.$inferSelect) {
  return {
    id: share.id,
    profileId: share.profileId,
    documentIds: share.documentIds,
    token: share.token,
    url: shareUrl(req, share.token),
    expiresAt: share.expiresAt.toISOString(),
    revokedAt: share.revokedAt ? share.revokedAt.toISOString() : null,
    accessCount: share.accessCount,
    createdAt: share.createdAt.toISOString(),
  };
}

/**
 * POST /shares
 * Creates a time-limited, view-only share link scoped to specific documents.
 */
router.post(
  '/',
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, documentIds, expiresInHours } = req.body;

      // Verify profile ownership.
      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(403).json({ status: 'error', message: 'Access denied: You do not own this profile' });
        return;
      }

      // Verify every requested document belongs to this profile.
      const docs = await db.query.medicalDocuments.findMany({
        where: and(
          eq(medicalDocuments.profileId, profileId),
          inArray(medicalDocuments.id, documentIds)
        ),
        columns: { id: true },
      });
      if (docs.length !== documentIds.length) {
        res.status(400).json({
          status: 'error',
          message: 'One or more documents do not belong to this profile',
        });
        return;
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      const [share] = await db
        .insert(shares)
        .values({ ownerId: userId, profileId, documentIds, token, expiresAt })
        .returning();

      logAudit({
        userId,
        action: 'share_created',
        documentIds,
        metadata: { shareId: share.id, expiresAt: expiresAt.toISOString() },
        req,
      });

      res.status(201).json({ status: 'success', data: formatShare(req, share) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /shares
 * Lists the current user's share links, most recent first.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.dbUser!.id;
    const rows = await db.query.shares.findMany({
      where: eq(shares.ownerId, userId),
      orderBy: desc(shares.createdAt),
    });
    res.status(200).json({
      status: 'success',
      data: { shares: rows.map((s) => formatShare(req, s)) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /shares/:id
 * Revokes a share link (soft delete via revokedAt).
 */
router.delete(
  '/:id',
  validate(idParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { id } = req.params;

      const share = await db.query.shares.findFirst({
        where: and(eq(shares.id, id), eq(shares.ownerId, userId)),
      });
      if (!share) {
        res.status(404).json({ status: 'error', message: 'Share not found' });
        return;
      }

      await db.update(shares).set({ revokedAt: new Date() }).where(eq(shares.id, id));

      logAudit({ userId, action: 'share_revoked', metadata: { shareId: id }, req });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
