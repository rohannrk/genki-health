import { describe, it, expect } from 'vitest';
import { formatDate, formatFileSize, maskApiKey, groupByMonth } from './index';
import { MedicalDocument } from '@medcopilot/types';

describe('formatDate', () => {
  it('should format ISO string to DD MMM YYYY', () => {
    expect(formatDate('2025-01-12T10:00:00Z')).toBe('12 Jan 2025');
    expect(formatDate('2026-11-05')).toBe('5 Nov 2026');
  });

  it('should return original string if invalid date', () => {
    expect(formatDate('invalid-date')).toBe('invalid-date');
  });
});

describe('formatFileSize', () => {
  it('should format file sizes in bytes to human-readable format', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(512)).toBe('512 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(2516582)).toBe('2.4 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });
});

describe('maskApiKey', () => {
  it('should mask long keys showing only first 3 and last 4 characters', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-...cdef');
    expect(maskApiKey('key-supersecretvalue1234')).toBe('key...1234');
  });

  it('should return three dots if key is too short to be masked safely', () => {
    expect(maskApiKey('short')).toBe('...');
    expect(maskApiKey('')).toBe('...');
  });
});

describe('groupByMonth', () => {
  it('should group documents by Month and Year', () => {
    const docs: MedicalDocument[] = [
      {
        id: 'doc-1',
        profileId: 'prof-1',
        type: 'prescription',
        status: 'ready',
        date: '2026-05-10',
        metadata: {},
        createdAt: '2026-05-10T11:00:00Z',
      },
      {
        id: 'doc-2',
        profileId: 'prof-1',
        type: 'lab',
        status: 'ready',
        date: '2026-02-14',
        metadata: {},
        createdAt: '2026-02-14T15:00:00Z',
      },
      {
        id: 'doc-3',
        profileId: 'prof-1',
        type: 'invoice',
        status: 'ready',
        date: '2026-05-20',
        metadata: {},
        createdAt: '2026-05-20T12:00:00Z',
      },
    ];

    const grouped = groupByMonth(docs);

    expect(Object.keys(grouped)).toContain('May 2026');
    expect(Object.keys(grouped)).toContain('February 2026');

    expect(grouped['May 2026']).toHaveLength(2);
    expect(grouped['February 2026']).toHaveLength(1);

    // Should be sorted descending (doc-3 is May 20, doc-1 is May 10)
    expect(grouped['May 2026'][0].id).toBe('doc-3');
    expect(grouped['May 2026'][1].id).toBe('doc-1');
  });

  it('should group invalid date documents into Unknown Date', () => {
    const docs: MedicalDocument[] = [
      {
        id: 'doc-err',
        profileId: 'prof-1',
        type: 'other',
        status: 'error',
        date: 'bad-date',
        metadata: {},
        createdAt: '',
      },
    ];

    const grouped = groupByMonth(docs);
    expect(grouped['Unknown Date']).toHaveLength(1);
    expect(grouped['Unknown Date'][0].id).toBe('doc-err');
  });
});
