import {
  pgTable,
  uuid,
  varchar,
  doublePrecision,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { patientProfiles } from './profiles';
import { medicalDocuments } from './documents';

/**
 * One structured biomarker measurement extracted from a lab report.
 * Many readings per profile build the time-series trend for a given `code`.
 * Status (low/in/high) is derived at read time from value vs. ref range,
 * so it is intentionally not stored here.
 */
export const biomarkerReadings = pgTable(
  'biomarker_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => patientProfiles.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => medicalDocuments.id, { onDelete: 'cascade' }),
    /** Normalized identifier, e.g. 'hemoglobin'. */
    code: varchar('code', { length: 64 }).notNull(),
    /** Human display name, e.g. 'Hemoglobin'. */
    name: varchar('name', { length: 128 }).notNull(),
    value: doublePrecision('value').notNull(),
    unit: varchar('unit', { length: 32 }).notNull().default(''),
    refLow: doublePrecision('ref_low'),
    refHigh: doublePrecision('ref_high'),
    /** Date of the report this reading came from. */
    measuredAt: date('measured_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    profileCodeIdx: index('biomarkers_profile_code_idx').on(table.profileId, table.code),
    documentIdx: index('biomarkers_document_idx').on(table.documentId),
    measuredAtIdx: index('biomarkers_measured_at_idx').on(table.measuredAt),
  })
);
