import { BiomarkerStatus } from '@genki/types';

export type { BiomarkerStatus };

/** Classify a value against its reference range — mirrors the backend helper. */
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

/** Map a status to its semantic color + label. Green = in range. */
export function statusMeta(status: BiomarkerStatus): {
  color: string;
  tint: string;
  label: string;
} {
  switch (status) {
    case 'in':
      return { color: '#1A3D2B', tint: '#E4F0EA', label: 'In range' };
    case 'high':
      return { color: '#C47E1A', tint: '#FEF3CD', label: 'Above range' };
    case 'low':
      return { color: '#C47E1A', tint: '#FEF3CD', label: 'Below range' };
    default:
      return { color: '#5C6D63', tint: '#F0F7F3', label: 'No reference range' };
  }
}

/**
 * Static "what it does" catalog keyed by normalized biomarker code
 * (matches the backend's `normalizeBiomarker` codes). Descriptions are
 * presentational — the values/ranges/trend all come from the API.
 */
export const BIOMARKER_INFO: Record<string, { about: string; aboutSecondary?: string }> = {
  hemoglobin: {
    about: 'A protein in red blood cells that carries oxygen from your lungs to the rest of your body.',
    aboutSecondary: "Essential for breathing and energy — without it, your cells wouldn't get the oxygen they need.",
  },
  glucose: {
    about: "The main sugar in your blood and your body's primary source of energy.",
    aboutSecondary: 'Consistently high levels can indicate diabetes or prediabetes.',
  },
  hba1c: {
    about: 'Your average blood sugar over the past 2–3 months.',
    aboutSecondary: 'A key marker for diagnosing and monitoring diabetes.',
  },
  cholesterol_total: {
    about: 'The total amount of cholesterol in your blood.',
    aboutSecondary: 'High levels can raise your risk of heart disease.',
  },
  ldl: {
    about: '"Bad" cholesterol that can build up in the walls of your arteries.',
    aboutSecondary: 'Higher levels increase cardiovascular risk.',
  },
  hdl: {
    about: '"Good" cholesterol that helps remove other cholesterol from your blood.',
    aboutSecondary: 'Higher levels are generally protective for your heart.',
  },
  triglycerides: {
    about: 'A type of fat (lipid) in your blood that your body uses for energy.',
    aboutSecondary: 'High levels can contribute to heart disease.',
  },
  creatinine: {
    about: 'A waste product from muscle activity that your kidneys filter out.',
    aboutSecondary: 'Used to assess how well your kidneys are working.',
  },
  tsh: {
    about: 'A hormone that tells your thyroid how much thyroid hormone to make.',
    aboutSecondary: 'Used to check for an underactive or overactive thyroid.',
  },
  vitamin_d: {
    about: 'A vitamin that helps your body absorb calcium for strong bones.',
    aboutSecondary: 'Also supports immune function and mood.',
  },
  vitamin_b12: {
    about: 'A vitamin essential for nerve function and making red blood cells.',
    aboutSecondary: 'Low levels can cause fatigue and anemia.',
  },
  wbc: {
    about: 'White blood cells that help your body fight infection.',
    aboutSecondary: 'Abnormal counts can signal infection or other conditions.',
  },
  rbc: {
    about: 'Red blood cells that carry oxygen throughout your body.',
  },
  platelets: {
    about: 'Tiny cell fragments that help your blood clot.',
    aboutSecondary: 'Important for stopping bleeding after an injury.',
  },
};

export function biomarkerInfo(code: string): { about: string; aboutSecondary?: string } {
  return (
    BIOMARKER_INFO[code] ?? {
      about: 'A measured value from your lab report, tracked over time.',
    }
  );
}

/** Format a numeric biomarker value for display (trim trailing zeros, keep ≤2 dp). */
export function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
