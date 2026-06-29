import { User, UpdateMeInput } from '@genki/types';
import { get, patch } from './http';

// The backend wraps successful responses as { status: 'success', data: T }.
type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/account/me';

/** The signed-in user as their own single patient ("about you"). */
export const me = {
  get: (token: string) => get<Envelope<User>>(BASE, token).then(r => r.data),

  update: (data: UpdateMeInput, token: string) =>
    patch<Envelope<User>>(BASE, data, token).then(r => r.data),
};

export type { UpdateMeInput };
