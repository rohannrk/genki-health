import { get, post, patch, del, getBaseUrl } from './http';
import { MedicalDocument } from '@genki/types';

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  fileKey: string;
}

export interface DocumentListResponse {
  documents: MedicalDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentListOptions {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ExportPdfInput {
  profileId: string;
  documentIds?: string[];
}

export const documents = {
  async getUploadUrl(
    profileId: string,
    filename: string,
    contentType: 'image/jpeg' | 'image/png' | 'application/pdf',
    fileSize: number,
    token: string
  ): Promise<UploadUrlResponse> {
    const res = await post<{ data: UploadUrlResponse }>(
      '/api/v1/documents/upload-url',
      { profileId, filename, contentType, fileSize },
      token
    );
    return res.data;
  },

  async confirmUpload(documentId: string, token: string): Promise<{ documentId: string; status: string }> {
    const res = await post<{ data: { documentId: string; status: string } }>(
      `/api/v1/documents/${documentId}/confirm-upload`,
      {},
      token
    );
    return res.data;
  },

  async list(profileId: string, token: string, opts: DocumentListOptions = {}): Promise<DocumentListResponse> {
    const params = new URLSearchParams({ profileId });
    if (opts.type) params.set('type', opts.type);
    if (opts.status) params.set('status', opts.status);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const res = await get<{ data: DocumentListResponse }>(`/api/v1/documents?${params}`, token);
    return res.data;
  },

  async get(documentId: string, token: string): Promise<MedicalDocument> {
    const res = await get<{ data: MedicalDocument }>(`/api/v1/documents/${documentId}`, token);
    return res.data;
  },

  async delete(documentId: string, token: string): Promise<void> {
    await del(`/api/v1/documents/${documentId}`, token);
  },

  /** Rename a document (user-assigned display name). Pass null to clear. */
  async rename(documentId: string, title: string | null, token: string): Promise<MedicalDocument> {
    const res = await patch<{ data: MedicalDocument }>(
      `/api/v1/documents/${documentId}`,
      { title },
      token
    );
    return res.data;
  },

  async retry(documentId: string, token: string): Promise<{ documentId: string; status: string }> {
    const res = await post<{ data: { documentId: string; status: string } }>(
      `/api/v1/documents/${documentId}/retry`,
      {},
      token
    );
    return res.data;
  },

  /** Compile selected records into a PDF; returns a presigned download URL. */
  async exportPdf(data: ExportPdfInput, token: string): Promise<string> {
    const res = await post<{ data: { downloadUrl: string } }>(
      '/api/v1/documents/export-pdf',
      data,
      token
    );
    return res.data.downloadUrl;
  },

  /** Upload a file directly to R2 via presigned URL, reporting progress */
  async uploadToStorage(
    uploadUrl: string,
    fileUri: string,
    contentType: string,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));

      // React Native fetch blob approach
      fetch(fileUri)
        .then(r => r.blob())
        .then(blob => xhr.send(blob))
        .catch(reject);
    });
  },
};

export { getBaseUrl };
