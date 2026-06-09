import { post } from './http';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SearchResult {
  documentId: string;
  type: string;
  title: string | null;
  date: string | null;
  hospitalName: string | null;
  excerpt: string;
  score: number;
}

export interface ChatSource {
  documentId: string;
  type: string;
  title: string | null;
  date: string | null;
  excerpt: string;
}

export interface ChatResponse {
  response: string;
  sources: ChatSource[];
}

export interface SummariseSource {
  id: string;
  type: string;
  title: string | null;
  date: string | null;
  hospitalName: string | null;
}

export interface SummariseResponse {
  summary: string;
  sourceDocument: SummariseSource;
}

export const ai = {
  async chat(profileId: string, messages: ChatMessage[], token: string): Promise<ChatResponse> {
    const res = await post<{ data: ChatResponse }>(
      '/api/v1/ai/chat',
      { profileId, messages },
      token
    );
    return (res as any).data;
  },

  async search(profileId: string, query: string, token: string): Promise<SearchResult[]> {
    const res = await post<{ data: { query: string; results: SearchResult[] } }>(
      '/api/v1/ai/search',
      { profileId, query },
      token
    );
    return (res as any).data.results;
  },

  async summarise(documentId: string, token: string): Promise<SummariseResponse> {
    const res = await post<{ data: SummariseResponse }>(
      '/api/v1/ai/summarise',
      { documentId },
      token
    );
    return (res as any).data;
  },
};
