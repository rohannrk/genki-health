import { post, get } from './http';

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

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
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
    return res.data;
  },

  async search(profileId: string, query: string, token: string): Promise<SearchResult[]> {
    const res = await post<{ data: { query: string; results: SearchResult[] } }>(
      '/api/v1/ai/search',
      { profileId, query },
      token
    );
    return res.data.results;
  },

  async summarise(documentId: string, token: string): Promise<SummariseResponse> {
    const res = await post<{ data: SummariseResponse }>(
      '/api/v1/ai/summarise',
      { documentId },
      token
    );
    return res.data;
  },

  async getHistory(profileId: string, token: string): Promise<HistoryMessage[]> {
    const res = await get<{ data: { messages: HistoryMessage[] } }>(
      `/api/v1/ai/history/${profileId}`,
      token
    );
    return res.data.messages;
  },

  async saveHistory(
    profileId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string; sources?: ChatSource[] }>,
    token: string
  ): Promise<void> {
    await post('/api/v1/ai/history', { profileId, messages }, token);
  },
};
