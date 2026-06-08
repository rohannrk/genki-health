export * from './users';
export * from './profiles';
export * from './documents';
export * from './audit';

import { users } from './users';
import { patientProfiles } from './profiles';
import { medicalDocuments } from './documents';
import { auditLogs } from './audit';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type NewPatientProfile = typeof patientProfiles.$inferInsert;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;
export type NewMedicalDocument = typeof medicalDocuments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
