import { PatientProfile, CreateProfileInput } from '@medcopilot/types';
import { get, post, patch, del } from './http';

// The backend wraps successful responses as { status: 'success', data: T }.
type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/profiles';

export const profiles = {
  list: (token: string) =>
    get<Envelope<PatientProfile[]>>(BASE, token).then(r => r.data),

  create: (data: CreateProfileInput, token: string) =>
    post<Envelope<PatientProfile>>(BASE, data, token).then(r => r.data),

  update: (id: string, data: Partial<CreateProfileInput>, token: string) =>
    patch<Envelope<PatientProfile>>(`${BASE}/${id}`, data, token).then(r => r.data),

  delete: (id: string, token: string) => del<void>(`${BASE}/${id}`, token),
};

export type { CreateProfileInput };
