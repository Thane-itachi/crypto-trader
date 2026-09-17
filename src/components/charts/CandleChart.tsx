import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, ChartRange } from '../../types';
import { fmtPrice } from '../../lib/format';

const UP = '#34d399';
const DOWN = '#fb7185';
const MUTED = 'rgb(125 137 148)';
const LINE = 'rgb(51 65 85)';
const FONT = '10px "JetBrains Mono", monospace';

interface Props {
  candles: Candle[];
  height: number;
  range: ChartRange;
}

function fmtTick(t: number, range: ChartRange): string {
  const d = new Date(t);
  return range === '5m' || range === '15m' || range === '1H' || range === '1D'
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Hand-rolled SVG candlestick chart: true OHLC candles, crosshair + tooltip,
 * responsive via ResizeObserver, touch-friendly. Renders nothing until the
 * container has a measured width.
 */
export default function CandleChart({ candles, height, range }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 10, right: 60, bottom: 20, left: 8 };

  const geo = useMemo(() => {
    if (!candles.length || width <= PAD.left + PAD.right + 40) return null;
    const lows = candles.map((c) => c.l);
    const highs = candles.map((c) => c.h);
    let lo = Math.min(...lows);
    let hi = Math.max(...highs);
    const span = hi - lo || Math.abs(hi) * 0.01 || 1;
    const pad = span * 0.08;
    lo -= pad;
    hi += pad;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const slot = plotW / candles.length;
    const bodyW = Math.max(1.5, Math.min(slot * 0.62, 14));
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const x = (i: number) => PAD.left + slot * i + slot / 2;
    return { lo, hi, plotW, plotH, slot, bodyW, y, x };
  }, [candles, width, height]);

  const grid = useMemo(() => {
    if (!geo) return [];
    const rows = 5;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const v = geo.lo + ((geo.hi - geo.lo) * i) / rows;
      return { v, y: geo.y(v) };
    });
  }, [geo]);

  const xLabels = useMemo(() => {
    if (!geo || !candles.length) return [];
    const count = Math.min(6, candles.length);
    const step = Math.max(1, Math.floor((candles.length - 1) / (count - 1 || 1)));
    const idxs: number[] = [];
    for (let i = 0; i < candles.length && idxs.length < count; i += step) idxs.push(i);
    return idxs.map((i) => ({ i, label: fmtTick(candles[i].t, range), x: geo.x(i) }));
  }, [geo, candles, range]);

  const hovered = hover !== null ? candles[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !candles.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.floor((px - PAD.left) / geo.slot);
    setHover(i >= 0 && i < candles.length ? i : null);
  };

  if (!geo) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />;
  }

  const tooltipLeft = hovered
    ? Math.min(Math.max(geo.x(hover!) - 70, 4), Math.max(width - 152, 4))
    : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="block touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* horizontal grid + price labels */}
        {grid.map((g, i) => (
          <g key={`g-${i}`}>
            <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={g.y} y2={g.y} stroke={LINE} strokeOpacity={0.35} strokeDasharray="2 4" />
            <text x={PAD.left + geo.plotW + 6} y={g.y + 3} fill={MUTED} fontFamily={FONT}>
              {g.v >= 1000 ? `${(g.v / 1000).toFixed(1)}k` : g.v >= 1 ? g.v.toFixed(2) : g.v.toPrecision(3)}
            </text>
          </g>
        ))}

        {/* time labels */}
        {xLabels.map((l) => (
          <text key={`x-${l.i}`} x={Math.min(l.x, PAD.left + geo.plotW - 18)} y={height - 6} fill={MUTED} fontFamily={FONT} textAnchor="middle">
            {l.label}
          </text>
        ))}

        {/* crosshair */}
        {hovered && (
          <line
            x1={geo.x(hover!)}
            x2={geo.x(hover!)}
            y1={PAD.top}
            y2={PAD.top + geo.plotH}
            stroke={MUTED}
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />
        )}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? UP : DOWN;
          const cx = geo.x(i);
          const isHover = hover === i;
          return (
            <g key={`c-${c.t}-${i}`} opacity={hover !== null && !isHover ? 0.55 : 1}>
              <line x1={cx} x2={cx} y1={geo.y(c.h)} y2={geo.y(c.l)} stroke={color} strokeWidth={1} />
              <rect
                x={cx - geo.bodyW / 2}
                y={Math.min(geo.y(c.o), geo.y(c.c))}
                width={geo.bodyW}
                height={Math.max(1, Math.abs(geo.y(c.o) - geo.y(c.c)))}
                fill={color}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[148px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipLeft }}
        >
          <p className="text-muted">{new Date(hovered.t).toLocaleString('en-US')}</p>
          <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono">
            <span className="text-muted">O <span className="text-txt">{fmtPrice(hovered.o)}</span></span>
            <span className="text-muted">H <span className="text-up">{fmtPrice(hovered.h)}</span></span>
            <span className="text-muted">L <span className="text-down">{fmtPrice(hovered.l)}</span></span>
            <span className="text-muted">C <span className="text-txt">{fmtPrice(hovered.c)}</span></span>
          </div>
          <p className={`mt-1 font-mono font-bold ${hovered.c >= hovered.o ? 'text-up' : 'text-down'}`}>
            {hovered.c >= hovered.o ? '+' : ''}
            {(((hovered.c - hovered.o) / hovered.o) * 100).toFixed(2)}%
          </p>
        </div>
      )}
    </div>
  );
}
