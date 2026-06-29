import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const shares = pgTable('shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  documentIds: uuid('document_ids').array().notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  accessCount: integer('access_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index('shares_owner_id_idx').on(table.ownerId),
  tokenIdx: index('shares_token_idx').on(table.token),
}));
