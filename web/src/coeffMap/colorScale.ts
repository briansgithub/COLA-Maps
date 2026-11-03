/**
 * Diverging color scale around 1.00.
 * Ledger palette: teal below 1, near-neutral at 1, copper above 1.
 * No purple gradients, no cream/terracotta.
 */

import type { CoeffTheme } from './types';
import { DEFAULT_THEME } from './types';

export interface ScaleDomain {
  lo: number;
  hi: number;
  min: number;
  max: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const t0 = Math.max(0, Math.min(1, t));
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(
    A[0] + (B[0] - A[0]) * t0,
    A[1] + (B[1] - A[1]) * t0,
    A[2] + (B[2] - A[2]) * t0,
  );
}

/** Build a robust domain from values, always centering 1.00. */
export function computeDomain(values: number[]): ScaleDomain {
  const vals = values.filter((v) => Number.isFinite(v));
  if (!vals.length) return { lo: 0.85, hi: 1.15, min: 0.85, max: 1.15 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  // Use percentiles-ish clamp via sorted ends to avoid outliers dominating
  const sorted = [...vals].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? min;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95))] ?? max;
  const span = Math.max(1 - p5, p95 - 1, 0.05);
  const lo = Math.max(0.5, 1 - span);
  const hi = Math.min(2.5, 1 + span);
  return { lo, hi, min, max };
}

export function colorForCoef(
  value: number | null | undefined,
  domain: ScaleDomain,
  theme: CoeffTheme = {},
): string {
  const t = { ...DEFAULT_THEME, ...theme };
  if (value == null || !Number.isFinite(value)) return t.missing;
  if (value < 1) {
    const u = (value - domain.lo) / (1 - domain.lo || 1);
    // deep teal -> light teal/slate near 1
    return lerpHex(t.tealLow, t.neutral, Math.max(0, Math.min(1, u)));
  }
  const u = (value - 1) / (domain.hi - 1 || 1);
  return lerpHex(t.neutral, t.copperHigh, Math.max(0, Math.min(1, u)));
}

/** CSS linear-gradient string for the legend bar. */
export function legendGradient(
  domain: ScaleDomain,
  theme: CoeffTheme = {},
  steps = 24,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const v =
      t < 0.5
        ? domain.lo + (1 - domain.lo) * (t / 0.5)
        : 1 + (domain.hi - 1) * ((t - 0.5) / 0.5);
    parts.push(`${colorForCoef(v, domain, theme)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
