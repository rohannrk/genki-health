import { Router, Request, Response, NextFunction } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { logAudit } from '../services/audit';
import { deleteFile } from '../services/storage';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

/**
 * DELETE /account
 * Right-to-erasure: removes the user, all their patient profiles and documents
 * (DB rows cascade), and best-effort deletes every stored file from R2.
 */
router.delete('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.dbUser!.id;

    // Audit BEFORE deletion. The audit FK is `onDelete: set null`, so the log row
    // survives the user removal as an anonymized record of the erasure.
    logAudit({ userId, action: 'account_deleted', req });

    // Enumerate this user's profiles, then their documents, to clean up R2 objects.
    const profiles = await db.query.patientProfiles.findMany({
      where: eq(patientProfiles.ownerId, userId),
      columns: { id: true },
    });

    if (profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      const docs = await db.query.medicalDocuments.findMany({
        where: inArray(medicalDocuments.profileId, profileIds),
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
    }

    // Deleting the user cascades to patient_profiles and medical_documents.
    await db.delete(users).where(eq(users.id, userId));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
