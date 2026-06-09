import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { db, MedicalDocument } from '../db';
import { medicalDocuments } from '../db/schema/documents';
import { patientProfiles } from '../db/schema/profiles';
import { logAudit } from '../services/audit';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { randomUUID } from 'crypto';
import {
  generateFileKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteFile,
  fileExists,
  uploadBuffer,
} from '../services/storage';
import { processDocument } from '../services/ingestion';
import { buildRecordsPdf } from '../services/pdf';

const router = Router();

// Enforce authentication and user synchronization on all document endpoints
router.use(requireAuth);
router.use(getOrCreateUser);

const uploadUrlSchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID format'),
    filename: z.string().min(1, 'Filename is required').max(255),
    contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    fileSize: z.number().int().positive('File size must be positive').max(20 * 1024 * 1024, 'File size must not exceed 20MB'),
  }),
};

const confirmSchema = {
  params: z.object({
    documentId: z.string().uuid('Invalid document ID format'),
  }),
};

const listQuerySchema = {
  query: z.object({
    profileId: z.string().uuid('profileId is required'),
    type: z.string().max(50).optional(),
    status: z.string().max(50).optional(),
    limit: z.coerce.number().max(100).default(20),
    offset: z.coerce.number().default(0),
  }),
};

const uuidParamSchema = {
  params: z.object({
    documentId: z.string().uuid('Invalid document ID format'),
  }),
};

const exportPdfSchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID format'),
    documentIds: z.array(z.string().uuid()).optional(),
  }),
};

const renameSchema = {
  params: z.object({
    documentId: z.string().uuid('Invalid document ID format'),
  }),
  body: z.object({
    // null clears the title; a non-null value must be 1–255 non-blank chars.
    title: z.string().trim().min(1, 'Title cannot be blank').max(255).nullable(),
  }),
};

const formatDocument = async (doc: MedicalDocument, { includeDownloadUrl = true } = {}) => {
  const downloadUrl = includeDownloadUrl ? await getPresignedDownloadUrl(doc.fileKey) : undefined;
  return {
    id: doc.id,
    profileId: doc.profileId,
    type: doc.type,
    status: doc.status,
    title: doc.title,
    date: doc.date,
    hospitalName: doc.hospitalName,
    doctorName: doc.doctorName,
    ...(downloadUrl !== undefined && { downloadUrl }),
    extractedText: doc.extractedText,
    metadata: doc.metadata as Record<string, unknown>,
    createdAt: doc.createdAt.toISOString(),
  };
};

const verifyDocumentOwnership = async (
  documentId: string,
  userId: string
): Promise<MedicalDocument | null> => {
  const doc = await db.query.medicalDocuments.findFirst({
    where: eq(medicalDocuments.id, documentId),
  });

  if (!doc) return null;

  // Check if current user owns the patient profile linked to this document
  const profile = await db.query.patientProfiles.findFirst({
    where: and(eq(patientProfiles.id, doc.profileId), eq(patientProfiles.ownerId, userId)),
  });

  if (!profile) return null;

  return doc;
};

/**
 * POST /documents/upload-url
 * Generates an R2 presigned PUT URL and creates a pending document record.
 */
router.post(
  '/upload-url',
  validate(uploadUrlSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, filename, contentType, fileSize } = req.body;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });

      if (!profile) {
        res.status(403).json({
          status: 'error',
          message: 'Access denied: You do not own this patient profile',
        });
        return;
      }

      const fileKey = generateFileKey(profileId, filename);
      const uploadUrl = await getPresignedUploadUrl(fileKey, contentType);

      const [newDoc] = await db
        .insert(medicalDocuments)
        .values({
          profileId,
          type: 'other',
          status: 'uploading',
          fileKey,
          metadata: { name: filename, contentType, fileSize },
        })
        .returning();

      logAudit({ userId, action: 'upload_start', documentIds: [newDoc.id], req });

      res.status(200).json({
        status: 'success',
        data: {
          documentId: newDoc.id,
          uploadUrl,
          fileKey,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /documents/export-pdf
 * Compiles the selected records (or all of a profile's records) into a single PDF,
 * stores it in R2, and returns a short-lived presigned download URL.
 */
router.post(
  '/export-pdf',
  validate(exportPdfSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, documentIds } = req.body as { profileId: string; documentIds?: string[] };

      // Verify profile ownership.
      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(403).json({
          status: 'error',
          message: 'Access denied: You do not own this patient profile',
        });
        return;
      }

      // Fetch documents — scoped to the requested IDs if provided, else all.
      const filters = [eq(medicalDocuments.profileId, profileId)];
      if (documentIds && documentIds.length > 0) {
        filters.push(inArray(medicalDocuments.id, documentIds));
      }
      const docs = await db.query.medicalDocuments.findMany({
        where: and(...filters),
        orderBy: desc(medicalDocuments.createdAt),
      });

      if (docs.length === 0) {
        res.status(400).json({ status: 'error', message: 'No documents to export' });
        return;
      }

      const pdfBytes = await buildRecordsPdf(profile, docs);
      const fileKey = `exports/${profileId}/${randomUUID()}.pdf`;
      await uploadBuffer(fileKey, pdfBytes, 'application/pdf');
      const downloadUrl = await getPresignedDownloadUrl(fileKey);

      logAudit({
        userId,
        action: 'pdf_export',
        documentIds: docs.map((d) => d.id),
        metadata: { profileId, count: docs.length },
        req,
      });

      res.status(200).json({ status: 'success', data: { downloadUrl } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /documents/:documentId/confirm-upload
 * Verifies the file was successfully put into R2, updating status to processing.
 */
router.post(
  '/:documentId/confirm-upload',
  validate(confirmSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.params;

      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      const exists = await fileExists(doc.fileKey);
      if (!exists) {
        res.status(400).json({
          status: 'error',
          message: 'File upload not found in storage. Confirm upload after S3 transfer.',
        });
        return;
      }

      const [updatedDoc] = await db
        .update(medicalDocuments)
        .set({ status: 'processing' })
        .where(eq(medicalDocuments.id, documentId))
        .returning();

      // Fire-and-forget — OCR + classify + embed in background
      processDocument(documentId).catch(err =>
        console.error('[ingestion] background processing failed:', err)
      );

      res.status(200).json({
        status: 'success',
        data: {
          documentId: updatedDoc.id,
          status: updatedDoc.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /documents/:documentId/retry
 * Re-runs the ingestion pipeline for a document that failed (or got stuck) processing.
 */
router.post(
  '/:documentId/retry',
  validate(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.params;

      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({ status: 'error', message: 'Forbidden: Document not found or access denied' });
        return;
      }

      // Reset state and re-queue
      const existingMeta = (doc.metadata as Record<string, unknown>) || {};
      const [updatedDoc] = await db
        .update(medicalDocuments)
        .set({
          status: 'processing',
          metadata: { ...existingMeta, processingStage: 'queued', processingError: null },
        })
        .where(eq(medicalDocuments.id, documentId))
        .returning();

      processDocument(documentId).catch((err) =>
        console.error('[ingestion] retry processing failed:', err)
      );

      res.status(200).json({
        status: 'success',
        data: { documentId: updatedDoc.id, status: updatedDoc.status },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /documents
 * Lists all documents belonging to a specific patient profile owned by the user.
 */
router.get(
  '/',
  validate(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, type, status, limit, offset } = req.query as {
        profileId: string; type?: string; status?: string; limit?: number; offset?: number;
      };

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });

      if (!profile) {
        res.status(403).json({
          status: 'error',
          message: 'Access denied: You do not own this patient profile',
        });
        return;
      }

      const filters = [eq(medicalDocuments.profileId, profileId)];
      if (type) {
        filters.push(eq(medicalDocuments.type, type));
      }
      if (status) {
        filters.push(eq(medicalDocuments.status, status));
      }

      const docs = await db.query.medicalDocuments.findMany({
        where: and(...filters),
        orderBy: desc(medicalDocuments.createdAt),
        limit,
        offset,
      });

      const totalResult = await db
        .select({ count: count() })
        .from(medicalDocuments)
        .where(and(...filters));
      const total = totalResult[0]?.count || 0;

      const documentsList = await Promise.all(docs.map((doc) => formatDocument(doc)));

      res.status(200).json({
        status: 'success',
        data: {
          documents: documentsList,
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /documents/:documentId
 * Returns a single document detail after checking ownership.
 */
router.get(
  '/:documentId',
  validate(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.params;

      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      const response = await formatDocument(doc);

      res.status(200).json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /documents/:documentId
 * Renames a document (user-assigned display name). Pass title: null to clear.
 */
router.patch(
  '/:documentId',
  validate(renameSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.params;
      const { title } = req.body as { title: string | null };

      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      const [updated] = await db
        .update(medicalDocuments)
        .set({ title: title ?? null })
        .where(eq(medicalDocuments.id, documentId))
        .returning();

      if (!updated) {
        res.status(404).json({ status: 'error', message: 'Document not found' });
        return;
      }

      logAudit({
        userId,
        action: 'rename_document',
        documentIds: [documentId],
        metadata: { title: updated.title },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: await formatDocument(updated, { includeDownloadUrl: false }),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /documents/:documentId
 * Deletes a document from R2 and the database.
 */
router.delete(
  '/:documentId',
  validate(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.params;

      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      try {
        await deleteFile(doc.fileKey);
      } catch (r2Error) {
        console.error(`Warning: Failed to delete file key ${doc.fileKey} from R2:`, r2Error);
      }

      await db.delete(medicalDocuments).where(eq(medicalDocuments.id, documentId));
      logAudit({ userId, action: 'delete_document', documentIds: [documentId], req });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
