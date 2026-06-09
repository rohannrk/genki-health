import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { db } from '../db';
import { auditLogs } from '../db/schema/audit';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

/**
 * POST /auth/sync
 * Called on app launch to verify local user record sync.
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.dbUser!;
    const isNewUser = req.isNewUser || false;

    db.insert(auditLogs)
      .values({
        userId: user.id,
        action: 'login',
        documentIds: [],
        metadata: {},
        ipAddress: req.ip || null,
      })
      .catch((err) => console.error('Audit failed:', err));

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          aiProvider: user.aiProvider,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          hasApiKey: !!user.encryptedApiKey,
        },
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Returns the active user's local database metadata profile.
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.dbUser!;

    res.status(200).json({
      status: 'success',
      data: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        aiProvider: user.aiProvider,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasApiKey: !!user.encryptedApiKey,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
