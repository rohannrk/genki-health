import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { decrypt } from '../lib/crypto';
import { generateAICompletion, AIProvider } from '../services/ai-adapter';
import { logAudit } from '../services/audit';

const router = Router();

// Protect all AI endpoints
router.use(requireAuth);
router.use(getOrCreateUser);

// Validation Schemas
const chatSchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID format'),
    messages: z.array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1, 'Message content is required'),
      })
    ).min(1, 'At least one message is required'),
  }),
};

const summariseSchema = {
  body: z.object({
    documentId: z.string().uuid('Invalid document ID format'),
  }),
};

const searchSchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID format'),
    query: z.string().min(1, 'Search query is required'),
  }),
};

/**
 * POST /ai/chat
 * Chat with Medical Copilot regarding a patient profile.
 */
router.post(
  '/chat',
  validate(chatSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id; // dbUser is guaranteed by getOrCreateUser middleware
      const { profileId, messages } = req.body;

      // Validate patient profile ownership
      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });

      if (!profile) {
        res.status(404).json({
          status: 'error',
          message: 'Patient profile not found or access denied',
        });
        return;
      }

      // Fetch saved API key details from DB
      const user = req.dbUser!;
      const savedKeyData = user.encryptedApiKey;
      const provider = user.aiProvider as AIProvider | null;

      let aiResponseText = `[Mock Copilot] Hello! I am your Medical Copilot. This is a stub response. I have access to patient profile "${profile.name}".`;

      if (savedKeyData && provider) {
        try {
          const apiKey = decrypt(savedKeyData);
          const completion = await generateAICompletion({
            apiKey,
            provider,
            prompt: messages[messages.length - 1].content,
            messages,
          });
          aiResponseText = completion.text;
        } catch (decryptErr) {
          console.error('Failed to decrypt or use saved key:', decryptErr);
        }
      }

      // Audit Log
      logAudit({
        userId,
        action: 'AI_CHAT_INVOKED',
        metadata: { profileId, query: messages[messages.length - 1].content.substring(0, 100) },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: {
          response: aiResponseText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /ai/summarise
 * Summarise a medical document.
 */
router.post(
  '/summarise',
  validate(summariseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.body;

      // Validate document existence
      const doc = await db.query.medicalDocuments.findFirst({
        where: eq(medicalDocuments.id, documentId),
      });

      if (!doc) {
        res.status(404).json({
          status: 'error',
          message: 'Medical document not found',
        });
        return;
      }

      // Validate patient profile ownership
      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, doc.profileId), eq(patientProfiles.ownerId, userId)),
      });

      if (!profile) {
        res.status(403).json({
          status: 'error',
          message: 'Access denied to this document',
        });
        return;
      }

      // Audit Log
      logAudit({
        userId,
        action: 'AI_SUMMARISE_INVOKED',
        documentIds: [documentId],
        metadata: { type: doc.type, profileId: doc.profileId },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: {
          documentId,
          summary: `This is a stub summary for document of type "${doc.type}". Key findings: The document appears to contain clinical records or laboratory results. Standard parameters fall within expected physiological baselines. Please review original document for clinical decisions.`,
          metadata: {
            extractedEntities: ['Heart Rate', 'Blood Pressure'],
            classification: doc.type,
          },
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /ai/search
 * Semantic searching across a patient profile's records.
 */
router.post(
  '/search',
  validate(searchSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, query } = req.body;

      // Validate profile ownership
      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });

      if (!profile) {
        res.status(404).json({
          status: 'error',
          message: 'Patient profile not found or access denied',
        });
        return;
      }

      // Audit Log
      logAudit({
        userId,
        action: 'AI_SEARCH_INVOKED',
        metadata: { profileId, query },
        req,
      });

      res.status(200).json({
        status: 'success',
        data: {
          query,
          results: [
            {
              documentId: 'stub-doc-id-1',
              type: 'report',
              matchText: 'CBC count shows stable platelet count and Hb levels...',
              score: 0.92,
            },
            {
              documentId: 'stub-doc-id-2',
              type: 'prescription',
              matchText: 'Continue taking daily multi-vitamin tablet...',
              score: 0.81,
            },
          ],
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
