import { Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { fmtPrice } from '../lib/format';
import { PriceChange } from './market-bits';
import { Badge, Skeleton } from './ui';

export function TickerTape() {
  const { list, status, loading } = useMarket();

  const isLive = status === 'live';

  return (
    <div className="border-b border-line bg-surface/60 py-2">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-1.5 border-r border-line pr-3">
          <Badge tone={isLive ? 'up' : 'accent'}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isLive ? 'bg-up' : 'bg-primary-500'} animate-pulse`} />
            {isLive ? 'LIVE' : 'DEMO'}
          </Badge>
        </div>

        <div className="relative flex-1 overflow-hidden py-0.5 [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
          {loading || list.length === 0 ? (
            <div className="flex items-center gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1 text-xs"
                >
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="ticker-track gap-2.5 py-0.5">
              {[...list, ...list].map((q, i) => (
                <Link
                  key={`${q.symbol}-${i}`}
                  to={`/signup`}
                  aria-hidden={i >= list.length}
                  tabIndex={i >= list.length ? -1 : 0}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1 text-xs transition-colors hover:border-primary-500/40 hover:bg-panel/80"
                >
                  <span className="font-bold text-txt">{q.symbol}</span>
                  <span className="font-mono text-txt">{fmtPrice(q.price)}</span>
                  <PriceChange value={q.change24h} withIcon={false} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TickerTape;
