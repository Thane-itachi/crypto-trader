import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';
import { useNotifications } from './NotificationsContext';
import type { Holding, TradeAmountType, TradeResult, Txn } from '../types';

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

  const executeTrade = useCallback(
    async (symbol: string, side: 'buy' | 'sell', amount: number, amountType: TradeAmountType): Promise<TradeResult> => {
      const sym = symbol.toUpperCase();
      const price = priceOf(sym);
      const fail = (message: string): TradeResult => {
        notify('error', 'Trade failed', message);
        return { ok: false, message };
      };

      // --- client-side pre-validation (server re-validates authoritatively) ---
      if (!Number.isFinite(amount) || amount <= 0) return fail('Enter a valid amount');
      if (!price || price <= 0) return fail('Market price unavailable for ' + sym);
      if (side === 'buy') {
        if (amountType === 'usd' && amount > cash) return fail('Insufficient demo balance');
      } else {
        const held = holdings.find((h) => h.symbol === sym)?.quantity ?? 0;
        if (amountType === 'qty' && amount > held) return fail('Insufficient ' + sym + ' balance');
      }

      const usdAmount = side === 'buy' ? (amountType === 'usd' ? amount : amount * price) : amount;
      const qtyAmount = side === 'buy' ? amount : (amountType === 'qty' ? amount : amount / price);
      const rpcArgs =
        side === 'buy'
          ? { p_side: 'buy', p_symbol: sym, p_amount: Number(usdAmount.toFixed(2)), p_price: price }
          : { p_side: 'sell', p_symbol: sym, p_amount: Number(qtyAmount.toFixed(8)), p_price: price };

      const { data, error } = await supabase.rpc('execute_trade', rpcArgs);
      const result = (data ?? null) as { ok?: boolean; message?: string } | null;

      if (error || !result || result.ok !== true) {
        const message = result?.message || error?.message || 'Unable to execute trade. Please try again.';
        // record the failed attempt in history (best-effort)
        supabase
          .from('transactions')
          .insert({
            symbol: sym,
            side,
            quantity: qtyAmount,
            price,
            total: usdAmount,
            status: 'failed',
          })
          .then(() => refresh());
        return fail(message);
      }

      notify('success', 'Trade completed', result.message ?? '');
      await refresh();
      return { ok: true, message: result.message ?? 'Order completed' };
    },
    [cash, holdings, priceOf, notify, refresh],
  );

  const addToWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (watchlist.includes(sym) || !user) return;
      setWatchlist((w) => [...w, sym]);
      await supabase.from('watchlist_items').insert({ symbol: sym });
      notify('success', 'Added to watchlist', `${sym} was added to your watchlist.`);
    },
    [user, watchlist, notify],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (!user) return;
      setWatchlist((w) => w.filter((s) => s !== sym));
      await supabase.from('watchlist_items').delete().eq('symbol', sym);
    },
    [user],
  );

  const derived = useMemo(() => {
    const holdingsValue = holdings.reduce((sum, h) => sum + h.quantity * priceOf(h.symbol), 0);
    const invested = holdings.reduce((sum, h) => sum + h.quantity * h.avg_price, 0);
    const unrealizedPL = holdings.reduce((sum, h) => sum + h.quantity * (priceOf(h.symbol) - h.avg_price), 0);
    const totalPL = unrealizedPL + realizedPL;
    const todayPL = holdings.reduce((sum, h) => {
      const chg = quotes[h.symbol]?.change24h;
      const val = h.quantity * priceOf(h.symbol);
      return sum + (chg != null ? val * (chg / 100) : 0);
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
