import type { MedicalDocument } from '../db';

/** Minimal patient identity for a FHIR Patient resource. */
export interface FhirPatient {
  id: string;
  name: string | null;
  dob: string | null;
}

/**
 * Maps an internal document type to a FHIR DocumentReference type.text label.
 * Kept as plain text (not a coded LOINC system) since the source data is uncoded.
 */
const TYPE_TEXT: Record<string, string> = {
  prescription: 'Prescription',
  lab: 'Laboratory report',
  invoice: 'Invoice',
  imaging: 'Diagnostic imaging',
  report: 'Clinical report',
  other: 'Clinical document',
};

export interface FhirDocumentInput {
  document: Pick<
    MedicalDocument,
    'id' | 'type' | 'status' | 'title' | 'date' | 'createdAt' | 'hospitalName'
  >;
  /** Presigned, time-limited URL to the underlying file. */
  attachmentUrl: string;
}

/**
 * Builds a FHIR R4 `Bundle` (type: collection) containing one Patient resource
 * and one DocumentReference per document. Suitable for hospital-handoff exports.
 * Pure JSON — no FHIR library dependency.
 */
export function buildFhirBundle(
  profile: FhirPatient,
  entries: FhirDocumentInput[]
): Record<string, unknown> {
  const patientResource = {
    resourceType: 'Patient',
    id: profile.id,
    name: [{ text: profile.name ?? 'Unknown' }],
    birthDate: profile.dob ?? undefined,
  };

  const bundleEntries: Array<Record<string, unknown>> = [
    {
      fullUrl: `urn:uuid:${profile.id}`,
      resource: patientResource,
    },
  ];

  for (const { document, attachmentUrl } of entries) {
    bundleEntries.push({
      fullUrl: `urn:uuid:${document.id}`,
      resource: {
        resourceType: 'DocumentReference',
        id: document.id,
        // Map internal upload/processing states to FHIR document status.
        status: document.status === 'ready' ? 'current' : 'preliminary',
        type: { text: TYPE_TEXT[document.type] ?? 'Clinical document' },
        description: document.title ?? undefined,
        subject: { reference: `Patient/${profile.id}` },
        date: (document.date ? new Date(document.date) : document.createdAt).toISOString(),
        author: document.hospitalName ? [{ display: document.hospitalName }] : undefined,
        content: [
          {
            attachment: {
              url: attachmentUrl,
            },
          },
        ],
      },
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: bundleEntries,
  };
}
