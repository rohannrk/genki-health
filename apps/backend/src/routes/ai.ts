import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, sql, asc } from 'drizzle-orm';
import axios from 'axios';
import { db } from '../db';
import { patientProfiles } from '../db/schema/profiles';
import { medicalDocuments } from '../db/schema/documents';
import { auditLogs } from '../db/schema/audit';
import { chatMessages } from '../db/schema/chat';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { decrypt } from '../lib/crypto';
import { env } from '../env';
import { generateAICompletion, AIProvider } from '../services/ai-adapter';
import { embedText } from '../services/embedding';

const router = Router();

router.use(requireAuth);
router.use(getOrCreateUser);

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const chatSchema = {
  body: z.object({
    profileId: z.string().uuid(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    })).min(1),
  }),
};

const summariseSchema = {
  body: z.object({
    documentId: z.string().uuid(),
  }),
};

const searchSchema = {
  body: z.object({
    profileId: z.string().uuid(),
    query: z.string().min(1),
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDecryptedKey(
  profile: { encryptedApiKey: string | null; aiProvider: string | null } | null | undefined
): { apiKey: string; provider: AIProvider } | null {
  if (!profile?.encryptedApiKey || !profile?.aiProvider) return null;
  try {
    return { apiKey: decrypt(profile.encryptedApiKey), provider: profile.aiProvider as AIProvider };
  } catch {
    return null;
  }
}

async function retrieveSimilarDocs(profileId: string, queryVec: number[], limit = 5) {
  const vecLiteral = `[${queryVec.join(',')}]`;
  const rows = await db.execute(
    sql`SELECT id, type, status, title, date, hospital_name, doctor_name, extracted_text, metadata,
               1 - (embedding <=> ${vecLiteral}::vector) AS score
        FROM medical_documents
        WHERE profile_id = ${profileId}::uuid
          AND status = 'ready'
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vecLiteral}::vector
        LIMIT ${limit}`
  );
  return rows as unknown as Array<{
    id: string;
    type: string;
    status: string;
    title: string | null;
    date: string | null;
    hospital_name: string | null;
    doctor_name: string | null;
    extracted_text: string | null;
    metadata: Record<string, unknown>;
    score: number;
  }>;
}

function excerpt(text: string | null, maxLen = 300): string {
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…';
}

async function webSearch(query: string): Promise<string | null> {
  if (!env.TAVILY_API_KEY) return null;
  try {
    const { data } = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      },
      { timeout: 5000 }
    );
    const answer: string = data.answer ?? '';
    const snippets: string[] = (data.results ?? []).map((r: any) => `• ${r.title}: ${r.content?.slice(0, 200) ?? ''}`);
    const combined = [answer, ...snippets].filter(Boolean).join('\n');
    return combined || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /ai/search
// ---------------------------------------------------------------------------

router.post(
  '/search',
  validate(searchSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, query } = req.body;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      const creds = getDecryptedKey(profile);

      db.insert(auditLogs).values({
        userId, action: 'AI_SEARCH_INVOKED',
        documentIds: [],
        metadata: { profileId, query: query.slice(0, 100) },
        ipAddress: req.ip || null,
      }).catch(() => {});

      // Fall back to keyword search if no BYOK key or embedding fails
      let results: Array<{ documentId: string; type: string; title: string | null; date: string | null; hospitalName: string | null; excerpt: string; score: number }> = [];

      if (creds) {
        const geminiKey = creds.provider === 'gemini' ? creds.apiKey : null;
        const queryVec = await embedText(query, geminiKey);

        if (queryVec) {
          const rows = await retrieveSimilarDocs(profileId, queryVec, 10);
          results = rows.map(r => ({
            documentId: r.id,
            type: r.type,
            title: r.title,
            date: r.date,
            hospitalName: r.hospital_name,
            excerpt: excerpt(r.extracted_text),
            score: Number(r.score),
          }));
        }
      }

      // Keyword fallback when no embeddings available
      if (results.length === 0) {
        const docs = await db.query.medicalDocuments.findMany({
          where: and(eq(medicalDocuments.profileId, profileId), eq(medicalDocuments.status, 'ready')),
          limit: 20,
        });
        const lower = query.toLowerCase();
        results = docs
          .filter(d => d.extractedText?.toLowerCase().includes(lower))
          .slice(0, 10)
          .map(d => ({
            documentId: d.id,
            type: d.type,
            title: d.title,
            date: d.date,
            hospitalName: d.hospitalName,
            excerpt: excerpt(d.extractedText),
            score: 1,
          }));
      }

      res.status(200).json({ status: 'success', data: { query, results } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /ai/summarise
// ---------------------------------------------------------------------------

router.post(
  '/summarise',
  validate(summariseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.body;

      const doc = await db.query.medicalDocuments.findFirst({
        where: eq(medicalDocuments.id, documentId),
      });
      if (!doc) {
        res.status(404).json({ status: 'error', message: 'Document not found' });
        return;
      }

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, doc.profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(403).json({ status: 'error', message: 'Access denied' });
        return;
      }

      db.insert(auditLogs).values({
        userId, action: 'AI_SUMMARISE_INVOKED',
        documentIds: [documentId],
        metadata: { type: doc.type, profileId: doc.profileId },
        ipAddress: req.ip || null,
      }).catch(() => {});

      const creds = getDecryptedKey(profile);
      let summary = '';

      if (creds && doc.extractedText) {
        const meta = (doc.metadata ?? {}) as Record<string, string>;
        const result = await generateAICompletion({
          apiKey: creds.apiKey,
          provider: creds.provider,
          prompt: `Summarise this medical document in 3-5 concise bullet points.
Cover: diagnosis or findings, medications/treatments prescribed, key test values with their reference ranges, and any follow-up actions.
If any values are abnormal or out of range, flag them clearly.
Be factual and clinical. Use plain language.

Document type: ${doc.type}
Date: ${doc.date ?? 'unknown'}
Hospital: ${doc.hospitalName ?? 'unknown'}
Doctor: ${doc.doctorName ?? 'unknown'}
${meta.diagnosis ? `Diagnosis: ${meta.diagnosis}` : ''}
${meta.treatment ? `Treatment: ${meta.treatment}` : ''}

Document text:
${doc.extractedText.slice(0, 8000)}`,
        });
        summary = result.text.trim();
      } else if (!doc.extractedText) {
        summary = 'Document has not been processed yet. Please wait for text extraction to complete.';
      } else {
        summary = 'No AI provider configured. Please add an API key in Settings → API Credentials.';
      }

      res.status(200).json({
        status: 'success',
        data: {
          summary,
          sourceDocument: {
            id: doc.id,
            type: doc.type,
            title: doc.title,
            date: doc.date,
            hospitalName: doc.hospitalName,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /ai/chat
// ---------------------------------------------------------------------------

router.post(
  '/chat',
  validate(chatSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, messages } = req.body;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      const creds = getDecryptedKey(profile);
      const lastUserMessage: string = messages.filter((m: { role: string }) => m.role === 'user').at(-1)?.content ?? '';

      db.insert(auditLogs).values({
        userId, action: 'AI_CHAT_INVOKED',
        documentIds: [],
        metadata: { profileId, query: lastUserMessage.slice(0, 100) },
        ipAddress: req.ip || null,
      }).catch(() => {});

      if (!creds) {
        res.status(200).json({
          status: 'success',
          data: {
            response: 'No AI provider configured. Please add an API key in Settings → API Credentials.',
            sources: [],
          },
        });
        return;
      }

      const geminiKey = creds.provider === 'gemini' ? creds.apiKey : null;
      const [queryVec, webContext] = await Promise.all([
        embedText(lastUserMessage, geminiKey),
        webSearch(lastUserMessage),
      ]);
      let contextDocs: Awaited<ReturnType<typeof retrieveSimilarDocs>> = [];

      if (queryVec) {
        contextDocs = await retrieveSimilarDocs(profileId, queryVec, 6);
      } else {
        const recent = await db.query.medicalDocuments.findMany({
          where: and(eq(medicalDocuments.profileId, profileId), eq(medicalDocuments.status, 'ready')),
          limit: 6,
        });
        contextDocs = recent.map(d => ({
          id: d.id, type: d.type, status: d.status, title: d.title,
          date: d.date, hospital_name: d.hospitalName,
          doctor_name: d.doctorName, extracted_text: d.extractedText,
          metadata: d.metadata as Record<string, unknown>, score: 1,
        }));
      }

      const recordsBlock = contextDocs
        .filter(d => d.extracted_text)
        .map(d => {
          const meta = (d.metadata ?? {}) as Record<string, string>;
          const extras = [
            meta.diagnosis ? `Diagnosis: ${meta.diagnosis}` : '',
            meta.treatment ? `Treatment: ${meta.treatment}` : '',
            d.doctor_name ? `Doctor: ${d.doctor_name}` : '',
          ].filter(Boolean).join(' | ');
          return `[Doc: ${d.id}]\nType: ${d.type} | Date: ${d.date ?? 'unknown'} | Hospital: ${d.hospital_name ?? 'unknown'}${extras ? '\n' + extras : ''}\n\nFull text:\n${d.extracted_text!.slice(0, 8000)}`;
        })
        .join('\n\n---\n\n');

      const webBlock = webContext
        ? `\n\nWEB SEARCH (up-to-date clinical reference):\n${webContext}`
        : '';

      const systemPrompt = `You are Genki, a knowledgeable clinical AI assistant for ${profile.name}'s health records.

Your role:
- Answer questions about the patient's records accurately, citing source documents as [Doc: <id>] inline.
- Supplement with general medical knowledge when helpful (e.g. explaining what a test result means, drug interactions, normal ranges).
- If a question cannot be answered from the records, say so and offer what medical context you can.
- Be concise, plain-language, and factual. Never guess or fabricate record details.
- If a value looks abnormal, note it clearly.

PATIENT RECORDS (most relevant to your question):
${recordsBlock || 'No processed records available yet. Upload documents and wait for extraction to complete.'}${webBlock}`;

      const result = await generateAICompletion({
        apiKey: creds.apiKey,
        provider: creds.provider,
        prompt: lastUserMessage,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      const citedIds = [...result.text.matchAll(/\[Doc:\s*([a-f0-9-]{36})\]/g)].map(m => m[1]);
      const sources = contextDocs
        .filter(d => citedIds.includes(d.id))
        .map(d => ({
          documentId: d.id,
          type: d.type,
          title: d.title,
          date: d.date,
          excerpt: excerpt(d.extracted_text),
        }));

      res.status(200).json({
        status: 'success',
        data: { response: result.text, sources },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /ai/history/:profileId
// ---------------------------------------------------------------------------

router.get(
  '/history/:profileId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId } = req.params;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.profileId, profileId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(200);

      // Collect all document IDs referenced in sources across all messages
      const docIds = new Set<string>();
      for (const row of rows) {
        const sources = row.sources as Array<{ documentId: string }> | null;
        if (sources) sources.forEach(s => docIds.add(s.documentId));
      }

      // Fetch current titles for all referenced documents in one query
      const currentTitles = new Map<string, string | null>();
      if (docIds.size > 0) {
        const docs = await db.query.medicalDocuments.findMany({
          where: eq(medicalDocuments.profileId, profileId),
          columns: { id: true, title: true },
        });
        docs.forEach(d => currentTitles.set(d.id, d.title));
      }

      const messages = rows.map(r => {
        const sources = r.sources as Array<{ documentId: string; title: string | null; [key: string]: unknown }> | null;
        const hydratedSources = sources?.map(s => ({
          ...s,
          title: currentTitles.has(s.documentId) ? currentTitles.get(s.documentId) ?? null : s.title,
        }));
        return { id: r.id, role: r.role, content: r.content, sources: hydratedSources ?? undefined };
      });

      res.status(200).json({ status: 'success', data: { messages } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /ai/history  — append messages
// ---------------------------------------------------------------------------

const saveHistorySchema = {
  body: z.object({
    profileId: z.string().uuid(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
      sources: z.array(z.object({
        documentId: z.string(),
        type: z.string(),
        title: z.string().nullable(),
        date: z.string().nullable(),
        excerpt: z.string(),
      })).optional(),
    })).min(1),
  }),
};

router.post(
  '/history',
  validate(saveHistorySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { profileId, messages } = req.body;

      const profile = await db.query.patientProfiles.findFirst({
        where: and(eq(patientProfiles.id, profileId), eq(patientProfiles.ownerId, userId)),
      });
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'Profile not found or access denied' });
        return;
      }

      await db.insert(chatMessages).values(
        messages.map((m: { role: string; content: string; sources?: unknown }) => ({
          profileId,
          role: m.role,
          content: m.content,
          sources: m.sources ?? null,
        }))
      );

      res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
