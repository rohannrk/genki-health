export * from './users';
export * from './profiles';
export * from './documents';
export * from './audit';
export * from './shares';

import { users } from './users';
import { patientProfiles } from './profiles';
import { medicalDocuments } from './documents';
import { auditLogs } from './audit';
import { shares } from './shares';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type NewPatientProfile = typeof patientProfiles.$inferInsert;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;
export type NewMedicalDocument = typeof medicalDocuments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
