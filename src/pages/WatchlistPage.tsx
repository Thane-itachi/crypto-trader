import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarOff } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { usePortfolio } from '../context/PortfolioContext';
import { findAsset } from '../lib/assets';
import { fmtPrice } from '../lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { PriceChange, Sparkline } from '../components/market-bits';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist } = usePortfolio();
  const { getQuote, series } = useMarket();
  const navigate = useNavigate();
  const [sparks, setSparks] = useState<Record<string, number[]>>({});

  const watchKey = watchlist.join(',');

  // Best-effort sparklines: 1D series per watched asset (cached in the market layer)
  useEffect(() => {
    let cancelled = false;
    const symbols = watchKey ? watchKey.split(',') : [];
    if (symbols.length === 0) {
      setSparks({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        symbols.map(async (sym): Promise<[string, number[]]> => {
          const asset = findAsset(sym);
          if (!asset) return [sym, []];
          try {
            const res = await series(sym, asset.kind, '1D');
            return [sym, res.points.map((p) => p.p)];
          } catch {
            return [sym, []];
          }
        }),
      );
      if (!cancelled) setSparks(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        subtitle="Assets you're following. Changes persist to your account."
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/markets')}>
            Add assets
          </Button>
        }
      />

      {watchlist.length === 0 ? (
        <Card>
          <EmptyState
            title="No assets watched yet"
            message="Add assets from the Markets page to follow their prices and 24h movement here."
            action={
              <Button variant="primary" onClick={() => navigate('/app/markets')}>
                Browse markets
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {watchlist.map((sym) => {
            const quote = getQuote(sym);
            const asset = findAsset(sym);
            const spark = sparks[sym];
            return (
              <div
                key={sym}
                className="flex cursor-pointer items-center gap-3 px-4 py-4 transition-colors hover:bg-panel"
                onClick={() => navigate(`/app/asset/${sym}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {asset?.name ?? sym} <span className="text-muted">{sym}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    {quote?.isDemo ? <Badge tone="accent">DEMO</Badge> : quote ? <Badge tone="up">LIVE</Badge> : null}
                    {quote ? `Updated ${new Date(quote.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
                  </p>
                </div>

                <div className="hidden sm:block">
                  {spark && spark.length > 2 ? (
                    <Sparkline data={spark.slice(-24)} positive={(quote?.change24h ?? 0) >= 0} />
                  ) : (
                    <Skeleton className="h-8 w-24" />
                  )}
                </div>

                <div className="w-28 text-right">
                  {quote ? (
                    <>
                      <p className="font-mono text-sm font-semibold">{fmtPrice(quote.price)}</p>
                      <PriceChange value={quote.change24h} withIcon={false} />
                    </>
                  ) : (
                    <>
                      <Skeleton className="ml-auto h-4 w-20" />
                      <Skeleton className="ml-auto mt-1.5 h-3 w-14" />
                    </>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(sym);
                  }}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-down/10 hover:text-down"
                  title={`Remove ${sym} from watchlist`}
                >
                  <StarOff size={16} />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
