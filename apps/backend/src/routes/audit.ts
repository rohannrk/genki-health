import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema/audit';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

const listQuerySchema = {
  query: z.object({
    action: z.string().max(100).optional(),
    limit: z.coerce.number().max(100).default(20),
    offset: z.coerce.number().default(0),
  }),
};

/**
 * GET /audit
 * Returns the current user's audit trail, most recent first.
 */
router.get(
  '/',
  validate(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { action, limit, offset } = req.query as unknown as {
        action?: string;
        limit: number;
        offset: number;
      };

      const filters = [eq(auditLogs.userId, userId)];
      if (action) {
        filters.push(eq(auditLogs.action, action));
      }

      const logs = await db.query.auditLogs.findMany({
        where: and(...filters),
        orderBy: desc(auditLogs.createdAt),
        limit,
        offset,
      });

      const totalResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(and(...filters));
      const total = totalResult[0]?.count || 0;

      res.status(200).json({
        status: 'success',
        data: {
          logs: logs.map((log) => ({
            id: log.id,
            action: log.action,
            documentIds: log.documentIds ?? [],
            metadata: log.metadata as Record<string, unknown>,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt.toISOString(),
          })),
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

export default router;
