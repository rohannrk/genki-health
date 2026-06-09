import type { Request } from 'express';
import { db } from '../db';
import { auditLogs } from '../db/schema/audit';

/**
 * Every auditable action in the system. Centralizing the union keeps call sites
 * honest — a typo'd action string becomes a compile error instead of silent data.
 */
export type AuditAction =
  | 'AI_CHAT_INVOKED'
  | 'AI_SUMMARISE_INVOKED'
  | 'AI_SEARCH_INVOKED'
  | 'AI_KEY_SAVED'
  | 'AI_KEY_DELETED'
  | 'upload_start'
  | 'delete_document'
  | 'rename_document'
  | 'create_profile'
  | 'update_profile'
  | 'delete_profile'
  | 'share_created'
  | 'share_accessed'
  | 'share_revoked'
  | 'pdf_export'
  | 'fhir_export'
  | 'consent_updated'
  | 'account_deleted'
  | 'update_biomarker_reading';

export interface LogAuditInput {
  /** The acting user. May be null for system-initiated events. */
  userId: string | null;
  action: AuditAction;
  documentIds?: string[];
  metadata?: Record<string, unknown>;
  /** The request, used to capture the caller IP address. */
  req?: Pick<Request, 'ip'>;
}

/**
 * Fire-and-forget audit writer. Audit logging must never break the request it
 * describes, so failures are swallowed (logged to console) rather than thrown.
 * Replaces the inline `db.insert(auditLogs)...catch` blocks scattered across routes.
 */
export function logAudit({ userId, action, documentIds = [], metadata = {}, req }: LogAuditInput): void {
  db.insert(auditLogs)
    .values({
      userId,
      action,
      documentIds,
      metadata,
      ipAddress: req?.ip ?? null,
    })
    .catch((err) => console.error(`Audit failed (${action}):`, err));
}
