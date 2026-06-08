import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { encrypt } from '../lib/crypto';
import { logAudit } from '../services/audit';
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

/**
 * POST /keys/validate
 * Tests the provided API key with a minimal validation call to the corresponding AI provider.
 * NEVER logs the apiKey.
 */
router.post(
  '/validate',
  requireAuth, // Only requires requireAuth as per spec
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
        // Strip API key from log output if any
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

      // Encrypt key using AES-256-GCM from lib/crypto
      const encrypted = encrypt(apiKey);

      // Save key details
      await db
        .update(users)
        .set({
          encryptedApiKey: encrypted,
          aiProvider: provider,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Audit Log
      logAudit({ userId, action: 'AI_KEY_SAVED', metadata: { provider }, req });

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
 * Clears saved API key configurations from the active session.
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
        .set({
          encryptedApiKey: null,
          aiProvider: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Audit Log
      logAudit({ userId, action: 'AI_KEY_DELETED', req });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
