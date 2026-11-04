import type { CSSProperties } from 'react';
import { legendGradient, type ScaleDomain } from './colorScale';
import type { CoeffTheme } from './types';
import { DEFAULT_THEME, INDEX_LABEL, type CoeffIndex } from './types';

export interface LegendProps {
  domain: ScaleDomain;
  index: CoeffIndex;
  theme?: CoeffTheme;
  /** Optional subtitle override */
  subtitle?: string;
  style?: CSSProperties;
}

export function Legend({
  domain,
  index,
  theme,
  subtitle,
  style,
}: LegendProps) {
  const t = { ...DEFAULT_THEME, ...theme };
  const fmt = (v: number) => v.toFixed(2);
  const ticks = [
    domain.lo,
    (domain.lo + 1) / 2,
    1,
    (1 + domain.hi) / 2,
    domain.hi,
  ];

  return (
    <div
      className="coeff-legend"
      style={{
        background: t.surface,
        color: t.text,
        border: `1px solid ${t.stroke}`,
        fontFamily: t.fontFamily,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        <span>{INDEX_LABEL[index]}</span>
        <span className="coeff-legend-subtitle" style={{ color: t.muted, fontWeight: 500 }}>
          {subtitle ?? '1.00 = median metro'}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 99,
          background: legendGradient(domain, t),
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          color: t.muted,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 10,
        }}
      >
        {ticks.map((v, i) => (
          <span
            key={i}
            style={{
              color: v === 1 ? t.text : t.muted,
              fontWeight: v === 1 ? 700 : 400,
            }}
          >
            {domain.min < domain.lo && i === 0 ? '≤' : ''}
            {fmt(v)}
            {domain.max > domain.hi && i === ticks.length - 1 ? '≥' : ''}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 2,
          fontSize: 10,
          color: t.muted,
        }}
      >
        <span style={{ color: t.tealLow }}>cheaper</span>
        <span style={{ color: t.copperHigh }}>costlier</span>
      </div>
    </div>
  );
}

export default Legend;
