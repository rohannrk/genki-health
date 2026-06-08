import { ConsentSettings } from '@medcopilot/types';
import { get, patch, del } from './http';

type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/consent';

export const consent = {
  get: (token: string) =>
    get<Envelope<ConsentSettings>>(BASE, token).then((r) => r.data),

  update: (data: { aiOptIn: boolean }, token: string) =>
    patch<Envelope<ConsentSettings>>(BASE, data, token).then((r) => r.data),

  /** Right-to-erasure: permanently deletes the account and all associated data. */
  deleteAccount: (token: string) => del<void>('/api/v1/account', token),
};
