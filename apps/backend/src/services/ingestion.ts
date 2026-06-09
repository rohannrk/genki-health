import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { medicalDocuments } from '../db/schema/documents';
import { patientProfiles } from '../db/schema/profiles';
import { decrypt } from '../lib/crypto';
import { getPresignedDownloadUrl } from './storage';
import { generateAICompletion, AIProvider } from './ai-adapter';
import { embedText } from './embedding';

const DOCUMENT_TYPES = ['prescription', 'lab', 'invoice', 'imaging', 'other'] as const;
type DocType = typeof DOCUMENT_TYPES[number];

interface ExtractedMetadata {
  date?: string;
  doctorName?: string;
  hospitalName?: string;
  diagnosis?: string;
  treatment?: string;
}

async function fetchFileAsBase64(fileKey: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const url = await getPresignedDownloadUrl(fileKey);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] || 'image/jpeg');
    return { base64: buffer.toString('base64'), mimeType: contentType };
  } catch (err) {
    console.warn('[ingestion] Failed to fetch file from R2:', err);
    return null;
  }
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}

/** Ordered ingestion stages, surfaced to the client for progress display. */
export const INGESTION_STAGES = ['queued', 'fetching', 'analyzing', 'embedding', 'done'] as const;
export type IngestionStage = typeof INGESTION_STAGES[number];

/** Merge-update the document's metadata (keeps other keys intact). */
async function patchMetadata(documentId: string, patch: Record<string, unknown>): Promise<void> {
  const current = await db.query.medicalDocuments.findFirst({
    where: eq(medicalDocuments.id, documentId),
    columns: { metadata: true },
  });
  const existing = (current?.metadata as Record<string, unknown>) || {};
  await db
    .update(medicalDocuments)
    .set({ metadata: { ...existing, ...patch } })
    .where(eq(medicalDocuments.id, documentId));
}

async function setStage(documentId: string, stage: IngestionStage): Promise<void> {
  await patchMetadata(documentId, { processingStage: stage });
}

export async function processDocument(documentId: string): Promise<void> {
  try {
    await runIngestion(documentId);
  } catch (err) {
    console.error(`[ingestion] Document ${documentId} failed:`, err);
    await db
      .update(medicalDocuments)
      .set({ status: 'error' })
      .where(eq(medicalDocuments.id, documentId));
    await patchMetadata(documentId, {
      processingError: err instanceof Error ? err.message : 'Processing failed unexpectedly',
    });
  }
}

async function runIngestion(documentId: string): Promise<void> {
  const doc = await db.query.medicalDocuments.findFirst({
    where: eq(medicalDocuments.id, documentId),
  });
  if (!doc) {
    console.error(`[ingestion] Document ${documentId} not found`);
    return;
  }

  await setStage(documentId, 'queued');

  const profile = await db.query.patientProfiles.findFirst({
    where: eq(patientProfiles.id, doc.profileId),
  });
  if (!profile) {
    console.error(`[ingestion] Profile not found for document ${documentId}`);
    await db.update(medicalDocuments).set({ status: 'error' }).where(eq(medicalDocuments.id, documentId));
    await patchMetadata(documentId, { processingError: 'Patient profile not found' });
    return;
  }

  let apiKey: string | null = null;
  let provider: AIProvider | null = null;

  if (profile.encryptedApiKey && profile.aiProvider) {
    try {
      apiKey = decrypt(profile.encryptedApiKey);
      provider = profile.aiProvider as AIProvider;
    } catch {
      console.warn('[ingestion] Could not decrypt API key');
    }
  }

  if (!apiKey || !provider) {
    // No BYOK key — mark ready without AI processing
    await db
      .update(medicalDocuments)
      .set({ status: 'ready' })
      .where(eq(medicalDocuments.id, documentId));
    await patchMetadata(documentId, {
      processingStage: 'done',
      processingError: null,
      processingNote: 'Add an AI key for this family member in Settings to enable text extraction and search.',
    });
    return;
  }

  await setStage(documentId, 'fetching');
  const file = await fetchFileAsBase64(doc.fileKey);
  if (!file) {
    await db.update(medicalDocuments).set({ status: 'error' }).where(eq(medicalDocuments.id, documentId));
    await patchMetadata(documentId, { processingError: 'Could not download the uploaded file from storage.' });
    return;
  }

  let extractedText = '';
  let docType: DocType = 'other';
  let meta: ExtractedMetadata = {};

  await setStage(documentId, 'analyzing');
  try {
    const result = await generateAICompletion({
      apiKey,
      provider,
      imageBase64: file.base64,
      imageMimeType: file.mimeType,
      jsonOutput: true,
      thinking: false,
      prompt: `You are a medical document parser. Read this document and return ONLY a JSON object:
{
  "text": "the full text of the document, verbatim, exactly as it appears",
  "type": "one of: prescription, lab, invoice, imaging, other",
  "date": "document date as YYYY-MM-DD, or null",
  "doctorName": "string or null",
  "hospitalName": "string or null",
  "diagnosis": "string or null",
  "treatment": "string or null"
}
Do not omit any text from the document in the "text" field. Use null where a field is not present.`,
    });
    const parsed = parseJsonSafe<{ text?: string; type?: string } & ExtractedMetadata>(result.text, {});
    extractedText = (parsed.text ?? '').trim();
    const rawType = (parsed.type ?? '').toLowerCase().trim();
    if (DOCUMENT_TYPES.includes(rawType as DocType)) {
      docType = rawType as DocType;
    }
    meta = {
      date: parsed.date,
      doctorName: parsed.doctorName,
      hospitalName: parsed.hospitalName,
      diagnosis: parsed.diagnosis,
      treatment: parsed.treatment,
    };
  } catch (err) {
    console.warn('[ingestion] Analysis failed:', err);
  }

  if (!extractedText) {
    await db.update(medicalDocuments).set({ status: 'error' }).where(eq(medicalDocuments.id, documentId));
    await patchMetadata(documentId, { processingError: 'Could not read any text from this document. Try a clearer photo or PDF.' });
    return;
  }

  await setStage(documentId, 'embedding');
  const geminiKey = provider === 'gemini' ? apiKey : null; // embedding always uses Gemini
  const embedding = await embedText(extractedText, geminiKey);

  const existingMeta = (doc.metadata as Record<string, unknown>) || {};
  await db
    .update(medicalDocuments)
    .set({
      status: 'ready',
      type: docType,
      extractedText: extractedText || null,
      embedding: embedding ?? undefined,
      date: meta.date ?? doc.date ?? undefined,
      doctorName: meta.doctorName ?? doc.doctorName ?? undefined,
      hospitalName: meta.hospitalName ?? doc.hospitalName ?? undefined,
      metadata: {
        ...existingMeta,
        processingStage: 'done',
        processingError: null,
        ...(meta.diagnosis ? { diagnosis: meta.diagnosis } : {}),
        ...(meta.treatment ? { treatment: meta.treatment } : {}),
      },
    })
    .where(eq(medicalDocuments.id, documentId));

  console.log(`[ingestion] Document ${documentId} processed: type=${docType}, textLen=${extractedText.length}, embedded=${!!embedding}`);
}
