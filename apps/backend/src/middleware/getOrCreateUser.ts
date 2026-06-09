import { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';
import { clerkClient } from '@clerk/express';

/**
 * Middleware that runs after requireAuth.
 * Takes req.clerkUserId and looks up user in DB by clerkId.
 * If not found: creates a new user record with clerkId (retrieving email from Clerk).
 * Attaches resolved user record to req.dbUser and sets req.isNewUser.
 */
export const getOrCreateUser: RequestHandler = async (req, res, next): Promise<void> => {
  const clerkUserId = req.clerkUserId;

  if (!clerkUserId) {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing clerkUserId from request context',
    });
    return;
  }

  try {
    let dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });

    if (!dbUser) {
      let email: string | null = null;
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
      } catch (clerkErr) {
        console.warn(`Warning: Could not fetch user email from Clerk for ${clerkUserId}:`, clerkErr);
      }

      const [newUser] = await db
        .insert(users)
        .values({
          clerkId: clerkUserId,
          email,
          isActive: true,
        })
        .returning();
      dbUser = newUser;
      req.isNewUser = true;
    } else {
      req.isNewUser = false;
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Failed to resolve or create DB user context:', error);
    next(error);
  }
};
