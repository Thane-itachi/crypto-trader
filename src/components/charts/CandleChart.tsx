import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, ChartRange } from '../../types';
import { fmtPrice } from '../../lib/format';

const UP = '#10b981';
const DOWN = '#f43f5e';
const MUTED = 'rgb(125 137 148)';
const LINE = 'rgb(51 65 85)';
const FONT = '10px "JetBrains Mono", monospace';

const MIN_VIS = 8; // smallest zoomed-in window (candles)

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

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Compact volume for the tooltip (1.2K, 3.4M, 890B ...)
const fmtVol = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/**
 * Hand-rolled SVG candlestick chart: true OHLC candles, crosshair + tooltip,
 * responsive via ResizeObserver. Zoomable + pannable — mouse wheel or pinch
 * zooms around the cursor, drag pans through history, buttons in the corner.
 * The viewport stays pinned to the newest candle while zoomed at the live edge.
 */
export default function CandleChart({ candles, height, range }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Viewport state: `vis` = candles visible (null = all), `end` = index of the
  // last visible candle (null = pinned to the live edge).
  const [vis, setVis] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);

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
  const total = candles.length;
  const visN = vis === null ? total : clamp(vis, MIN_VIS, total);
  const endN = end === null ? total - 1 : clamp(end, visN - 1, total - 1);
  const startN = Math.max(0, endN - visN + 1);
  const view = useMemo(() => candles.slice(startN, endN + 1), [candles, startN, endN]);

  const geo = useMemo(() => {
    if (!view.length || width <= PAD.left + PAD.right + 40) return null;
    const lows = view.map((c) => c.l);
    const highs = view.map((c) => c.h);
    let lo = Math.min(...lows);
    let hi = Math.max(...highs);
    const span = hi - lo || Math.abs(hi) * 0.01 || 1;
    const pad = span * 0.08;
    lo -= pad;
    hi += pad;
    const plotW = width - PAD.left - PAD.right;
    const fullH = height - PAD.top - PAD.bottom;
    const hasVol = view.some((c) => typeof c.v === 'number' && c.v > 0);
    const volH = hasVol ? fullH * 0.16 : 0;
    const plotH = fullH - (hasVol ? volH + 6 : 0);
    const maxV = hasVol ? Math.max(...view.map((c) => c.v ?? 0)) : 0;
    const slot = plotW / view.length;
    const bodyW = Math.max(1.2, Math.min(slot * 0.55, 14)); // compact candles, thinner when dense
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const x = (i: number) => PAD.left + slot * i + slot / 2;
    return { lo, hi, plotW, plotH, fullH, hasVol, volH, maxV, slot, bodyW, y, x };
  }, [view, width, height]);

  // Mirror of the current viewport for native (non-React) event handlers.
  const viewRef = useRef({ total, visN, start: startN, slot: geo?.slot ?? 0, plotW: geo?.plotW ?? 0 });
  viewRef.current = { total, visN, start: startN, slot: geo?.slot ?? 0, plotW: geo?.plotW ?? 0 };

  /** Scale the visible window by `scale` (<1 zooms in), anchored at px. */
  const zoomAt = (px: number, scale: number) => {
    const v = viewRef.current;
    if (!v.total || !v.plotW) return;
    const nextVis = clamp(Math.round(v.visN * scale), Math.min(MIN_VIS, v.total), v.total);
    if (nextVis === v.visN) return;
    const f = clamp((px - PAD.left) / v.plotW, 0, 1);
    const anchor = v.start + f * (v.visN - 1);
    let s = Math.round(anchor - f * (nextVis - 1));
    let e = s + nextVis - 1;
    if (e > v.total - 1) {
      e = v.total - 1;
      s = e - nextVis + 1;
    }
    if (s < 0) {
      s = 0;
      e = Math.min(nextVis - 1, v.total - 1);
    }
    setVis(nextVis);
    setEnd(e >= v.total - 1 ? null : e);
  };

  // Mouse wheel = zoom (native listener so we can preventDefault page scroll).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.deltaY > 0 ? 1.25 : 0.8);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the viewport when the range changes (full window again).
  useEffect(() => {
    setVis(null);
    setEnd(null);
  }, [range]);

  // ---- pointer interactions: hover, drag-pan, pinch-zoom ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; end: number } | null>(null);
  const pinchDist = useRef(0);
  const [grabbing, setGrabbing] = useState(false);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, end: endN };
      setGrabbing(true);
    } else {
      drag.current = null;
      const pts = [...pointers.current.values()];
      pinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (p) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // pinch zoom (two fingers)
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0 && d > 0 && Math.abs(d - pinchDist.current) > 1) {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt((a.x + b.x) / 2 - rect.left, pinchDist.current / d);
      }
      pinchDist.current = d;
      setHover(null);
      return;
    }

    // drag pan
    if (drag.current && geo) {
      const shift = Math.round((drag.current.x - e.clientX) / geo.slot);
      const v = viewRef.current;
      const raw = drag.current.end + shift;
      const e2 = clamp(raw, Math.min(v.visN - 1, v.total - 1), v.total - 1);
      setEnd(e2 >= v.total - 1 ? null : e2);
      setHover(null);
      return;
    }

    // hover crosshair
    if (!geo || !view.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / geo.slot);
    setHover(i >= 0 && i < view.length ? i : null);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      drag.current = null;
      pinchDist.current = 0;
      setGrabbing(false);
    } else if (pointers.current.size === 1) {
      pinchDist.current = 0;
      const [remaining] = [...pointers.current.values()];
      drag.current = { x: remaining.x, end: endN };
    }
  };

  const grid = useMemo(() => {
    if (!geo) return [];
    const rows = 5;
    return Array.from({ length: rows + 1 }, (_, i) => {
      const v = geo.lo + ((geo.hi - geo.lo) * i) / rows;
      return { v, y: geo.y(v) };
    });
  }, [geo]);

  const xLabels = useMemo(() => {
    if (!geo || !view.length) return [];
    const count = Math.min(6, view.length);
    const step = Math.max(1, Math.floor((view.length - 1) / (count - 1 || 1)));
    const idxs: number[] = [];
    for (let i = 0; i < view.length && idxs.length < count; i += step) idxs.push(i);
    return idxs.map((i) => ({ i, label: fmtTick(view[i].t, range), x: geo.x(i) }));
  }, [geo, view, range]);

  const hovered = hover !== null ? view[hover] : null;

  if (!geo) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />;
  }

  const tooltipLeft = hovered
    ? Math.min(Math.max(geo.x(hover!) - 70, 4), Math.max(width - 152, 4))
    : 0;

  const zoomed = vis !== null || end !== null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        className={`block ${grabbing ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
        {view.map((c, i) => {
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

        {/* volume histogram — trading activity strength per candle */}
        {geo.hasVol &&
          view.map((c, i) => {
            if (!c.v) return null;
            const up = c.c >= c.o;
            const barH = (c.v / (geo.maxV || 1)) * geo.volH;
            return (
              <rect
                key={`v-${c.t}-${i}`}
                x={geo.x(i) - geo.bodyW / 2}
                y={PAD.top + geo.fullH - barH}
                width={geo.bodyW}
                height={Math.max(0.5, barH)}
                fill={up ? UP : DOWN}
                opacity={0.3}
              />
            );
          })}
      </svg>

      {/* zoom controls */}
      <div className="absolute left-1.5 top-1 z-10 flex items-center gap-1">
        <button
          title="Zoom out"
          className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted shadow transition-colors hover:bg-panel hover:text-txt"
          onClick={() => zoomAt(viewRef.current.plotW / 2 + PAD.left, 1.4)}
        >
          −
        </button>
        <button
          title="Zoom in"
          className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted shadow transition-colors hover:bg-panel hover:text-txt"
          onClick={() => zoomAt(viewRef.current.plotW / 2 + PAD.left, 0.7)}
        >
          +
        </button>
        {zoomed && (
          <button
            title="Reset zoom"
            className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted shadow transition-colors hover:bg-panel hover:text-txt"
            onClick={() => {
              setVis(null);
              setEnd(null);
            }}
          >
            ⟲
          </button>
        )}
        {zoomed && <span className="ml-0.5 font-mono text-[10px] text-muted">{view.length}/{total}</span>}
      </div>

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
          {typeof hovered.v === 'number' && (
            <p className="text-muted">
              Vol <span className="text-txt">{fmtVol(hovered.v)}</span>
            </p>
          )}
          <p className={`mt-1 font-mono font-bold ${hovered.c >= hovered.o ? 'text-up' : 'text-down'}`}>
            {hovered.c >= hovered.o ? '+' : ''}
            {(((hovered.c - hovered.o) / hovered.o) * 100).toFixed(2)}%
          </p>
        </div>
      )}
    </div>
  );
}
