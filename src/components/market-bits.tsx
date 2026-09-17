import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { fmtPct, fmtPrice } from '../lib/format';
import type { Quote } from '../types';

export function PriceChange({ value, withIcon = true }: { value: number | null; withIcon?: boolean }) {
  if (value === null || !isFinite(value)) return <span className="text-muted">—</span>;
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${positive ? 'text-up' : 'text-down'}`}>
      {withIcon && <Icon size={13} />}
      {fmtPct(value)}
    </span>
  );
}

export function Sparkline({ data, positive, width = 96, height = 32 }: { data: number[]; positive: boolean; width?: number; height?: number }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ');
  const stroke = positive ? 'rgb(52 211 153)' : 'rgb(251 113 133)';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function QuoteRow({ quote, onClick }: { quote: Quote; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-panel"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {quote.name} <span className="text-muted">{quote.symbol}</span>
        </p>
        <p className="text-xs text-muted">{quote.kind === 'crypto' ? 'Crypto' : 'Fiat'} · {quote.isDemo ? 'Demo data' : 'Live'}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">{fmtPrice(quote.price)}</p>
        <PriceChange value={quote.change24h} withIcon={false} />
      </div>
    </button>
  );
}
