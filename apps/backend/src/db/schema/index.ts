export * from './users';
export * from './documents';
export * from './audit';
export * from './shares';
export * from './chat';
export * from './biomarkers';

import { users } from './users';
import { medicalDocuments } from './documents';
import { auditLogs } from './audit';
import { shares } from './shares';
import { chatMessages } from './chat';
import { biomarkerReadings } from './biomarkers';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;
export type NewMedicalDocument = typeof medicalDocuments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type BiomarkerReadingRow = typeof biomarkerReadings.$inferSelect;
export type NewBiomarkerReadingRow = typeof biomarkerReadings.$inferInsert;
