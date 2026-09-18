import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { ASSET_ICON } from '../lib/assets';
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
  const stroke = positive ? 'rgb(16 185 129)' : 'rgb(244 63 94)';
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


export function AssetIcon({ symbol, size = 34 }: { symbol: string; size?: number }) {
  const icon = ASSET_ICON[symbol] ?? { bg: 'linear-gradient(135deg,#3a3f47,#12141a)', glyph: symbol[0] };
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-txt shadow-sm"
      style={{ width: size, height: size, background: icon.bg, fontSize: size * 0.46 }}
    >
      {icon.glyph}
    </div>
  );
}

/** Horizontal coin ticker strip: tap a coin to select it. */
export function CoinTickerStrip({
  symbols,
  selected,
  onSelect,
  getQuote,
}: {
  symbols: string[];
  selected: string;
  onSelect: (symbol: string) => void;
  getQuote: (symbol: string) => Quote | undefined;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {symbols.map((sym) => {
        const q = getQuote(sym);
        const active = sym === selected;
        const positive = (q?.change24h ?? 0) >= 0;
        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-center transition-colors ${
              active ? 'border-primary-500 bg-primary-500/10' : 'border-line bg-panel hover:border-primary-500/40'
            }`}
            style={{ minWidth: 84 }}
          >
            <AssetIcon symbol={sym} size={30} />
            <span className="text-[11px] font-bold tracking-wide">{sym}</span>
            <span className="font-mono text-[11px] font-semibold text-txt">
              {q ? fmtPrice(q.price) : '—'}
            </span>
            {q?.change24h != null && (
              <span className={`text-[10px] font-semibold ${positive ? 'text-up' : 'text-down'}`}>
                {positive ? '+' : ''}
                {q.change24h.toFixed(2)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
