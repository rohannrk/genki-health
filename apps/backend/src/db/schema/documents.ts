import { pgTable, uuid, varchar, text, date, jsonb, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { patientProfiles } from './profiles';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
});

export const medicalDocuments = pgTable('medical_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => patientProfiles.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull().default('other'),
  status: varchar('status', { length: 50 }).notNull().default('uploading'),
  date: date('date'),
  hospitalName: varchar('hospital_name', { length: 255 }),
  doctorName: varchar('doctor_name', { length: 255 }),
  fileKey: text('file_key').notNull(),
  extractedText: text('extracted_text'),
  embedding: vector('embedding'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  profileIdIdx: index('docs_profile_id_idx').on(table.profileId),
  statusIdx: index('docs_status_idx').on(table.status),
  createdAtIdx: index('docs_created_at_idx').on(table.createdAt.desc()),
}));
