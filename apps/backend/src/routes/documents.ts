import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db, MedicalDocument } from '../db';
import { medicalDocuments } from '../db/schema/documents';
import { patientProfiles } from '../db/schema/profiles';
import { auditLogs } from '../db/schema/audit';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import {
  generateFileKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteFile,
  fileExists,
} from '../services/storage';

const router = Router();

// Enforce authentication and user synchronization on all document endpoints
router.use(requireAuth);
router.use(getOrCreateUser);

// Validation Schemas
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

// Response Formatter (strips internal fileKey)
const formatDocument = async (doc: MedicalDocument) => {
  const downloadUrl = await getPresignedDownloadUrl(doc.fileKey);
  return {
    id: doc.id,
    profileId: doc.profileId,
    type: doc.type,
    status: doc.status,
    date: doc.date,
    hospitalName: doc.hospitalName,
    doctorName: doc.doctorName,
    downloadUrl,
    extractedText: doc.extractedText,
    metadata: doc.metadata as Record<string, unknown>,
    createdAt: doc.createdAt.toISOString(),
  };
};

/**
 * Helper to verify ownership of a document.
 * Returns the document if user has ownership, otherwise throws an error or returns null.
 */
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

      // 1. Verify that patient profile exists and belongs to current user
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

      // 2. Generate a secure, unique R2 file key
      const fileKey = generateFileKey(profileId, filename);

      // 3. Generate presigned upload URL (expires in 5 minutes)
      const uploadUrl = await getPresignedUploadUrl(fileKey, contentType);

      // 4. Create document record in DB
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

      // 5. Log audit
      db.insert(auditLogs)
        .values({
          userId,
          action: 'upload_start',
          documentIds: [newDoc.id],
          metadata: {},
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

      // 6. Return response
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

      // 1. Fetch document and verify ownership
      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      // 2. Verify file exists in R2
      const exists = await fileExists(doc.fileKey);
      if (!exists) {
        res.status(400).json({
          status: 'error',
          message: 'File upload not found in storage. Confirm upload after S3 transfer.',
        });
        return;
      }

      // 3. Update status: 'uploading' -> 'processing' -> stub 'ready' immediately
      const [updatedDoc] = await db
        .update(medicalDocuments)
        .set({
          status: 'ready', // stub ready immediately as requested
        })
        .where(eq(medicalDocuments.id, documentId))
        .returning();

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
 * GET /documents
 * Lists all documents belonging to a specific patient profile owned by the user.
 */
router.get(
  '/',
  validate(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, type, status, limit, offset } = req.query as any;

      // 1. Verify profile ownership
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

      // Build query filters
      const filters = [eq(medicalDocuments.profileId, profileId)];
      if (type) {
        filters.push(eq(medicalDocuments.type, type));
      }
      if (status) {
        filters.push(eq(medicalDocuments.status, status));
      }

      // 2. Query documents
      const docs = await db.query.medicalDocuments.findMany({
        where: and(...filters),
        orderBy: desc(medicalDocuments.createdAt),
        limit,
        offset,
      });

      // Query total count of matching documents
      const totalResult = await db
        .select({ count: count() })
        .from(medicalDocuments)
        .where(and(...filters));
      const total = totalResult[0]?.count || 0;

      // 3. Format and attach presigned download URLs
      const documentsList = await Promise.all(docs.map((doc) => formatDocument(doc)));

      // 4. Return results
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

      // 1. Verify ownership
      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      // 2. Attach presigned download URL & Format
      const response = await formatDocument(doc);

      // 3. Return response
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

      // 1. Verify ownership
      const doc = await verifyDocumentOwnership(documentId, userId);
      if (!doc) {
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Document not found or access denied',
        });
        return;
      }

      // 2. Delete file from R2
      try {
        await deleteFile(doc.fileKey);
      } catch (r2Error) {
        console.error(`Warning: Failed to delete file key ${doc.fileKey} from R2:`, r2Error);
      }

      // 3. Delete database record
      await db.delete(medicalDocuments).where(eq(medicalDocuments.id, documentId));

      // 4. Log audit: action='delete_document'
      db.insert(auditLogs)
        .values({
          userId,
          action: 'delete_document',
          documentIds: [documentId],
          metadata: {},
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

      // 5. Return 204
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
