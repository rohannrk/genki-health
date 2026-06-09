import { describe, it, expect } from 'vitest';
import { buildRecordsPdf } from './pdf';

const profile = { name: 'Jane Doe', dob: '1990-04-12', relation: 'self' };

const doc = {
  type: 'prescription',
  title: null,
  date: '2026-05-01',
  hospitalName: 'City Hospital',
  doctorName: 'Dr. Smith',
  extractedText: 'Amoxicillin 500mg, three times daily for 7 days.',
};

describe('buildRecordsPdf', () => {
  it('returns a non-empty PDF byte stream with a valid header', async () => {
    const bytes = await buildRecordsPdf(profile, [doc]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // PDFs start with the "%PDF" magic number.
    const header = String.fromCharCode(...bytes.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('handles documents with no extracted text without throwing', async () => {
    const bytes = await buildRecordsPdf(profile, [
      { ...doc, extractedText: null, hospitalName: null, doctorName: null, date: null },
    ]);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles long extracted text that wraps across lines/pages', async () => {
    const longText = 'lorem ipsum dolor sit amet '.repeat(500);
    const bytes = await buildRecordsPdf(profile, [{ ...doc, extractedText: longText }]);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
