import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
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

  // ---------- real-time Firestore listeners ----------
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (!uid || !isFirebaseConfigured) {
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
    const portfolioRef = doc(db, 'users', uid, 'portfolio', 'main');
    const holdingsRef = collection(db, 'users', uid, 'holdings');
    const watchlistRef = collection(db, 'users', uid, 'watchlist');

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(portfolioRef, (snap) => {
        const data = snap.data();
        setCash(data ? Number(data.cash) : 0);
        setRealizedPL(data ? Number(data.realized_pl) : 0);
        setRealizedCost(data ? Number(data.realized_cost) : 0);
        setLoading(false);
      }),
    );

    unsubs.push(
      onSnapshot(holdingsRef, (snap) => {
        setHoldings(
          snap.docs.map((d) => ({
            symbol: d.id,
            quantity: Number(d.data().quantity),
            avg_price: Number(d.data().avg_price),
          })),
        );
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, 'users', uid, 'transactions'), (snap) => {
        const txns: Txn[] = snap.docs.map((d) => {
          const data = d.data();
          const createdAt = data.created_at;
          return {
            id: d.id,
            created_at: typeof createdAt?.toMillis === 'function' ? new Date(createdAt.toMillis()).toISOString() : new Date().toISOString(),
            symbol: data.symbol,
            side: data.side,
            quantity: Number(data.quantity),
            price: Number(data.price),
            total: Number(data.total),
            status: data.status,
          };
        });
        txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTransactions(txns.slice(0, 200));
      }),
    );

    unsubs.push(
      onSnapshot(watchlistRef, (snap) => {
        setWatchlist(snap.docs.map((d) => d.id));
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  const refresh = useCallback(async () => {
    // Firestore listeners keep state live; no manual fetch needed.
  }, []);

  // ---------- trading ----------
  const executeTrade = useCallback(
    async (symbol: string, side: 'buy' | 'sell', amount: number, amountType: TradeAmountType): Promise<TradeResult> => {
      const sym = symbol.toUpperCase();
      const fail = async (message: string): Promise<TradeResult> => {
        notify('error', 'Trade failed', message);
        return { ok: false, message };
      };

      // Shape validation only. Price, balance, ownership, allowlist, and atomic
      // execution are all decided server-side in /api/trade (Firebase Admin SDK),
      // which also records failed attempts.
      if (!Number.isFinite(amount) || amount <= 0) return fail('Enter a valid amount');

      const quote = quotes[sym];
      const estPrice = quote?.price ?? 0;
      const amountToSend =
        side === 'buy'
          ? amountType === 'usd'
            ? Number(amount.toFixed(2))
            : Number((amount * estPrice).toFixed(2))
          : amountType === 'qty'
            ? Number(amount.toFixed(8))
            : Number((amount / estPrice).toFixed(8));

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return fail('Not authenticated');

        const res = await fetch('/api/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ side, symbol: sym, amount: amountToSend }),
        });
        let result: { ok?: boolean; message?: string } | null = null;
        try {
          result = (await res.json()) as { ok?: boolean; message?: string };
        } catch {
          // non-JSON response below
        }
        if (!res.ok || !result || result.ok !== true) {
          return fail(result?.message || 'Unable to execute trade. Please try again.');
        }
        notify('success', 'Trade completed', result.message ?? '');
        return { ok: true, message: result.message ?? 'Order completed' };
      } catch {
        return fail('Trading service unavailable. Please try again shortly.');
      }
    },
    [notify, quotes],
  );

  const addToWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (watchlist.includes(sym) || !user || !isFirebaseConfigured) return;
      setWatchlist((w) => [...w, sym]);
      try {
        await setDoc(doc(db, 'users', user.uid, 'watchlist', sym), {
          symbol: sym,
          added_at: serverTimestamp(),
        });
        notify('success', 'Added to watchlist', `${sym} was added to your watchlist.`);
      } catch {
        setWatchlist((w) => w.filter((s) => s !== sym));
        notify('error', 'Could not add to watchlist', 'Please try again.');
      }
    },
    [user, watchlist, notify],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (!user || !isFirebaseConfigured) return;
      setWatchlist((w) => w.filter((s) => s !== sym));
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'watchlist', sym));
      } catch {
        notify('error', 'Could not remove from watchlist', 'Please try again.');
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
