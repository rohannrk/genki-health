import { Share } from '@genki/types';
import { get, post, del } from './http';

type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/shares';

export type CreateShareInput = {
  profileId: string;
  documentIds: string[];
  expiresInHours?: number;
};

export const shares = {
  create: (data: CreateShareInput, token: string) =>
    post<Envelope<Share>>(BASE, data, token).then((r) => r.data),

  list: (token: string) =>
    get<Envelope<{ shares: Share[] }>>(BASE, token).then((r) => r.data.shares),

  revoke: (id: string, token: string) => del<void>(`${BASE}/${id}`, token),
};
