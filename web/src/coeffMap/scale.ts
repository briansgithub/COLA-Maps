/**
 * Salary / coefficient scaling helpers.
 *
 * Spatial coefficients are cross-sectional (median metro = 1.00 at survey year).
 * They are NOT time-indexed to Jan 1995. Combine with the inflation app's time
 * coefficient separately — see docs/COEFFICIENTS.md.
 *
 * Core salary formula (same grain, same index):
 *   salary_B = salary_A * coef_B / coef_A
 */

import type { CoeffIndex, CoeffRecord } from './types';
import { COEF_FIELD } from './types';

/** US-average BEA RPP index level (official national reference). */
export const US_AVERAGE_BEA_RPP = 100;

/** Median metro BEA all-items RPP used as coefficient denominator. */
export const MEDIAN_METRO_BEA_RPP = 93.537;

/**
 * Convert a median-metro-based coefficient to a US-average base
 * (BEA RPP 100 → 1.00). Only meaningful for BEA / OUSEA all-items coefs.
 *
 *   coef_us = coef_median * (93.537 / 100) = RPP / 100
 */
export function toUsAverageBase(
  coefMedianMetro: number,
  medianRpp: number = MEDIAN_METRO_BEA_RPP,
  usAverageRpp: number = US_AVERAGE_BEA_RPP,
): number {
  return (coefMedianMetro * medianRpp) / usAverageRpp;
}

/**
 * Rebase a coefficient so that `referenceCoef` becomes 1.00.
 * Useful for "relative to Huntsville" style views.
 *
 *   coef_rebased = coef / referenceCoef
 */
export function toReferencePlaceBase(
  coef: number,
  referenceCoef: number,
): number {
  if (referenceCoef === 0 || !Number.isFinite(referenceCoef)) {
    throw new Error('referenceCoef must be a finite non-zero number');
  }
  return coef / referenceCoef;
}

/**
 * Scale a salary from place A to place B using coefficients on the same index/grain.
 * Prefer BEA for purchasing-power comparisons.
 */
export function scaleSalary(
  salaryA: number,
  coefA: number,
  coefB: number,
): number {
  if (coefA === 0 || !Number.isFinite(coefA) || !Number.isFinite(coefB)) {
    throw new Error('coefA and coefB must be finite; coefA must be non-zero');
  }
  return salaryA * (coefB / coefA);
}

/** Look up a coefficient field on a record for an index. */
export function getCoef(
  record: CoeffRecord | null | undefined,
  index: CoeffIndex = 'bea',
): number | null {
  if (!record) return null;
  const field = COEF_FIELD[index];
  const v = record[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Combine a spatial coefficient with a time coefficient from the inflation app.
 *
 * The inflation app uses Jan 1995 = 1.00. Spatial coefs use median metro = 1.00
 * at their survey year (~2024 for BEA). This helper only multiplies the two;
 * it does NOT invent CPI numbers — pass them from inflation.json.
 *
 *   value(place, month) =
 *     base_value * timeCoef(month) * (coef(place) / coef(refPlace))
 *
 * where timeCoef(month) = CPI(month) / CPI(Jan1995) from the inflation app.
 */
export function combineSpatialAndTemporal(args: {
  baseValue: number;
  /** CPI(month)/CPI(Jan1995) from inflation.json — caller supplies. */
  timeCoef: number;
  spatialCoef: number;
  referenceSpatialCoef?: number;
}): number {
  const ref = args.referenceSpatialCoef ?? 1;
  if (ref === 0 || !Number.isFinite(ref)) {
    throw new Error('referenceSpatialCoef must be finite and non-zero');
  }
  return args.baseValue * args.timeCoef * (args.spatialCoef / ref);
}

/**
 * Given a raw BEA RPP (US=100), return the median-metro coefficient.
 * coef = rpp / 93.537
 */
export function rppToMedianCoef(
  rpp: number,
  medianRpp: number = MEDIAN_METRO_BEA_RPP,
): number {
  return rpp / medianRpp;
}

/**
 * Given a median-metro coefficient, recover approximate RPP (US=100 scale).
 */
export function medianCoefToRpp(
  coef: number,
  medianRpp: number = MEDIAN_METRO_BEA_RPP,
): number {
  return coef * medianRpp;
}
