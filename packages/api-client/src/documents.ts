import { get, post } from './http';

type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/documents';

/** Document shape as returned by the backend list/detail endpoints (with presigned downloadUrl). */
export type DocumentItem = {
  id: string;
  profileId: string;
  type: string;
  status: string;
  date: string | null;
  hospitalName?: string | null;
  doctorName?: string | null;
  downloadUrl: string;
  extractedText?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ExportPdfInput = {
  profileId: string;
  documentIds?: string[];
};

export const documents = {
  list: (profileId: string, token: string) =>
    get<Envelope<{ documents: DocumentItem[]; total: number }>>(
      `${BASE}?profileId=${encodeURIComponent(profileId)}`,
      token
    ).then((r) => r.data),

  /** Compile selected records into a PDF; returns a presigned download URL. */
  exportPdf: (data: ExportPdfInput, token: string) =>
    post<Envelope<{ downloadUrl: string }>>(`${BASE}/export-pdf`, data, token).then(
      (r) => r.data.downloadUrl
    ),
};
