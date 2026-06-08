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
  date: string;
  hospitalName?: string;
  doctorName?: string;
  /** Presigned download URL returned by the backend (expires in 1 hour) */
  downloadUrl?: string;
  extractedText?: string;
  metadata: Record<string, string>;
  createdAt: string;
};
