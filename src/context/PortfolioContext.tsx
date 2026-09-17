import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';
import { useNotifications } from './NotificationsContext';
import type { Holding, TradeAmountType, TradeResult, Txn } from '../types';

const PRICE_FRESH_MS = 10 * 60 * 1000; // must match execute_trade's staleness window

interface ServerPrice {
  symbol: string;
  price: number;
  change24h: number | null;
  updated_at: string;
}

interface PortfolioCtx {
  loading: boolean;
  cash: number;
  holdings: Holding[];
  transactions: Txn[];
  watchlist: string[];
  portfolioValue: number;
  investedValue: number;
  unrealizedPL: number;
  realizedPL: number;
  realizedCost: number;
  totalPL: number;
  totalPLPercent: number | null;
  todayPL: number;
  serverPriceOf: (symbol: string) => { price: number; fresh: boolean; updatedAt: number | null };
  executeTrade: (symbol: string, side: 'buy' | 'sell', amount: number, amountType: TradeAmountType) => Promise<TradeResult>;
  addToWatchlist: (symbol: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<PortfolioCtx | null>(null);

export function usePortfolio(): PortfolioCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { priceOf, quotes } = useMarket();
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [realizedPL, setRealizedPL] = useState(0);
  const [realizedCost, setRealizedCost] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [serverPrices, setServerPrices] = useState<Record<string, ServerPrice>>({});

  // ---------- server-authoritative prices (asset_prices, written by the Edge Function) ----------
  const loadServerPrices = useCallback(async () => {
    const { data } = await supabase.from('asset_prices').select('symbol, price, change24h, updated_at');
    const map: Record<string, ServerPrice> = {};
    for (const row of (data ?? []) as ServerPrice[]) map[row.symbol] = row;
    setServerPrices(map);
  }, []);

  useEffect(() => {
    loadServerPrices();
    const t = setInterval(loadServerPrices, 60_000);
    return () => clearInterval(t);
  }, [loadServerPrices]);

  const serverPriceOf = useCallback(
    (symbol: string) => {
      const sp = serverPrices[symbol.toUpperCase()];
      if (!sp || !sp.price || sp.price <= 0) return { price: 0, fresh: false, updatedAt: null };
      const updatedAt = new Date(sp.updated_at).getTime();
      const fresh = Date.now() - updatedAt <= PRICE_FRESH_MS;
      return { price: sp.price, fresh, updatedAt };
    },
    [serverPrices],
  );

  // ---------- user trading data ----------
  const refresh = useCallback(async () => {
    if (!user) {
      setCash(0);
      setRealizedPL(0);
      setRealizedCost(0);
      setHoldings([]);
      setTransactions([]);
      setWatchlist([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [p, h, t, w] = await Promise.all([
      supabase.from('portfolios').select('cash, realized_pl, realized_cost').eq('user_id', user.id).single(),
      supabase.from('holdings').select('symbol, quantity, avg_price').eq('user_id', user.id),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('watchlist_items').select('symbol').eq('user_id', user.id),
    ]);
    setCash(p.data ? Number(p.data.cash) : 0);
    setRealizedPL(p.data ? Number(p.data.realized_pl) : 0);
    setRealizedCost(p.data ? Number(p.data.realized_cost) : 0);
    setHoldings(((h.data as Holding[] | null) ?? []).map((x) => ({ ...x, quantity: Number(x.quantity), avg_price: Number(x.avg_price) })));
    setTransactions(((t.data as Txn[] | null) ?? []).map((x) => ({ ...x, quantity: Number(x.quantity), price: Number(x.price), total: Number(x.total) })));
    setWatchlist((((w.data as { symbol: string }[] | null) ?? []).map((x) => x.symbol)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---------- trading ----------
  const executeTrade = useCallback(
    async (symbol: string, side: 'buy' | 'sell', amount: number, amountType: TradeAmountType): Promise<TradeResult> => {
      const sym = symbol.toUpperCase();
      const fail = async (message: string): Promise<TradeResult> => {
        notify('error', 'Trade failed', message);
        await refresh(); // pull any server-recorded failed attempt into history
        return { ok: false, message };
      };

      // Shape validation only. Balance/ownership/price decisions are made
      // server-side in execute_trade; the server records failed attempts.
      if (!Number.isFinite(amount) || amount <= 0) return fail('Enter a valid amount');

      const sp = serverPriceOf(sym);
      if (!sp.price || !sp.fresh) {
        return fail('Market price unavailable — the server price feed is not running or prices are stale.');
      }

      const amountToSend =
        side === 'buy'
          ? amountType === 'usd'
            ? Number(amount.toFixed(2))
            : Number((amount * sp.price).toFixed(2))
          : amountType === 'qty'
            ? Number(amount.toFixed(8))
            : Number((amount / sp.price).toFixed(8));

      const { data, error } = await supabase.rpc('execute_trade', {
        p_side: side,
        p_symbol: sym,
        p_amount: amountToSend,
      });
      const result = (data ?? null) as { ok?: boolean; message?: string } | null;

      if (error || !result || result.ok !== true) {
        return fail(result?.message || error?.message || 'Unable to execute trade. Please try again.');
      }

      notify('success', 'Trade completed', result.message ?? '');
      await refresh();
      return { ok: true, message: result.message ?? 'Order completed' };
    },
    [serverPriceOf, notify, refresh],
  );

  const addToWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (watchlist.includes(sym) || !user) return;
      setWatchlist((w) => [...w, sym]);
      const { error } = await supabase.from('watchlist_items').insert({ symbol: sym });
      if (error) {
        setWatchlist((w) => w.filter((s) => s !== sym));
        notify('error', 'Could not add to watchlist', error.message);
        return;
      }
      notify('success', 'Added to watchlist', `${sym} was added to your watchlist.`);
    },
    [user, watchlist, notify],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (!user) return;
      setWatchlist((w) => w.filter((s) => s !== sym));
      const { error } = await supabase.from('watchlist_items').delete().eq('symbol', sym);
      if (error) {
        notify('error', 'Could not remove from watchlist', error.message);
      }
    },
    [user, notify],
  );

  const derived = useMemo(() => {
    const holdingsValue = holdings.reduce((sum, h) => sum + h.quantity * priceOf(h.symbol), 0);
    const invested = holdings.reduce((sum, h) => sum + h.quantity * h.avg_price, 0);
    const unrealizedPL = holdings.reduce((sum, h) => sum + h.quantity * (priceOf(h.symbol) - h.avg_price), 0);
    const totalPL = unrealizedPL + realizedPL;
    // Exact relative to the reported 24h change:
    // previousValue = value / (1 + change24h/100); todayPL = value - previousValue
    const todayPL = holdings.reduce((sum, h) => {
      const chg = quotes[h.symbol]?.change24h;
      const val = h.quantity * priceOf(h.symbol);
      if (chg === null || chg === undefined || chg <= -100) return sum;
      return sum + (val - val / (1 + chg / 100));
    }, 0);
    return {
      portfolioValue: cash + holdingsValue,
      investedValue: invested,
      unrealizedPL,
      totalPL,
      totalPLPercent: invested + realizedCost > 0 ? (totalPL / (invested + realizedCost)) * 100 : null,
      todayPL,
    };
  }, [cash, holdings, priceOf, quotes, realizedPL, realizedCost]);

  return (
    <Ctx.Provider
      value={{
        loading,
        cash,
        holdings,
        transactions,
        watchlist,
        ...derived,
        realizedPL,
        realizedCost,
        serverPriceOf,
        executeTrade,
        addToWatchlist,
        removeFromWatchlist,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
