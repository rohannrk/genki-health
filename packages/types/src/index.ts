/**
 * The signed-in user, who is their own single patient. `name`/`dob` are the
 * one-time "about you" details captured at setup.
 */
export type User = {
  id: string;
  email?: string | null;
  name: string | null;
  dob: string | null;
  aiProvider: 'openai' | 'anthropic' | 'gemini' | null;
  /** Whether the user has an AI (BYOK) key configured. */
  hasApiKey: boolean;
  aiOptIn?: boolean;
};

/** Payload for the one-time "about you" setup (and later edits). */
export type UpdateMeInput = {
  name?: string;
  dob?: string;
};

export type DocumentType = 'prescription' | 'lab' | 'invoice' | 'imaging' | 'other';
export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type MedicalDocument = {
  id: string;
  userId: string;
  type: DocumentType;
  status: DocumentStatus;
  /** User-assigned display name (rename). Null/absent → fall back to type/filename. */
  title?: string | null;
  date: string;
  hospitalName?: string;
  doctorName?: string;
  /** Presigned download URL returned by the backend (expires in 1 hour) */
  downloadUrl?: string;
  extractedText?: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  action: string;
  documentIds: string[];
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
};

export type ConsentSettings = {
  aiOptIn: boolean;
  consentUpdatedAt: string | null;
};

export type Share = {
  id: string;
  documentIds: string[];
  token: string;
  /** Fully-qualified redemption URL (`/api/v1/share/:token`). */
  url: string;
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  createdAt: string;
};

/** View-only payload returned when redeeming a share token (unauthenticated). */
export type SharedView = {
  profileName: string;
  expiresAt: string;
  documents: Array<{
    id: string;
    type: string;
    date: string | null;
    hospitalName?: string | null;
    doctorName?: string | null;
    downloadUrl: string;
  }>;
};

// ── Biomarkers ───────────────────────────────────────────────────────────────

/** Where a measured value sits relative to its reference range. */
export type BiomarkerStatus = 'low' | 'in' | 'high' | 'unknown';

/** A single biomarker measurement extracted from one lab report. */
export type BiomarkerReading = {
  id: string;
  userId: string;
  documentId: string;
  /** Normalized identifier, e.g. 'hemoglobin'. */
  code: string;
  /** Display name, e.g. 'Hemoglobin'. */
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  /** ISO date (YYYY-MM-DD) of the report this reading came from. */
  measuredAt: string;
};

/** Latest reading per biomarker — used for the list/grid on Home. */
export type BiomarkerSummary = {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  status: BiomarkerStatus;
  measuredAt: string;
  /** Number of readings on record (trend depth). */
  count: number;
};

/** A single point in a biomarker's history series. */
export type BiomarkerHistoryPoint = {
  value: number;
  measuredAt: string;
  documentId: string;
  /** Reference range from the report this point came from (may differ per lab). */
  refLow: number | null;
  refHigh: number | null;
  /** Status of this point against its own reference range. */
  status: BiomarkerStatus;
};

/** Full detail: latest value + reference range + full history series. */
export type BiomarkerDetail = BiomarkerSummary & {
  /** Change vs. the previous reading in `unit` (null if only one reading). */
  delta: number | null;
  history: BiomarkerHistoryPoint[];
};

/** Payload for correcting an extracted biomarker reading (user edits). */
export type UpdateBiomarkerReadingInput = {
  value: number;
  refLow: number | null;
  refHigh: number | null;
};
