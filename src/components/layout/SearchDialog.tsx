import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { searchAssets } from '../../lib/assets';
import { useMarket } from '../../context/MarketContext';
import { fmtPrice } from '../../lib/format';
import { PriceChange } from '../market-bits';

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { quotes } = useMarket();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return Object.values(quotes).slice(0, 8);
    }
    const assetMatches = searchAssets(query);
    return assetMatches.map((a) => quotes[a.symbol] ?? { symbol: a.symbol, name: a.name, kind: a.kind, price: 0, change24h: null, high24h: null, low24h: null, volume24h: null, marketCap: null, updatedAt: 0, isDemo: true });
  }, [query, quotes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: Bitcoin, BTC, Ethereum, NGN, EUR…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-panel">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No assets match “{query}”.</p>}
          {results.map((q) => (
            <button
              key={q.symbol}
              onClick={() => {
                onClose();
                navigate(`/app/asset/${q.symbol}`);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-panel"
            >
              <div>
                <p className="text-sm font-semibold">{q.name}</p>
                <p className="text-xs text-muted">{q.symbol}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{fmtPrice(q.price)}</p>
                <PriceChange value={q.change24h} withIcon={false} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
