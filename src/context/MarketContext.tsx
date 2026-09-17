import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChartPoint, ChartRange, MarketStatus, Quote } from '../types';
import { fetchMarketSnapshot, fetchSeriesCached, POLL_INTERVAL } from '../lib/market';
import { useNotifications } from './NotificationsContext';

interface MarketCtx {
  status: MarketStatus;
  quotes: Record<string, Quote>;
  list: Quote[];
  loading: boolean;
  lastUpdated: number | null;
  getQuote: (symbol: string) => Quote | undefined;
  priceOf: (symbol: string) => number;
  refresh: () => void;
  series: (symbol: string, kind: 'crypto' | 'fiat', range: ChartRange) => Promise<{ points: ChartPoint[]; isDemo: boolean }>;
}

const Ctx = createContext<MarketCtx | null>(null);

export function useMarket(): MarketCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [status, setStatus] = useState<MarketStatus>('loading');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const { notify } = useNotifications();
  const tickRef = useRef(0);
  const prevStatusRef = useRef<MarketStatus>('loading');

  const load = useCallback(async () => {
    const tick = tickRef.current++;
    try {
      const snap = await fetchMarketSnapshot(tick);
      const next: Record<string, Quote> = {};
      for (const q of snap.quotes) next[q.symbol] = q;
      setQuotes(next);
      setLastUpdated(Date.now());
      const nextStatus: MarketStatus = snap.cryptoLive && snap.fiatLive ? 'live' : 'demo';
      setStatus(nextStatus);
    } catch {
      setStatus('demo');
      setLastUpdated(Date.now());
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === 'loading') {
      prevStatusRef.current = status;
      return;
    }
    if (status !== prev) {
      if (status === 'live') notify('info', 'Market data connection restored', 'Live prices are updating again.');
      else if (status === 'demo') notify('warning', 'Market data temporarily unavailable', 'Showing clearly-labeled demo market data.');
      prevStatusRef.current = status;
    }
  }, [status, notify]);

  const getQuote = useCallback(
    (symbol: string) => quotes[symbol.toUpperCase()],
    [quotes],
  );

  const priceOf = useCallback(
    (symbol: string) => {
      const s = symbol.toUpperCase();
      if (s === 'USD') return 1;
      return quotes[s]?.price ?? 0;
    },
    [quotes],
  );

  const series = useCallback(
    (symbol: string, kind: 'crypto' | 'fiat', range: ChartRange) => {
      const current = quotes[symbol.toUpperCase()]?.price ?? 1;
      return fetchSeriesCached(symbol, kind, range, current);
    },
    [quotes],
  );

  const list = useMemo(() => Object.values(quotes), [quotes]);

  return (
    <Ctx.Provider value={{ status, quotes, list, loading: status === 'loading', lastUpdated, getQuote, priceOf, refresh: load, series }}>
      {children}
    </Ctx.Provider>
  );
}
