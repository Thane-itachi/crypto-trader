import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle } from '../../types';
import { fmtPrice } from '../../lib/format';

const UP = '#10b981';
const DOWN = '#f43f5e';
const MUTED = 'rgb(125 137 148)';
const LINE = 'rgb(51 65 85)';
const FONT = '10px "JetBrains Mono", monospace';

const PAD = { top: 12, right: 60, bottom: 20, left: 8 };

/**
 * A Kagi column: one vertical stroke between two reversal points.
 * `breakout` marks a yang (thick) line — the column pushed past the previous
 * same-direction extreme; thin lines are yin.
 */
interface KagiColumn {
  up: boolean;
  top: number;
  bottom: number;
  tStart: number;
  tEnd: number;
  breakout: boolean;
}

/**
 * Classic Kagi construction from candle closes: the line only changes
 * direction when price moves against the trend by more than `reversalPct`.
 * Time is irrelevant to the shape — x positions are just column order.
 */
function buildKagi(candles: Candle[], reversalPct: number): KagiColumn[] {
  const r = reversalPct / 100;
  const cols: KagiColumn[] = [];
  let dir: 1 | -1 | 0 = 0;
  const start = candles[0].c;
  let lastHigh = -Infinity; // top of the strongest prior up column
  let lastLow = Infinity; // bottom of the lowest prior down column
  let col: KagiColumn | null = null;

  for (const c of candles) {
    const p = c.c;
    if (dir === 0) {
      if (p >= start * (1 + r)) {
        dir = 1;
        col = { up: true, top: p, bottom: start, tStart: c.t, tEnd: c.t, breakout: true };
        cols.push(col);
        lastHigh = p;
      } else if (p <= start * (1 - r)) {
        dir = -1;
        col = { up: false, top: start, bottom: p, tStart: c.t, tEnd: c.t, breakout: true };
        cols.push(col);
        lastLow = p;
      }
    } else if (dir === 1 && col) {
      if (p > col.top) {
        col.top = p;
        col.tEnd = c.t;
        if (p > lastHigh) {
          col.breakout = true;
          lastHigh = p;
        }
      } else if (p <= col.top * (1 - r)) {
        const top: number = col.top;
        dir = -1;
        col = { up: false, top, bottom: p, tStart: c.t, tEnd: c.t, breakout: p < lastLow };
        if (p < lastLow) lastLow = p;
        cols.push(col);
      }
    } else if (dir === -1 && col) {
      if (p < col.bottom) {
        col.bottom = p;
        col.tEnd = c.t;
        if (p < lastLow) {
          col.breakout = true;
          lastLow = p;
        }
      } else if (p >= col.bottom * (1 + r)) {
        const btm: number = col.bottom;
        dir = 1;
        col = { up: true, top: p, bottom: btm, tStart: c.t, tEnd: c.t, breakout: p > lastHigh };
        if (p > lastHigh) lastHigh = p;
        cols.push(col);
      }
    }
  }
  return cols;
}

interface Props {
  candles: Candle[];
  height: number;
  reversalPct: number;
}

export default function KagiChart({ candles, height, reversalPct }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const cols = useMemo(() => buildKagi(candles, reversalPct), [candles, reversalPct]);

  const geo = useMemo(() => {
    if (!cols.length || !width) return null;
    let lo = Math.min(...cols.map((c) => c.bottom));
    let hi = Math.max(...cols.map((c) => c.top));
    const span = hi - lo || Math.abs(hi) * 0.01 || 1;
    lo -= span * 0.08;
    hi += span * 0.08;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const slot = plotW / cols.length;
    const x = (i: number) => PAD.left + slot * i + slot / 2;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    return { lo, hi, plotW, plotH, slot, x, y };
  }, [cols, width, height]);

  const grid = useMemo(() => {
    if (!geo) return [];
    const rows = 5;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const v = geo.lo + ((geo.hi - geo.lo) * i) / rows;
      return { v, y: geo.y(v) };
    });
  }, [geo]);

  const xLabels = useMemo(() => {
    if (!geo || !cols.length) return [];
    const count = Math.min(6, cols.length);
    const step = Math.max(1, Math.floor((cols.length - 1) / (count - 1 || 1)));
    const idxs: number[] = [];
    for (let i = 0; i < cols.length && idxs.length < count; i += step) idxs.push(i);
    return idxs.map((i) => ({
      i,
      label: new Date(cols[i].tStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      x: geo.x(i),
    }));
  }, [geo, cols]);

  if (!candles.length) return <div ref={wrapRef} style={{ height }} />;

  const hovered = hover !== null ? cols[hover] : null;

  return (
    <div ref={wrapRef} className="relative select-none" style={{ height }}>
      {cols.length < 2 && (
        <p className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-muted">
          Not enough price movement for a Kagi line at {reversalPct}% reversal — lower it or pick a longer range.
        </p>
      )}
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          if (!geo) return;
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left - PAD.left) / geo.slot);
          setHover(i >= 0 && i < cols.length ? i : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* horizontal grid + price labels */}
        {grid.map((g, i) => (
          <g key={`g-${i}`}>
            <line x1={PAD.left} x2={PAD.left + (geo?.plotW ?? 0)} y1={g.y} y2={g.y} stroke={LINE} strokeOpacity={0.35} strokeDasharray="2 4" />
            <text x={PAD.left + (geo?.plotW ?? 0) + 6} y={g.y + 3} fill={MUTED} fontSize={10} fontFamily={FONT}>
              {fmtPrice(g.v)}
            </text>
          </g>
        ))}

        {/* x-axis labels */}
        {xLabels.map((l) => (
          <text key={`x-${l.i}`} x={l.x} y={height - 6} textAnchor="middle" fill={MUTED} fontSize={10} fontFamily={FONT}>
            {l.label}
          </text>
        ))}

        {/* kagi columns + reversal connectors */}
        {geo &&
          cols.map((c, i) => {
            const cx = geo.x(i);
            const color = c.up ? UP : DOWN;
            const sw = c.breakout ? 3.5 : 1.6;
            const isHover = hover === i;
            const lastY = geo.y(c.up ? c.top : c.bottom);
            return (
              <g key={`k-${i}`} opacity={hover !== null && !isHover ? 0.55 : 1}>
                <line x1={cx} x2={cx} y1={geo.y(c.top)} y2={geo.y(c.bottom)} stroke={color} strokeWidth={sw} strokeLinecap="round" />
                {i < cols.length - 1 && (
                  <line x1={cx} x2={geo.x(i + 1)} y1={lastY} y2={lastY} stroke={color} strokeWidth={1.2} strokeOpacity={0.7} />
                )}
              </g>
            );
          })}

        {/* last price line */}
        {geo && cols.length > 0 && (() => {
          const last = cols[cols.length - 1];
          const ly = geo.y(last.up ? last.top : last.bottom);
          return (
            <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={ly} y2={ly} stroke={MUTED} strokeDasharray="3 3" strokeOpacity={0.5} />
          );
        })()}

        {/* hover crosshair */}
        {hovered && geo && (
          <line x1={geo.x(hover!)} x2={geo.x(hover!)} y1={PAD.top} y2={PAD.top + geo.plotH} stroke={MUTED} strokeOpacity={0.5} strokeDasharray="3 3" />
        )}
      </svg>

      {hovered && geo && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[170px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(geo.x(hover!) - 80, 4), Math.max(width - 174, 4)) }}
        >
          <p className="text-muted">
            {new Date(hovered.tStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' → '}
            {new Date(hovered.tEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono">
            <span className="text-muted">
              from <span className="text-txt">{fmtPrice(hovered.up ? hovered.bottom : hovered.top)}</span>
            </span>
            <span className="text-muted">
              to <span className={hovered.up ? 'text-up' : 'text-down'}>{fmtPrice(hovered.up ? hovered.top : hovered.bottom)}</span>
            </span>
          </div>
          <p className="mt-1 font-mono font-bold">
            <span className={hovered.up ? 'text-up' : 'text-down'}>
              {hovered.up ? '+' : ''}
              {((hovered.top / hovered.bottom - 1) * 100).toFixed(2)}%
            </span>
            <span className="ml-1.5 font-sans text-[10px] font-semibold text-muted">
              {hovered.breakout ? 'yang (breakout)' : 'yin'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
