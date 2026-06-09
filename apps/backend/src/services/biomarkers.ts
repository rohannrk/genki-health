import { eq } from 'drizzle-orm';
import { db } from '../db';
import { biomarkerReadings } from '../db/schema/biomarkers';
import { canonicalizeUnit } from './biomarker-units';

export type BiomarkerStatus = 'low' | 'in' | 'high' | 'unknown';

/** Raw biomarker entry as returned by the document-parsing LLM. */
export interface RawBiomarker {
  name?: unknown;
  value?: unknown;
  unit?: unknown;
  refLow?: unknown;
  refHigh?: unknown;
  /** Some models return a single string like "13.5 - 18" instead of low/high. */
  referenceRange?: unknown;
}

/**
 * Common synonyms → canonical code + display name. Keeps the same lab test
 * collapsed into one trend even when reports label it differently.
 */
const ALIASES: Record<string, { code: string; name: string }> = {
  hemoglobin: { code: 'hemoglobin', name: 'Hemoglobin' },
  haemoglobin: { code: 'hemoglobin', name: 'Hemoglobin' },
  hb: { code: 'hemoglobin', name: 'Hemoglobin' },
  hgb: { code: 'hemoglobin', name: 'Hemoglobin' },
  glucose: { code: 'glucose', name: 'Glucose' },
  'fasting glucose': { code: 'glucose', name: 'Glucose (Fasting)' },
  'blood glucose': { code: 'glucose', name: 'Glucose' },
  hba1c: { code: 'hba1c', name: 'HbA1c' },
  'hemoglobin a1c': { code: 'hba1c', name: 'HbA1c' },
  cholesterol: { code: 'cholesterol_total', name: 'Total Cholesterol' },
  'total cholesterol': { code: 'cholesterol_total', name: 'Total Cholesterol' },
  ldl: { code: 'ldl', name: 'LDL Cholesterol' },
  'ldl cholesterol': { code: 'ldl', name: 'LDL Cholesterol' },
  hdl: { code: 'hdl', name: 'HDL Cholesterol' },
  'hdl cholesterol': { code: 'hdl', name: 'HDL Cholesterol' },
  triglycerides: { code: 'triglycerides', name: 'Triglycerides' },
  creatinine: { code: 'creatinine', name: 'Creatinine' },
  tsh: { code: 'tsh', name: 'TSH' },
  'vitamin d': { code: 'vitamin_d', name: 'Vitamin D' },
  '25-hydroxyvitamin d': { code: 'vitamin_d', name: 'Vitamin D' },
  'vitamin b12': { code: 'vitamin_b12', name: 'Vitamin B12' },
  wbc: { code: 'wbc', name: 'White Blood Cells' },
  'white blood cell count': { code: 'wbc', name: 'White Blood Cells' },
  rbc: { code: 'rbc', name: 'Red Blood Cells' },
  platelets: { code: 'platelets', name: 'Platelets' },
  'platelet count': { code: 'platelets', name: 'Platelets' },
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Resolve a free-text test name to a stable { code, name }. */
export function normalizeBiomarker(rawName: string): { code: string; name: string } {
  const key = rawName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (ALIASES[key]) return ALIASES[key];
  const code = slug(rawName);
  return { code: code || 'unknown', name: titleCase(rawName.trim()) };
}

/** Coerce a possibly-stringy numeric value to a finite number, or null. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const m = v.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (m) {
      const n = parseFloat(m[0]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

/** Parse a "13.5 - 18" / "<200" / "13.5–18" style range string. */
function parseRange(v: unknown): { low: number | null; high: number | null } {
  if (typeof v !== 'string') return { low: null, high: null };
  const nums = v.match(/-?\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return { low: null, high: null };
  if (nums.length === 1) {
    // "<200" → high only; ">40" → low only.
    if (/[<≤]/.test(v)) return { low: null, high: parseFloat(nums[0]) };
    if (/[>≥]/.test(v)) return { low: parseFloat(nums[0]), high: null };
    return { low: null, high: parseFloat(nums[0]) };
  }
  return { low: parseFloat(nums[0]), high: parseFloat(nums[1]) };
}

/** Classify a value against its reference range. */
export function classifyStatus(
  value: number,
  refLow: number | null,
  refHigh: number | null
): BiomarkerStatus {
  if (refLow != null && value < refLow) return 'low';
  if (refHigh != null && value > refHigh) return 'high';
  if (refLow == null && refHigh == null) return 'unknown';
  return 'in';
}

/**
 * Replace the biomarker readings for a document with a freshly-extracted set.
 * Idempotent on re-ingestion (deletes prior rows for this document first).
 * Invalid entries (no name / no numeric value) are skipped.
 */
export async function saveBiomarkerReadings(
  documentId: string,
  profileId: string,
  measuredAt: string,
  raw: RawBiomarker[]
): Promise<number> {
  await db.delete(biomarkerReadings).where(eq(biomarkerReadings.documentId, documentId));

  if (!Array.isArray(raw) || raw.length === 0) return 0;

  const rows = raw
    .map((b) => {
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      const value = num(b.value);
      if (!name || value == null) return null;

      let low = num(b.refLow);
      let high = num(b.refHigh);
      if (low == null && high == null && b.referenceRange) {
        const r = parseRange(b.referenceRange);
        low = r.low;
        high = r.high;
      }

      const { code, name: displayName } = normalizeBiomarker(name);
      const rawUnit = typeof b.unit === 'string' ? b.unit.trim() : '';

      // Convert value + reference range into the biomarker's canonical unit so
      // readings from different labs share one comparable trend.
      const canon = canonicalizeUnit(code, value, rawUnit, low, high);

      return {
        profileId,
        documentId,
        code,
        name: displayName,
        value: canon.value,
        unit: canon.unit.slice(0, 32),
        refLow: canon.refLow,
        refHigh: canon.refHigh,
        measuredAt,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return 0;
  await db.insert(biomarkerReadings).values(rows);
  return rows.length;
}
