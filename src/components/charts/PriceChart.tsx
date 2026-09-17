import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CandleChart from './CandleChart';
import { Loader2 } from 'lucide-react';
import { useMarket } from '../../context/MarketContext';
import type { Candle, ChartPoint, ChartRange } from '../../types';
import { Badge } from '../ui';

const RANGES: ChartRange[] = ['1H', '1D', '1W', '1M', '3M', '1Y'];

interface Props {
  symbol: string;
  kind: 'crypto' | 'fiat';
  height?: number;
  showRanges?: boolean;
}

export default function PriceChart({ symbol, kind, height = 320, showRanges = true }: Props) {
  const { series, getQuote } = useMarket();
  const [range, setRange] = useState<ChartRange>('1D');
  const [mode, setMode] = useState<'candle' | 'line'>('candle');
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(false);
    series(symbol, kind, range)
      .then((res) => {
        if (runId.current !== id) return;
        setPoints(res.points);
        setCandles(res.candles ?? null);
        setIsDemo(res.isDemo);
        setLoading(false);
      })
      .catch(() => {
        if (runId.current !== id) return;
        setError(true);
        setLoading(false);
      });
  }, [symbol, kind, range, series]);

  const positive = points && points.length > 1 ? points[points.length - 1].p >= points[0].p : true;
  const color = positive ? 'rgb(52 211 153)' : 'rgb(251 113 133)';

  const change = points && points.length > 1 ? ((points[points.length - 1].p - points[0].p) / points[0].p) * 100 : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">{symbol}/USD</span>
          {change !== null && (
            <span className={`font-mono text-xs font-bold ${positive ? 'text-up' : 'text-down'}`}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}% <span className="text-muted">({range})</span>
            </span>
          )}
          {isDemo && (
            <Badge tone="accent">DEMO CHART DATA</Badge>
          )}
        </div>
        {showRanges && (
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  range === r ? 'bg-primary-600 text-white' : 'text-muted hover:bg-panel hover:text-txt'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1" title="Chart type">
          {(['candle', 'line'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                mode === m ? 'bg-primary-600 text-white' : 'text-muted hover:bg-panel hover:text-txt'
              }`}
            >
              {m === 'candle' ? 'Candles' : 'Line'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary-500" />
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
            <p>Unable to load chart data.</p>
            <button onClick={() => setRange((r) => r)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-panel">
              Try again
            </button>
          </div>
        )}
        {!loading && !error && mode === 'candle' && candles && candles.length > 0 && (
          <CandleChart candles={candles} height={height - 24} range={range} />
        )}
        {!loading && !error && points && (mode === 'line' || !candles || candles.length === 0) && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'rgb(125 137 148)' }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(t: number) =>
                  range === '1H' || range === '1D'
                    ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
              />
              <YAxis
                domain={['auto', 'auto']}
                width={56}
                tick={{ fontSize: 10, fill: 'rgb(125 137 148)', fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v >= 1 ? v.toFixed(2) : v.toPrecision(3))}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload && payload.length ? (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                      <p className="text-muted">{new Date(payload[0].payload.t).toLocaleString('en-US')}</p>
                      <p className="font-mono font-bold">
                        ${Number(payload[0].payload.p).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="p" stroke={color} strokeWidth={2} fill={`url(#grad-${symbol})`} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted">
        {isDemo ? 'Simulated chart data — not real market history.' : `Live market history · updates every ${getQuote(symbol)?.kind === 'fiat' ? 'refresh' : 'refresh'}`}
      </p>
    </div>
  );
}
