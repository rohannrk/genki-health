import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { db, BiomarkerReadingRow } from '../db';
import { biomarkerReadings } from '../db/schema/biomarkers';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser } from '../middleware/getOrCreateUser';
import { validate } from '../middleware/validate';
import { classifyStatus } from '../services/biomarkers';
import { logAudit } from '../services/audit';

const router = Router();

// Auth + user sync on all biomarker endpoints.
router.use(requireAuth);
router.use(getOrCreateUser);

const listSchema = {
  query: z.object({
    /** Optional: filter to a single document's readings (for the review card). */
    documentId: z.string().uuid().optional(),
  }),
};

const detailSchema = {
  params: z.object({ code: z.string().min(1).max(64) }),
};

const updateSchema = {
  params: z.object({ readingId: z.string().uuid('Invalid reading ID') }),
  body: z.object({
    value: z.number({ required_error: 'value is required' }),
    refLow: z.number().nullable(),
    refHigh: z.number().nullable(),
  }),
};

// Stable order for a biomarker's readings: by report date, then ingestion time
// so same-day readings have a deterministic order (latest = most recent of both).
const readingOrder = [asc(biomarkerReadings.measuredAt), asc(biomarkerReadings.createdAt)];

/**
 * Collapse duplicate readings that share the same report date AND value — the
 * case where the same report (or an overlapping panel) was uploaded twice as
 * separate documents. Same date with a *different* value is kept (real change).
 * Input must be ascending; the most recently ingested duplicate wins.
 */
function dedupe(rows: BiomarkerReadingRow[]): BiomarkerReadingRow[] {
  const map = new Map<string, BiomarkerReadingRow>();
  for (const r of rows) map.set(`${r.measuredAt}|${r.value}`, r);
  return [...map.values()].sort((a, b) =>
    a.measuredAt < b.measuredAt
      ? -1
      : a.measuredAt > b.measuredAt
        ? 1
        : a.createdAt.getTime() - b.createdAt.getTime()
  );
}

const summaryFromLatest = (rows: BiomarkerReadingRow[]) => {
  const latest = rows[rows.length - 1]; // rows are ascending by measuredAt
  return {
    code: latest.code,
    name: latest.name,
    value: latest.value,
    unit: latest.unit,
    refLow: latest.refLow,
    refHigh: latest.refHigh,
    status: classifyStatus(latest.value, latest.refLow, latest.refHigh),
    measuredAt: latest.measuredAt,
    count: rows.length,
  };
};

/** Serialize a row into the client-facing BiomarkerReading shape (always includes id). */
function serializeReading(r: BiomarkerReadingRow) {
  return {
    id: r.id,
    userId: r.userId,
    documentId: r.documentId,
    code: r.code,
    name: r.name,
    value: r.value,
    unit: r.unit,
    refLow: r.refLow,
    refHigh: r.refHigh,
    measuredAt: r.measuredAt,
  };
}

/**
 * GET /biomarkers?profileId=...
 * Latest reading per biomarker for a profile (the Home list/grid).
 *
 * GET /biomarkers?profileId=...&documentId=...
 * All readings extracted from a specific document, sorted by name.
 * Used by the document detail review/edit card.
 */
router.get(
  '/',
  validate(listSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { documentId } = req.query as { documentId?: string };

      // ── Document-scoped: return all readings for that one document ────────────
      if (documentId) {
        const rows = await db.query.biomarkerReadings.findMany({
          where: and(
            eq(biomarkerReadings.userId, userId),
            eq(biomarkerReadings.documentId, documentId),
          ),
          orderBy: [asc(biomarkerReadings.name)],
        });
        res.status(200).json({
          status: 'success',
          data: { readings: rows.map(serializeReading) },
        });
        return;
      }

      // ── User-wide summary (Home list/grid) ────────────────────────────────────
      const rows = await db.query.biomarkerReadings.findMany({
        where: eq(biomarkerReadings.userId, userId),
        orderBy: readingOrder,
      });

      const byCode = new Map<string, BiomarkerReadingRow[]>();
      for (const r of rows) {
        const arr = byCode.get(r.code) ?? [];
        arr.push(r);
        byCode.set(r.code, arr);
      }

      const biomarkersList = [...byCode.values()]
        .map((arr) => summaryFromLatest(dedupe(arr)))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.status(200).json({ status: 'success', data: { biomarkers: biomarkersList } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /biomarkers/:code?profileId=...
 * Detail for one biomarker: latest value, reference range, delta, full history.
 */
router.get(
  '/:code',
  validate(detailSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { code } = req.params as { code: string };

      const rawRows = await db.query.biomarkerReadings.findMany({
        where: and(eq(biomarkerReadings.userId, userId), eq(biomarkerReadings.code, code)),
        orderBy: readingOrder,
      });

      if (rawRows.length === 0) {
        res.status(404).json({ status: 'error', message: 'No readings found for this biomarker' });
        return;
      }

      const rows = dedupe(rawRows);
      const latest = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;

      const detail = {
        ...summaryFromLatest(rows),
        delta: prev ? Number((latest.value - prev.value).toFixed(2)) : null,
        history: rows.map((r) => ({
          value: r.value,
          measuredAt: r.measuredAt,
          documentId: r.documentId,
          refLow: r.refLow,
          refHigh: r.refHigh,
          status: classifyStatus(r.value, r.refLow, r.refHigh),
        })),
      };

      res.status(200).json({ status: 'success', data: detail });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /biomarkers/:readingId
 * Correct a single extracted biomarker reading: value, refLow, refHigh.
 * Ownership is verified via the reading's own profileId.
 */
router.patch(
  '/:readingId',
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser!.id;
      const { readingId } = req.params as { readingId: string };
      const { value, refLow, refHigh } = req.body as {
        value: number;
        refLow: number | null;
        refHigh: number | null;
      };

      // Load the reading and verify ownership directly via its userId.
      const existing = await db.query.biomarkerReadings.findFirst({
        where: and(eq(biomarkerReadings.id, readingId), eq(biomarkerReadings.userId, userId)),
      });
      if (!existing) {
        res.status(404).json({ status: 'error', message: 'Reading not found' });
        return;
      }

      const [updated] = await db
        .update(biomarkerReadings)
        .set({ value, refLow, refHigh })
        .where(eq(biomarkerReadings.id, readingId))
        .returning();

      logAudit({
        userId,
        action: 'update_biomarker_reading',
        documentIds: [existing.documentId],
        metadata: { readingId, code: existing.code, value, refLow, refHigh },
        req,
      });

      res.status(200).json({ status: 'success', data: serializeReading(updated) });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
