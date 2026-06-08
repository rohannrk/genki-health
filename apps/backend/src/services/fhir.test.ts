import { describe, it, expect } from 'vitest';
import { buildFhirBundle } from './fhir';

const profile = { id: 'p-1', name: 'Jane Doe', dob: '1990-04-12' };

const baseDoc = {
  id: 'd-1',
  type: 'lab',
  status: 'ready',
  date: '2026-05-01',
  createdAt: new Date('2026-05-02T10:00:00Z'),
  hospitalName: 'City Hospital',
};

describe('buildFhirBundle', () => {
  it('produces a collection Bundle with a Patient + one DocumentReference per doc', () => {
    const bundle = buildFhirBundle(profile, [
      { document: baseDoc, attachmentUrl: 'https://r2.example/d-1' },
    ]);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');

    const entry = bundle.entry as Array<{ resource: any }>;
    expect(entry).toHaveLength(2);

    const [patient, docRef] = entry;
    expect(patient.resource.resourceType).toBe('Patient');
    expect(patient.resource.name[0].text).toBe('Jane Doe');
    expect(patient.resource.birthDate).toBe('1990-04-12');

    expect(docRef.resource.resourceType).toBe('DocumentReference');
    expect(docRef.resource.status).toBe('current');
    expect(docRef.resource.type.text).toBe('Laboratory report');
    expect(docRef.resource.subject.reference).toBe('Patient/p-1');
    expect(docRef.resource.content[0].attachment.url).toBe('https://r2.example/d-1');
  });

  it('marks non-ready documents as preliminary', () => {
    const bundle = buildFhirBundle(profile, [
      { document: { ...baseDoc, status: 'processing' }, attachmentUrl: 'x' },
    ]);
    const docRef = (bundle.entry as Array<{ resource: any }>)[1];
    expect(docRef.resource.status).toBe('preliminary');
  });

  it('handles a profile with no documents', () => {
    const bundle = buildFhirBundle(profile, []);
    expect((bundle.entry as unknown[]).length).toBe(1);
  });
});
