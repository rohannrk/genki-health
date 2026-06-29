import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { shares } from '../db/schema/shares';
import { users } from '../db/schema/users';
import { medicalDocuments } from '../db/schema/documents';
import { validate } from '../middleware/validate';
import { logAudit } from '../services/audit';
import { getPresignedDownloadUrl } from '../services/storage';

const router = Router();

// NOTE: this router is intentionally UNAUTHENTICATED — it is the public redemption
// endpoint for share tokens. It exposes view-only document metadata + short-lived
// download URLs and nothing else (no mutation routes live here).

const tokenParamSchema = {
  params: z.object({
    token: z.string().min(32).max(128),
  }),
};

/**
 * GET /share/:token
 * Redeems a share token: returns view-only patient document data if the token is
 * valid (exists, not revoked, not expired). Increments the access counter.
 */
router.get(
  '/:token',
  validate(tokenParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;

      const share = await db.query.shares.findFirst({
        where: eq(shares.token, token),
      });

      if (!share || share.revokedAt) {
        res.status(404).json({ status: 'error', message: 'This share link is invalid or has been revoked' });
        return;
      }

      if (share.expiresAt.getTime() < Date.now()) {
        res.status(410).json({ status: 'error', message: 'This share link has expired' });
        return;
      }

      const owner = await db.query.users.findFirst({
        where: eq(users.id, share.ownerId),
      });

      // Fetch only the documents scoped to this share.
      const docs = share.documentIds.length
        ? await db.query.medicalDocuments.findMany({
            where: and(
              eq(medicalDocuments.userId, share.ownerId),
              inArray(medicalDocuments.id, share.documentIds)
            ),
          })
        : [];

      const documents = await Promise.all(
        docs.map(async (doc) => ({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          date: doc.date,
          hospitalName: doc.hospitalName,
          doctorName: doc.doctorName,
          downloadUrl: await getPresignedDownloadUrl(doc.fileKey),
        }))
      );

      // Record the access and bump the counter (attributed to the share owner).
      await db
        .update(shares)
        .set({ accessCount: share.accessCount + 1 })
        .where(eq(shares.id, share.id));

      logAudit({
        userId: share.ownerId,
        action: 'share_accessed',
        documentIds: share.documentIds,
        metadata: { shareId: share.id },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: {
          profileName: owner?.name ?? 'Shared records',
          expiresAt: share.expiresAt.toISOString(),
          documents,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
