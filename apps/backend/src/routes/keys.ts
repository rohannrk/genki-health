import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { encrypt } from '../lib/crypto';
import { auditLogs } from '../db/schema/audit';
import { patientProfiles } from '../db/schema/profiles';
import { db } from '../db';

const router = Router();

// Validation Schemas
const providerEnum = z.enum(['openai', 'anthropic', 'gemini']);

const validateKeySchema = {
  body: z.object({
    provider: providerEnum,
    apiKey: z.string().min(10, 'API Key must be at least 10 characters long'),
  }),
};

const saveKeySchema = {
  body: z.object({
    profileId: z.string().uuid('Invalid profile ID'),
    provider: providerEnum,
    apiKey: z.string().min(10, 'API Key must be at least 10 characters long'),
  }),
};

const deleteKeySchema = {
  params: z.object({
    profileId: z.string().uuid('Invalid profile ID'),
  }),
};

/** Verify the profile exists and belongs to the current user. */
async function ownProfile(profileId: string, ownerId: string) {
  return db.query.patientProfiles.findFirst({
    where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, ownerId)),
  });
}

router.post(
  '/validate',
  requireAuth,
  validate(validateKeySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { provider, apiKey } = req.body;

    let valid = false;
    let model = '';
    let reason = 'Validation failed';

    try {
      if (provider === 'openai') {
        model = 'gpt-4o';
        try {
          const response = await axios.get('https://api.openai.com/v1/models', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 8000,
          });
          if (response.status === 200) {
            valid = true;
          }
        } catch (err: any) {
          valid = false;
          reason = err.response?.data?.error?.message || err.message || 'Invalid key response';
        }
      } else if (provider === 'anthropic') {
        model = 'claude-3-5-sonnet-20240620';
        try {
          await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'Ping' }],
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              timeout: 8000,
            }
          );
          valid = true;
        } catch (err: any) {
          const status = err.response?.status;
          if (status === 200 || status === 400) {
            // status 400 means auth passed but request structure or parameters were flagged
            valid = true;
          } else if (status === 401) {
            valid = false;
            reason = 'Unauthorized: API key is invalid';
          } else {
            valid = false;
            reason = err.response?.data?.error?.message || err.message || 'Invalid key response';
          }
        }
      } else if (provider === 'gemini') {
        model = 'gemini-1.5-pro';
        try {
          const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
            { timeout: 8000 }
          );
          if (response.status === 200) {
            valid = true;
          }
        } catch (err: any) {
          valid = false;
          reason = err.response?.data?.error?.message || err.message || 'Invalid key response';
        }
      }

      if (valid) {
        res.status(200).json({
          valid: true,
          provider,
          model,
        });
      } else {
        res.status(400).json({
          error: 'Invalid API key',
          reason,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /keys/save
 * Encrypts and saves the provider's API key.
 */
router.post(
  '/save',
  requireAuth,
  getOrCreateUser,
  validate(saveKeySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, provider, apiKey } = req.body;

      const profile = await ownProfile(profileId, userId);
      if (!profile) {
        res.status(403).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      const encrypted = encrypt(apiKey);
      await db
        .update(patientProfiles)
        .set({ encryptedApiKey: encrypted, aiProvider: provider })
        .where(eq(patientProfiles.id, profileId));

      db.insert(auditLogs)
        .values({
          userId,
          action: 'AI_KEY_SAVED',
          documentIds: [],
          metadata: { provider, profileId },
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

      res.status(200).json({
        message: 'Key saved',
        provider,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /keys/:profileId
 * Clears the saved API key for a specific profile.
 */
router.delete(
  '/:profileId',
  requireAuth,
  getOrCreateUser,
  validate(deleteKeySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId } = req.params;

      const profile = await ownProfile(profileId, userId);
      if (!profile) {
        res.status(403).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      await db
        .update(patientProfiles)
        .set({ encryptedApiKey: null, aiProvider: null })
        .where(eq(patientProfiles.id, profileId));

      db.insert(auditLogs)
        .values({
          userId,
          action: 'AI_KEY_DELETED',
          documentIds: [],
          metadata: { profileId },
          ipAddress: req.ip || null,
        })
        .catch((err) => console.error('Audit failed:', err));

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
