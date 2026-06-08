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
  date: string;
  hospitalName?: string;
  doctorName?: string;
  fileUrl: string;
  extractedText?: string;
  metadata: Record<string, string>;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Phase 5 — Sharing, Export & Compliance
// ---------------------------------------------------------------------------

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
