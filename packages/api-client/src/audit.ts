import { AuditLog } from '@medcopilot/types';
import { get } from './http';

type Envelope<T> = { status: string; data: T };

const BASE = '/api/v1/audit';

export type AuditListResult = {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditListParams = {
  action?: string;
  limit?: number;
  offset?: number;
};

function buildQuery(params: AuditListParams = {}): string {
  const q = new URLSearchParams();
  if (params.action) q.set('action', params.action);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const audit = {
  list: (params: AuditListParams, token: string) =>
    get<Envelope<AuditListResult>>(`${BASE}${buildQuery(params)}`, token).then((r) => r.data),
};
