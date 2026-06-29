import { get, patch } from './http';
import {
  BiomarkerSummary,
  BiomarkerDetail,
  BiomarkerReading,
  UpdateBiomarkerReadingInput,
} from '@genki/types';

export const biomarkers = {
  /** Latest reading per biomarker for the user (Home list/grid). */
  async list(token: string): Promise<BiomarkerSummary[]> {
    const res = await get<{ data: { biomarkers: BiomarkerSummary[] } }>(
      `/api/v1/biomarkers`,
      token
    );
    return res.data.biomarkers;
  },

  /** All readings extracted from a specific document (for the review/edit card). */
  async listByDocument(
    documentId: string,
    token: string
  ): Promise<BiomarkerReading[]> {
    const params = new URLSearchParams({ documentId });
    const res = await get<{ data: { readings: BiomarkerReading[] } }>(
      `/api/v1/biomarkers?${params}`,
      token
    );
    return res.data.readings;
  },

  /** Detail for one biomarker: latest value, reference range, delta, history. */
  async get(code: string, token: string): Promise<BiomarkerDetail> {
    const res = await get<{ data: BiomarkerDetail }>(
      `/api/v1/biomarkers/${encodeURIComponent(code)}`,
      token
    );
    return res.data;
  },

  /**
   * Correct a single extracted biomarker reading (value, refLow, refHigh).
   * Returns the updated reading.
   */
  async update(
    readingId: string,
    input: UpdateBiomarkerReadingInput,
    token: string
  ): Promise<BiomarkerReading> {
    const res = await patch<{ data: BiomarkerReading }>(
      `/api/v1/biomarkers/${encodeURIComponent(readingId)}`,
      input,
      token
    );
    return res.data;
  },
};
