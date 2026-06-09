import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { patientProfiles } from './profiles';

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => patientProfiles.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 10 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  sources: jsonb('sources'), // ChatSource[] | null
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  profileIdIdx: index('chat_messages_profile_id_idx').on(table.profileId),
}));

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;
