import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';
import { medicalDocuments } from '../db/schema/documents';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { logAudit } from '../services/audit';
import { deleteFile, getPresignedDownloadUrl } from '../services/storage';
import { buildFhirBundle } from '../services/fhir';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

/** Public-safe view of the signed-in user (the single patient). */
function formatMe(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    dob: u.dob,
    aiProvider: u.aiProvider,
    hasApiKey: !!u.encryptedApiKey,
    aiOptIn: u.aiOptIn,
  };
}

/**
 * GET /account/me
 * Returns the signed-in user's own patient identity.
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ status: 'success', data: formatMe(req.dbUser!) });
  } catch (error) {
    next(error);
  }
});

const updateMeSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format').optional(),
  }),
};

/**
 * PATCH /account/me
 * Updates the user's own name / date of birth (the one-time "about you").
 */
router.patch(
  '/me',
  validate(updateMeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const updates = req.body as { name?: string; dob?: string };

      const [updated] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      logAudit({ userId, action: 'update_profile', metadata: { fields: Object.keys(updates) }, req });

      res.status(200).json({ status: 'success', data: formatMe(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /account/fhir
 * Exports the user and all their documents as a FHIR R4 Bundle (collection)
 * for hospital handoffs. Returns the raw Bundle JSON (not wrapped in the envelope).
 */
router.get('/fhir', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.dbUser!;

    const docs = await db.query.medicalDocuments.findMany({
      where: eq(medicalDocuments.userId, user.id),
      orderBy: desc(medicalDocuments.createdAt),
    });

    const entries = await Promise.all(
      docs.map(async (document) => ({
        document,
        attachmentUrl: await getPresignedDownloadUrl(document.fileKey),
      }))
    );

    const bundle = buildFhirBundle({ id: user.id, name: user.name, dob: user.dob }, entries);

    logAudit({
      userId: user.id,
      action: 'fhir_export',
      documentIds: docs.map((d) => d.id),
      metadata: { count: docs.length },
      req,
    });

    res.status(200).json(bundle);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /account
 * Right-to-erasure: removes the user and all their documents (DB rows cascade),
 * and best-effort deletes every stored file from R2.
 */
router.delete('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.dbUser!.id;

    // Audit BEFORE deletion. The audit FK is `onDelete: set null`, so the log row
    // survives the user removal as an anonymized record of the erasure.
    logAudit({ userId, action: 'account_deleted', req });

    // Enumerate this user's documents to clean up R2 objects.
    const docs = await db.query.medicalDocuments.findMany({
      where: eq(medicalDocuments.userId, userId),
      columns: { fileKey: true },
    });

    // Best-effort R2 cleanup — never block account deletion on storage errors.
    await Promise.all(
      docs.map((doc) =>
        deleteFile(doc.fileKey).catch((err) =>
          console.error(`Failed to delete file ${doc.fileKey} during account deletion:`, err)
        )
      )
    );

    // Deleting the user cascades to medical_documents, biomarker_readings, chat_messages.
    await db.delete(users).where(eq(users.id, userId));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
