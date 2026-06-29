import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { encrypt } from '../lib/crypto';
import { auditLogs } from '../db/schema/audit';
import { users } from '../db/schema/users';
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
    provider: providerEnum,
    apiKey: z.string().min(10, 'API Key must be at least 10 characters long'),
  }),
};

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
      const { provider, apiKey } = req.body;

      const encrypted = encrypt(apiKey);
      await db
        .update(users)
        .set({ encryptedApiKey: encrypted, aiProvider: provider })
        .where(eq(users.id, userId));

      db.insert(auditLogs)
        .values({
          userId,
          action: 'AI_KEY_SAVED',
          documentIds: [],
          metadata: { provider },
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
 * DELETE /keys
 * Clears the saved API key for the current user.
 */
router.delete(
  '/',
  requireAuth,
  getOrCreateUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;

      await db
        .update(users)
        .set({ encryptedApiKey: null, aiProvider: null })
        .where(eq(users.id, userId));

      db.insert(auditLogs)
        .values({
          userId,
          action: 'AI_KEY_DELETED',
          documentIds: [],
          metadata: {},
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
