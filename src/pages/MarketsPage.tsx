import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { fmtCompact, fmtPrice, fmtTime } from '../lib/format';
import { Badge, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { PriceChange } from '../components/market-bits';

export default function MarketsPage() {
  const navigate = useNavigate();
  const { status, list, loading, lastUpdated } = useMarket();
  const [tab, setTab] = useState<'crypto' | 'fiat'>('crypto');
  const [query, setQuery] = useState('');

  const filteredQuotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((item) => {
      if (item.kind !== tab) return false;
      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    });
  }, [list, tab, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Markets"
        subtitle="Live prices and 24h market movements across crypto and fiat currencies"
      />

      {/* Controls row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search symbol or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-muted">
          <Badge tone={status === 'live' ? 'up' : status === 'demo' ? 'accent' : 'neutral'}>
            {status.toUpperCase()}
          </Badge>
          <span>
            Updated {lastUpdated ? fmtTime(lastUpdated) : '—'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-4">
        <button
          onClick={() => setTab('crypto')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'crypto'
              ? 'border-primary-500 text-txt'
              : 'border-transparent text-muted hover:text-txt'
          }`}
        >
          Crypto
        </button>
        <button
          onClick={() => setTab('fiat')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'fiat'
              ? 'border-primary-500 text-txt'
              : 'border-transparent text-muted hover:text-txt'
          }`}
        >
          Fiat
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          title="No assets found"
          message={query ? `No ${tab} assets matching "${query}".` : `No ${tab} market data available.`}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'crypto' ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel/50 text-xs font-semibold uppercase text-muted">
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">24h Change</th>
                    <th className="px-4 py-3 text-right">24h High</th>
                    <th className="px-4 py-3 text-right">24h Low</th>
                    <th className="px-4 py-3 text-right">Volume</th>
                    <th className="px-4 py-3 text-right">Market Cap</th>
                    <th className="px-4 py-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredQuotes.map((q) => (
                    <tr
                      key={q.symbol}
                      onClick={() => navigate(`/app/asset/${q.symbol}`)}
                      className="cursor-pointer transition-colors hover:bg-panel/50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-txt">{q.symbol}</span>
                          <span className="text-muted text-xs truncate max-w-[120px]">{q.name}</span>
                          {q.isDemo && (
                            <Badge tone="accent" className="text-[10px] px-1 py-0">DEMO</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold">
                        {fmtPrice(q.price)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        <PriceChange value={q.change24h} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-muted">
                        {fmtPrice(q.high24h)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-muted">
                        {fmtPrice(q.low24h)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-muted">
                        {fmtCompact(q.volume24h)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-muted">
                        {fmtCompact(q.marketCap)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-muted">
                        {fmtTime(q.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel/50 text-xs font-semibold uppercase text-muted">
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3 text-right">Rate (USD)</th>
                    <th className="px-4 py-3 text-right">24h Movement</th>
                    <th className="px-4 py-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredQuotes.map((q) => (
                    <tr
                      key={q.symbol}
                      onClick={() => navigate(`/app/asset/${q.symbol}`)}
                      className="cursor-pointer transition-colors hover:bg-panel/50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-txt">{q.symbol}</span>
                          <span className="text-muted text-xs truncate max-w-[150px]">{q.name}</span>
                          {q.isDemo && (
                            <Badge tone="accent" className="text-[10px] px-1 py-0">DEMO</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold">
                        {fmtPrice(q.price)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        <PriceChange value={q.change24h} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-muted">
                        {fmtTime(q.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
