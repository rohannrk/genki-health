import { pgTable, uuid, varchar, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const patientProfiles = pgTable('patient_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  dob: date('dob').notNull(),
  relation: varchar('relation', { length: 50 }).notNull(),
  avatarKey: text('avatar_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index('profiles_owner_id_idx').on(table.ownerId),
}));
