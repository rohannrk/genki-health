import axios from 'axios';
import { env } from '../env';

// Gemini embedding model. The DB column is vector(768), so we request the dims explicitly
// (gemini-embedding-001 otherwise returns 3072). Override via env if the column dims change.
const EMBED_MODEL = env.GEMINI_EMBED_MODEL;
export const EMBED_DIMS = env.GEMINI_EMBED_DIMS;

/**
 * Embeds text using Gemini (768 dims).
 * Returns null if no key or the call fails — documents are saved but won't be vector-searchable.
 */
export async function embedText(text: string, geminiApiKey: string | null | undefined): Promise<number[] | null> {
  if (!geminiApiKey) return null;

  const truncated = text.slice(0, 8000);

  try {
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${geminiApiKey}`,
      {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: truncated }] },
        outputDimensionality: EMBED_DIMS,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    return data.embedding.values as number[];
  } catch (err: any) {
    console.warn('[embedding] embedText failed:', err?.response?.data ?? err?.message);
    return null;
  }
}
