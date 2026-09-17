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

        <div className="flex flex-1 items-center gap-2.5 overflow-x-auto py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading || list.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1 text-xs"
              >
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : (
            list.map((q) => (
              <Link
                key={q.symbol}
                to={`/signup`}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1 text-xs transition-colors hover:border-primary-500/40 hover:bg-panel/80"
              >
                <span className="font-bold text-txt">{q.symbol}</span>
                <span className="font-mono text-txt">{fmtPrice(q.price)}</span>
                <PriceChange value={q.change24h} withIcon={false} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TickerTape;
