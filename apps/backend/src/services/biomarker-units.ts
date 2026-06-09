/**
 * Unit canonicalization for biomarker readings.
 *
 * Different labs report the same test in different units (Vitamin D in ng/mL
 * vs nmol/L, glucose in mg/dL vs mmol/L, …). To keep a single coherent trend
 * per biomarker, every reading is converted to ONE canonical unit before it is
 * stored. Conversions are linear: canonicalValue = m * value + b (b ≠ 0 only
 * for affine cases like HbA1c IFCC↔NGSP).
 *
 * Pure module — no DB imports — so it is cheap to unit-test.
 */

type LinearTransform = { m: number; b?: number };

interface UnitRule {
  canonical: string;
  /** normalized-unit → transform into the canonical unit */
  conversions: Record<string, LinearTransform>;
}

// Shared rule for the lipid panel (all mg/dL canonical; mmol/L ×38.67).
const lipidRule: UnitRule = {
  canonical: 'mg/dL',
  conversions: {
    'mg/dl': { m: 1 },
    'mmol/l': { m: 38.67 },
  },
};

const UNIT_RULES: Record<string, UnitRule> = {
  vitamin_d: {
    canonical: 'ng/mL',
    conversions: {
      'ng/ml': { m: 1 },
      'nmol/l': { m: 0.4006 }, // 1 ng/mL = 2.496 nmol/L
    },
  },
  glucose: {
    canonical: 'mg/dL',
    conversions: {
      'mg/dl': { m: 1 },
      'mmol/l': { m: 18.0182 },
    },
  },
  cholesterol_total: lipidRule,
  ldl: lipidRule,
  hdl: lipidRule,
  triglycerides: {
    canonical: 'mg/dL',
    conversions: {
      'mg/dl': { m: 1 },
      'mmol/l': { m: 88.57 },
    },
  },
  creatinine: {
    canonical: 'mg/dL',
    conversions: {
      'mg/dl': { m: 1 },
      'umol/l': { m: 0.011312 }, // 1 mg/dL = 88.42 µmol/L
    },
  },
  hemoglobin: {
    canonical: 'g/dL',
    conversions: {
      'g/dl': { m: 1 },
      'g/l': { m: 0.1 },
      'mmol/l': { m: 1.611 },
    },
  },
  hba1c: {
    canonical: '%',
    conversions: {
      '%': { m: 1 },
      'mmol/mol': { m: 1 / 10.929, b: 2.15 }, // IFCC → NGSP %
    },
  },
  vitamin_b12: {
    canonical: 'pg/mL',
    conversions: {
      'pg/ml': { m: 1 },
      'pmol/l': { m: 1.3554 }, // 1 pg/mL = 0.7378 pmol/L
    },
  },
};

/** Normalize a unit string for matching: lowercase, µ→u, strip spaces. */
export function normUnit(u: string): string {
  return u
    .toLowerCase()
    .replace(/µ|μ/g, 'u')
    .replace(/\s+/g, '')
    .trim();
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

export interface Canonicalized {
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
}

/**
 * Convert a reading (value + reference range) into the biomarker's canonical
 * unit. Returns the input unchanged when the biomarker has no rule, the unit is
 * blank, or the unit isn't recognized for that biomarker (so we never apply a
 * wrong factor — better to keep the raw value than corrupt it).
 */
export function canonicalizeUnit(
  code: string,
  value: number,
  unit: string,
  refLow: number | null,
  refHigh: number | null
): Canonicalized {
  const rule = UNIT_RULES[code];
  if (!rule || !unit) return { value, unit, refLow, refHigh };

  const conv = rule.conversions[normUnit(unit)];
  if (!conv) return { value, unit, refLow, refHigh };

  const apply = (v: number | null): number | null =>
    v == null ? null : round4(conv.m * v + (conv.b ?? 0));

  return {
    value: apply(value) as number,
    unit: rule.canonical,
    refLow: apply(refLow),
    refHigh: apply(refHigh),
  };
}
