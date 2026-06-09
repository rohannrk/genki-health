import { describe, it, expect } from 'vitest';
import { canonicalizeUnit, normUnit } from './biomarker-units';

describe('normUnit', () => {
  it('lowercases, strips spaces, and maps µ→u', () => {
    expect(normUnit('mg/dL')).toBe('mg/dl');
    expect(normUnit('nmol / L')).toBe('nmol/l');
    expect(normUnit('µmol/L')).toBe('umol/l');
  });
});

describe('canonicalizeUnit', () => {
  it('converts Vitamin D nmol/L → ng/mL', () => {
    const r = canonicalizeUnit('vitamin_d', 82, 'nmol/L', 75, 250);
    expect(r.unit).toBe('ng/mL');
    expect(r.value).toBeCloseTo(32.85, 1);
    expect(r.refLow).toBeCloseTo(30.05, 1);
    expect(r.refHigh).toBeCloseTo(100.15, 1);
  });

  it('normalizes the canonical unit label and leaves the value unchanged', () => {
    const r = canonicalizeUnit('vitamin_d', 33, 'ng/ml', 30, 100);
    expect(r.unit).toBe('ng/mL');
    expect(r.value).toBe(33);
  });

  it('converts glucose mmol/L → mg/dL', () => {
    const r = canonicalizeUnit('glucose', 5, 'mmol/L', 3.9, 5.5);
    expect(r.unit).toBe('mg/dL');
    expect(r.value).toBeCloseTo(90.1, 1);
    expect(r.refHigh).toBeCloseTo(99.1, 1);
  });

  it('converts LDL mmol/L → mg/dL', () => {
    const r = canonicalizeUnit('ldl', 3, 'mmol/L', null, 2.6);
    expect(r.value).toBeCloseTo(116.0, 0);
    expect(r.refLow).toBeNull();
    expect(r.refHigh).toBeCloseTo(100.5, 0);
  });

  it('converts HbA1c IFCC mmol/mol → NGSP % (affine)', () => {
    const r = canonicalizeUnit('hba1c', 53, 'mmol/mol', null, null);
    expect(r.unit).toBe('%');
    expect(r.value).toBeCloseTo(7.0, 1);
  });

  it('converts creatinine µmol/L → mg/dL', () => {
    const r = canonicalizeUnit('creatinine', 88.42, 'µmol/L', null, null);
    expect(r.value).toBeCloseTo(1.0, 1);
  });

  it('converts hemoglobin g/L → g/dL', () => {
    const r = canonicalizeUnit('hemoglobin', 160, 'g/L', 135, 180);
    expect(r.value).toBeCloseTo(16, 5);
    expect(r.refLow).toBeCloseTo(13.5, 5);
  });

  it('converts B12 pmol/L → pg/mL', () => {
    const r = canonicalizeUnit('vitamin_b12', 148, 'pmol/L', null, null);
    expect(r.value).toBeCloseTo(200.6, 0);
  });

  it('passes through when the unit is unrecognized for the biomarker', () => {
    const r = canonicalizeUnit('vitamin_d', 33, 'made-up', 30, 100);
    expect(r).toEqual({ value: 33, unit: 'made-up', refLow: 30, refHigh: 100 });
  });

  it('passes through for an unknown biomarker code', () => {
    const r = canonicalizeUnit('mystery', 7, 'mg/dL', 1, 10);
    expect(r).toEqual({ value: 7, unit: 'mg/dL', refLow: 1, refHigh: 10 });
  });

  it('passes through when the unit is blank', () => {
    const r = canonicalizeUnit('glucose', 90, '', null, null);
    expect(r).toEqual({ value: 90, unit: '', refLow: null, refHigh: null });
  });
});
