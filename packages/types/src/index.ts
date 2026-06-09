export type User = {
  id: string;
  phone: string;
  email?: string;
  aiProvider: 'openai' | 'anthropic' | 'gemini' | null;
  hasApiKey: boolean;
  createdAt: string;
};

export type Relation = 'self' | 'spouse' | 'parent' | 'child' | 'other';

export type PatientProfile = {
  id: string;
  ownerId: string;
  name: string;
  dob: string;
  relation: string;
  /** R2/S3 object key for the avatar (backend storage field). */
  avatarKey?: string | null;
  /** Optional fully-qualified URL (legacy / future presigned display URL). */
  avatarUrl?: string;
  /** Whether this profile has its own AI (BYOK) key configured. */
  hasApiKey?: boolean;
  /** The AI provider for this profile's key, if set. */
  aiProvider?: 'openai' | 'anthropic' | 'gemini' | null;
  createdAt?: string;
};

export type CreateProfileInput = {
  name: string;
  dob: string;
  relation: Relation;
  avatarKey?: string;
};

export type DocumentType = 'prescription' | 'lab' | 'invoice' | 'imaging' | 'other';
export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type MedicalDocument = {
  id: string;
  profileId: string;
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
  profileId: string;
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
  profileId: string;
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
