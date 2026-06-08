import { User } from '../db/schema/users';

declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
      dbUser?: User;
      isNewUser?: boolean;
    }
  }
}

export {};
