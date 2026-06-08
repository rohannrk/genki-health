import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { logAudit } from '../services/audit';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

const updateSchema = {
  body: z.object({
    aiOptIn: z.boolean(),
  }),
};

/**
 * GET /consent
 * Returns the current user's consent flags.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.dbUser!;
    res.status(200).json({
      status: 'success',
      data: {
        aiOptIn: user.aiOptIn,
        consentUpdatedAt: user.consentUpdatedAt ? user.consentUpdatedAt.toISOString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /consent
 * Updates consent flags. Record-only — does not gate AI features.
 */
router.patch(
  '/',
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { aiOptIn } = req.body;
      const now = new Date();

      const [updated] = await db
        .update(users)
        .set({ aiOptIn, consentUpdatedAt: now, updatedAt: now })
        .where(eq(users.id, userId))
        .returning();

      logAudit({ userId, action: 'consent_updated', metadata: { aiOptIn }, req });

      res.status(200).json({
        status: 'success',
        data: {
          aiOptIn: updated.aiOptIn,
          consentUpdatedAt: updated.consentUpdatedAt
            ? updated.consentUpdatedAt.toISOString()
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
