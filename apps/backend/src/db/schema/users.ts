import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  encryptedApiKey: text('encrypted_api_key'),
  aiProvider: varchar('ai_provider', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  // Consent management (Phase 5). Record-only: the flag is stored and surfaced,
  // but does not gate AI features.
  aiOptIn: boolean('ai_opt_in').notNull().default(false),
  consentUpdatedAt: timestamp('consent_updated_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
