import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Mock only the two external boundaries we can't reach in a test:
//  - Clerk auth: pass through, resolve to a fixed test user.
//  - R2 storage: stub presign/upload/delete so no real S3 is touched.
// Everything else (routes, middleware, DB) is exercised for real.
// ---------------------------------------------------------------------------
const TEST_CLERK_ID = 'phase5-verify-clerk-id';

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: () => ({ userId: TEST_CLERK_ID }),
  clerkClient: {
    users: { getUser: async () => ({ emailAddresses: [{ emailAddress: 'verify@test.local' }] }) },
  },
}));

vi.mock('./services/storage', () => ({
  generateFileKey: (ownerId: string, filename: string) => `documents/${ownerId}/test/${filename}`,
  getPresignedUploadUrl: async () => 'https://r2.test/upload-url',
  getPresignedDownloadUrl: async (key: string) => `https://r2.test/download/${encodeURIComponent(key)}`,
  uploadBuffer: async () => undefined,
  deleteFile: async () => undefined,
  fileExists: async () => true,
}));

// Loaded in beforeAll (dynamic import, after env is set).
let app: any;
let db: any;
let schema: any;
let userId: string;
let docId: string;

const API = '/api/v1';

// This suite needs a real (migrated) Postgres. It runs only when DATABASE_URL is
// set (e.g. `DATABASE_URL=... pnpm test`); the default `pnpm test` skips it so the
// pure unit tests stay runnable without infrastructure.
const dbEnabled = !!process.env.DATABASE_URL;

beforeAll(async () => {
  if (!dbEnabled) return;
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789abcdef';
  process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_dummy';
  process.env.CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_dummy';
  process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'acct';
  process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'akid';
  process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'secret';
  process.env.R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'test-bucket';
  // Vitest sets NODE_ENV=test, which the env schema rejects; coerce to development.
  process.env.NODE_ENV = 'development';

  const appMod = await import('./app');
  app = appMod.default;
  schema = await import('./db');
  db = schema.db;

  // Clean slate: removing the user cascades to documents/biomarkers/chat/shares.
  await db.delete(schema.users).where(eq(schema.users.clerkId, TEST_CLERK_ID));
});

afterAll(async () => {
  if (dbEnabled && db) {
    await db.delete(schema.users).where(eq(schema.users.clerkId, TEST_CLERK_ID)).catch(() => {});
  }
});

describe.runIf(dbEnabled)('Phase 5 — end-to-end backend flows (real routes + DB)', () => {
  it('sets up the user\'s own profile (about you) and auto-provisions the DB user', async () => {
    const res = await request(app)
      .patch(`${API}/account/me`)
      .send({ name: 'Verify Patient', dob: '1990-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Verify Patient');

    const user = await db.query.users.findFirst({ where: eq(schema.users.clerkId, TEST_CLERK_ID) });
    expect(user).toBeTruthy();
    userId = user.id;
  });

  it('consent: defaults to opted-out, then records opt-in (non-gating)', async () => {
    const before = await request(app).get(`${API}/consent`);
    expect(before.status).toBe(200);
    expect(before.body.data.aiOptIn).toBe(false);

    const patched = await request(app).patch(`${API}/consent`).send({ aiOptIn: true });
    expect(patched.status).toBe(200);
    expect(patched.body.data.aiOptIn).toBe(true);
    expect(patched.body.data.consentUpdatedAt).toBeTruthy();
  });

  it('audit log captures the profile update and consent change', async () => {
    const res = await request(app).get(`${API}/audit?limit=50`);
    expect(res.status).toBe(200);
    const actions = res.body.data.logs.map((l: any) => l.action);
    expect(actions).toContain('update_profile');
    expect(actions).toContain('consent_updated');
  });

  it('secure share: create → redeem (public, no auth) → revoke → expire', async () => {
    // Seed a ready document directly (upload path needs real R2).
    const [doc] = await db
      .insert(schema.medicalDocuments)
      .values({
        userId,
        type: 'lab',
        status: 'ready',
        date: '2026-05-01',
        hospitalName: 'Test Hospital',
        fileKey: 'documents/seed/report.pdf',
        extractedText: 'Hb 13.5 g/dL (normal)',
      })
      .returning();
    docId = doc.id;

    // Create share
    const created = await request(app)
      .post(`${API}/shares`)
      .send({ documentIds: [docId], expiresInHours: 1 });
    expect(created.status).toBe(201);
    const { token, id: shareId, url } = created.body.data;
    expect(url).toContain(`/share/${token}`);

    // Redeem WITHOUT auth — view-only payload
    const redeemed = await request(app).get(`${API}/share/${token}`);
    expect(redeemed.status).toBe(200);
    expect(redeemed.body.data.profileName).toBe('Verify Patient');
    expect(redeemed.body.data.documents).toHaveLength(1);
    expect(redeemed.body.data.documents[0].downloadUrl).toContain('r2.test/download');

    // Revoke → redemption now 404
    const revoked = await request(app).delete(`${API}/shares/${shareId}`);
    expect(revoked.status).toBe(204);
    const afterRevoke = await request(app).get(`${API}/share/${token}`);
    expect(afterRevoke.status).toBe(404);

    // A fresh share, force-expired in the DB → redemption 410
    const created2 = await request(app)
      .post(`${API}/shares`)
      .send({ documentIds: [docId], expiresInHours: 1 });
    const token2 = created2.body.data.token;
    await db
      .update(schema.shares)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.shares.id, created2.body.data.id));
    const expired = await request(app).get(`${API}/share/${token2}`);
    expect(expired.status).toBe(410);
  });

  it('PDF export returns a presigned download URL', async () => {
    const res = await request(app)
      .post(`${API}/documents/export-pdf`)
      .send({ documentIds: [docId] });
    expect(res.status).toBe(200);
    expect(res.body.data.downloadUrl).toContain('r2.test/download');
  });

  it('FHIR export returns a valid R4 Bundle', async () => {
    const res = await request(app).get(`${API}/account/fhir`);
    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    expect(res.body.type).toBe('collection');
    const types = res.body.entry.map((e: any) => e.resource.resourceType);
    expect(types).toContain('Patient');
    expect(types).toContain('DocumentReference');
  });

  it('audit reflects share/export activity', async () => {
    const res = await request(app).get(`${API}/audit?limit=100`);
    const actions = res.body.data.logs.map((l: any) => l.action);
    for (const a of ['share_created', 'share_revoked', 'share_accessed', 'pdf_export', 'fhir_export']) {
      expect(actions).toContain(a);
    }
  });

  it('account deletion cascades and leaves an anonymized audit record', async () => {
    const res = await request(app).delete(`${API}/account`);
    expect(res.status).toBe(204);

    const docs = await db.query.medicalDocuments.findMany({
      where: eq(schema.medicalDocuments.userId, userId),
    });
    expect(docs).toHaveLength(0);

    const deletedUser = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    expect(deletedUser).toBeUndefined();

    const accountDeletes = await db.query.auditLogs.findMany({
      where: eq(schema.auditLogs.action, 'account_deleted'),
    });
    expect(accountDeletes.length).toBeGreaterThan(0);
  });
});
