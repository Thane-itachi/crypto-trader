import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Radio, Wallet } from 'lucide-react';
import { useMarket } from '../../context/MarketContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { fmtQty, fmtTime } from '../../lib/format';
import { PriceChange } from '../market-bits';
import { Badge, Card, EmptyState } from '../ui';

interface MarketMoveEvent {
  id: string;
  type: 'market';
  symbol: string;
  price: number;
  deltaPct: number; // actual tick delta between two polls, derived from real market data
  timestamp: number;
  isLive: boolean;
}

interface UserTradeEvent {
  id: string;
  type: 'trade';
  timestamp: number;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
}

type ActivityEvent = MarketMoveEvent | UserTradeEvent;

export default function LiveActivity() {
  const { quotes, status } = useMarket();
  const { transactions } = usePortfolio();
  const [marketEvents, setMarketEvents] = useState<MarketMoveEvent[]>([]);
  const prevQuotesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const prev = prevQuotesRef.current;
    const isFirstLoad = Object.keys(prev).length === 0;
    const newEvents: MarketMoveEvent[] = [];
    const nextPrev: Record<string, number> = {};

    for (const [symbol, quote] of Object.entries(quotes)) {
      nextPrev[symbol] = quote.price;
      if (
        !isFirstLoad &&
        prev[symbol] !== undefined &&
        prev[symbol] !== quote.price &&
        prev[symbol] > 0
      ) {
        newEvents.push({
          id: `mkt-${symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'market',
          symbol: quote.symbol,
          price: quote.price,
          deltaPct: ((quote.price - prev[symbol]) / prev[symbol]) * 100,
          timestamp: Date.now(),
          isLive: status === 'live' && !quote.isDemo,
        });
      }
    }

    prevQuotesRef.current = nextPrev;

    if (newEvents.length > 0) {
      setMarketEvents((existing) => [...newEvents, ...existing].slice(0, 12));
    }
  }, [quotes, status]);

  const userTradeEvents: UserTradeEvent[] = useMemo(() => {
    return transactions.slice(0, 5).map((txn) => ({
      id: `trade-${txn.id}`,
      type: 'trade',
      timestamp: new Date(txn.created_at).getTime(),
      side: txn.side,
      symbol: txn.symbol,
      quantity: txn.quantity,
    }));
  }, [transactions]);

  const allEvents = useMemo(() => {
    const combined: ActivityEvent[] = [...marketEvents, ...userTradeEvents];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined.slice(0, 12);
  }, [marketEvents, userTradeEvents]);

  return (
    <Card className="p-5 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-primary-500 animate-pulse" />
          <h3 className="font-bold text-base tracking-tight">LIVE Market Activity</h3>
        </div>
        <Badge tone={status === 'live' ? 'up' : 'accent'}>
          {status === 'live' ? 'LIVE' : 'DEMO'}
        </Badge>
      </div>

      {allEvents.length === 0 ? (
        <div className="my-auto py-8">
          <EmptyState
            title="Waiting for market updates…"
            message="Real-time market price movements and your simulated demo trades will appear here automatically."
          />
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
          {allEvents.map((event) => {
            if (event.type === 'trade') {
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-panel border border-line/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-primary-500/10 text-primary-500 shrink-0">
                      <Wallet size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt truncate">
                        {event.side === 'buy' ? 'Bought' : 'Sold'} {fmtQty(event.quantity)} {event.symbol}
                      </p>
                      <div className="mt-0.5">
                        <Badge tone="accent" className="text-[10px] py-0 px-1.5">
                          YOUR TRADE (SIMULATED)
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-muted shrink-0">
                    {fmtTime(event.timestamp)}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface border border-line/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-md bg-panel text-muted shrink-0">
                    <Activity size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-txt">{event.symbol}</span>
                      <PriceChange value={event.deltaPct} />
                    </div>
                    <div className="mt-0.5">
                      <Badge tone={event.isLive ? 'up' : 'neutral'} className="text-[10px] py-0 px-1.5">
                        {event.isLive ? 'LIVE PRICE TICK' : 'DEMO PRICE TICK'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-muted shrink-0">
                  {fmtTime(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
