import { User, PatientProfile, MedicalDocument, DocumentType } from '@medcopilot/types';
import { get, post, getBaseUrl } from './http';

// Re-export shared HTTP helpers and feature modules.
export { get, post, patch, del, getBaseUrl } from './http';
export { profiles } from './profiles';
export type { CreateProfileInput } from './profiles';

// ---------------------------------------------------------------------------
// Auth module
// ---------------------------------------------------------------------------

export const auth = {
  /**
   * POST /api/v1/auth/sync — create or fetch the DB user.
   * Call this after every Clerk sign-in or sign-up.
   */
  sync: (token: string) =>
    post<{ user: User; isNewUser: boolean }>('/api/v1/auth/sync', {}, token),

  /**
   * GET /api/v1/auth/me — fetch the current DB user.
   */
  me: (token: string) => get<User>('/api/v1/auth/me', token),
};

// ---------------------------------------------------------------------------
// Legacy class-based client (kept for backwards compatibility)
// ---------------------------------------------------------------------------

export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(token: string | null = null, baseUrl?: string) {
    this.token = token;
    this.baseUrl = baseUrl || getBaseUrl();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    headers.set('Content-Type', 'application/json');

    try {
      if (this.baseUrl.includes('medcopilot.local')) {
        throw new Error('Mock API Fallback');
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      return this.mockResponse<T>(path, options);
    }
  }

  public readonly auth = {
    login: async (phone: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
    },
    verify: async (phone: string, code: string): Promise<{ token: string; user: User }> => {
      return this.request<{ token: string; user: User }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
    },
  };

  public readonly profiles = {
    list: async (): Promise<PatientProfile[]> => {
      return this.request<PatientProfile[]>('/profiles');
    },
    create: async (profile: Omit<PatientProfile, 'id' | 'ownerId'>): Promise<PatientProfile> => {
      return this.request<PatientProfile>('/profiles', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
    },
  };

  public readonly documents = {
    upload: async (
      profileId: string,
      type: DocumentType,
      fileUrl: string,
      metadata?: Record<string, string>
    ): Promise<MedicalDocument> => {
      return this.request<MedicalDocument>('/documents/upload', {
        method: 'POST',
        body: JSON.stringify({ profileId, type, fileUrl, metadata }),
      });
    },
    list: async (profileId?: string): Promise<MedicalDocument[]> => {
      const query = profileId ? `?profileId=${profileId}` : '';
      return this.request<MedicalDocument[]>(`/documents${query}`);
    },
  };

  public readonly ai = {
    chat: async (
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    ): Promise<{ response: string }> => {
      return this.request<{ response: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
    },
    summarise: async (documentId: string): Promise<{ summary: string }> => {
      return this.request<{ summary: string }>(`/ai/summarise/${documentId}`, {
        method: 'POST',
      });
    },
    search: async (query: string): Promise<MedicalDocument[]> => {
      return this.request<MedicalDocument[]>(`/ai/search?q=${encodeURIComponent(query)}`);
    },
  };

  private mockResponse<T>(path: string, options: RequestInit): T {
    const method = options.method || 'GET';

    if (path.startsWith('/auth/login')) {
      return { success: true } as unknown as T;
    }
    if (path.startsWith('/auth/verify')) {
      return {
        token: 'mock-jwt-token-xyz123',
        user: {
          id: 'user-1',
          phone: '+15555551234',
          email: 'doctor@medcopilot.com',
          aiProvider: 'openai',
          hasApiKey: true,
          createdAt: new Date().toISOString(),
        },
      } as unknown as T;
    }
    if (path.startsWith('/profiles')) {
      if (method === 'POST') {
        const body = JSON.parse(options.body as string);
        return {
          id: `profile-${Math.random().toString(36).substring(2, 11)}`,
          ownerId: 'user-1',
          name: body.name || 'Unknown Patient',
          dob: body.dob || '1990-01-01',
          relation: body.relation || 'Self',
        } as unknown as T;
      }
      return [
        {
          id: 'prof-1',
          ownerId: 'user-1',
          name: 'Sarah Jenkins',
          dob: '1988-11-24',
          relation: 'Self',
        },
        {
          id: 'prof-2',
          ownerId: 'user-1',
          name: 'Billy Jenkins',
          dob: '2018-05-12',
          relation: 'Son',
        },
      ] as unknown as T;
    }
    if (path.startsWith('/documents/upload')) {
      const body = JSON.parse(options.body as string);
      return {
        id: `doc-${Math.random().toString(36).substring(2, 11)}`,
        profileId: body.profileId,
        type: body.type,
        status: 'ready',
        date: new Date().toISOString().split('T')[0],
        fileUrl: body.fileUrl,
        metadata: body.metadata || {},
        createdAt: new Date().toISOString(),
      } as unknown as T;
    }
    if (path.startsWith('/documents')) {
      return [
        {
          id: 'doc-1',
          profileId: 'prof-1',
          type: 'prescription',
          status: 'ready',
          date: '2026-05-10',
          hospitalName: 'General Hospital',
          doctorName: 'Dr. Sarah Jenkins',
          fileUrl: 'https://medcopilot.local/files/prescription.pdf',
          extractedText: 'Amoxicillin 500mg - Take 3 times daily.',
          metadata: { size: '1048576' },
          createdAt: '2026-05-10T11:00:00Z',
        },
        {
          id: 'doc-2',
          profileId: 'prof-1',
          type: 'lab',
          status: 'ready',
          date: '2026-02-14',
          hospitalName: 'City Diagnostic Labs',
          doctorName: 'Dr. Sarah Jenkins',
          fileUrl: 'https://medcopilot.local/files/lab-report.pdf',
          extractedText: 'White Blood Cell Count: 7.5 x10^3/uL (Normal)',
          metadata: { size: '2516582' },
          createdAt: '2026-02-14T15:00:00Z',
        },
      ] as unknown as T;
    }
    if (path.startsWith('/ai/chat')) {
      return { response: 'This is a mock AI response from Medical Copilot.' } as unknown as T;
    }
    if (path.includes('/ai/summarise/')) {
      return { summary: 'The medical report shows normal blood sugar levels and blood pressure.' } as unknown as T;
    }
    if (path.startsWith('/ai/search')) {
      return [] as unknown as T;
    }

    throw new Error(`Mock not implemented for ${method} ${path}`);
  }
}
