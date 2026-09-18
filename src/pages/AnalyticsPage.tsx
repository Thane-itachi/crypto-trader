import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, ReferenceLine,
} from 'recharts';
import { Activity, Percent, Scale, TrendingDown } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { fmtPct, fmtPrice, fmtUSD, fmtSignedUSD } from '../lib/format';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import type { Txn } from '../types';

const START_CASH = 10_000; // initial demo funds

/** A closed round-trip trade: FIFO-matched buys and sells of one symbol. */
interface ClosedTrade {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryAt: string;
  exitAt: string;
  pl: number;
  plPct: number;
  exitReason: Txn['reason'];
}

/**
 * Match buys and sells per symbol FIFO to produce closed round-trip trades
 * with entry/exit prices, P/L and hold time. Remaining open quantities are
 * excluded (they're still valued live in the portfolio).
 */
function matchTrades(txns: Txn[]): ClosedTrade[] {
  const byTime = [...txns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const lots: Record<string, { qty: number; price: number; at: string }[]> = {};
  const closed: ClosedTrade[] = [];

  for (const t of byTime) {
    if (t.status !== 'completed') continue;
    if (t.side === 'buy') {
      (lots[t.symbol] ??= []).push({ qty: t.quantity, price: t.price, at: t.created_at });
    } else {
      let remaining = t.quantity;
      const queue = (lots[t.symbol] ??= []);
      while (remaining > 1e-9 && queue.length > 0) {
        const lot = queue[0];
        const take = Math.min(lot.qty, remaining);
        const entry = lot.price;
        const exit = t.price;
        const pl = take * (exit - entry);
        closed.push({
          symbol: t.symbol,
          entryPrice: entry,
          exitPrice: exit,
          quantity: take,
          entryAt: lot.at,
          exitAt: t.created_at,
          pl,
          plPct: entry > 0 ? ((exit - entry) / entry) * 100 : 0,
          exitReason: t.reason ?? 'manual',
        });
        remaining -= take;
        lot.qty -= take;
        if (lot.qty <= 1e-9) queue.shift();
      }
    }
  }
  return closed;
}

/** Equity curve: cash + holdings valued at each transaction's known prices. */
function equityCurve(txns: Txn[]): { t: number; equity: number }[] {
  const byTime = [...txns]
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const lastPrice: Record<string, number> = {};
  const held: Record<string, number> = {};
  let cash = START_CASH;
  const points: { t: number; equity: number }[] = [];

  for (const t of byTime) {
    lastPrice[t.symbol] = t.price;
    if (t.side === 'buy') {
      cash -= t.total;
      held[t.symbol] = (held[t.symbol] ?? 0) + t.quantity;
    } else {
      cash += t.total;
      held[t.symbol] = Math.max(0, (held[t.symbol] ?? 0) - t.quantity);
    }
    const holdingsValue = Object.entries(held).reduce((sum, [sym, qty]) => sum + qty * (lastPrice[sym] ?? 0), 0);
    points.push({ t: new Date(t.created_at).getTime(), equity: cash + holdingsValue });
  }
  return points;
}

/** Max peak-to-trough drawdown (%) of the equity curve. */
function maxDrawdown(points: { equity: number }[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const p of points) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? (peak - p.equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Txn[] | null>(null);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) {
      setTxns([]);
      return;
    }
    (async () => {
      // one-time fetch of the full history (analytics only; live state stays in context)
      const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('created_at', 'desc'), limit(2000));
      const snap = await getDocs(q);
      setTxns(
        snap.docs.map((d) => {
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
            reason: data.reason,
          } as Txn;
        }),
      );
    })().catch(() => setTxns([]));
  }, [user?.uid]);

  const stats = useMemo(() => {
    if (!txns) return null;
    const trades = matchTrades(txns);
    const wins = trades.filter((t) => t.pl > 0);
    const losses = trades.filter((t) => t.pl <= 0);
    const grossWin = wins.reduce((s, t) => s + t.pl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pl, 0));
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length ? grossWin / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const expectancy = trades.length ? (grossWin - grossLoss) / trades.length : 0;
    const curve = equityCurve(txns);
    const best = trades.length ? trades.reduce((a, b) => (b.pl > a.pl ? b : a)) : null;
    const worst = trades.length ? trades.reduce((a, b) => (b.pl < a.pl ? b : a)) : null;

    const perSymbol = Object.values(
      trades.reduce<Record<string, { symbol: string; trades: number; wins: number; pl: number }>>((acc, t) => {
        const row = (acc[t.symbol] ??= { symbol: t.symbol, trades: 0, wins: 0, pl: 0 });
        row.trades += 1;
        if (t.pl > 0) row.wins += 1;
        row.pl += t.pl;
        return acc;
      }, {}),
    ).sort((a, b) => b.pl - a.pl);

    return {
      trades, curve, winRate, avgWin, avgLoss, profitFactor, expectancy,
      maxDD: maxDrawdown(curve), best, worst, perSymbol,
      totalVolume: txns.filter((t) => t.status === 'completed').reduce((s, t) => s + t.total, 0),
    };
  }, [txns]);

  const loading = txns === null;
  const hasData = (stats?.trades.length ?? 0) > 0 || (stats?.curve.length ?? 0) > 0;

  const fmtPFRatio = (pf: number) => (pf === Infinity ? '∞' : pf.toFixed(2));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Your trading performance — win rate, P/L quality, drawdown and equity history. Computed from your complete transaction ledger."
        actions={<Badge tone="accent">PAPER TRADING</Badge>}
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-7 w-28" />
            </Card>
          ))}
        </div>
      ) : !hasData ? (
        <Card className="p-8">
          <EmptyState
            title="No closed trades yet."
            message="Buy and sell an asset and your performance metrics will appear here — win rate, profit factor, expectancy and drawdown."
          />
        </Card>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Win Rate</p>
                <Percent size={14} className="text-muted" />
              </div>
              <p className={`mt-2 font-mono text-2xl font-bold ${(stats?.winRate ?? 0) >= 50 ? 'text-up' : 'text-down'}`}>
                {stats ? `${stats.winRate.toFixed(1)}%` : '—'}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {stats ? `${stats.trades.filter((t) => t.pl > 0).length}W / ${stats.trades.filter((t) => t.pl <= 0).length}L of ${stats.trades.length} trades` : ''}
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Profit Factor</p>
                <Scale size={14} className="text-muted" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-txt">{stats ? fmtPFRatio(stats.profitFactor) : '—'}</p>
              <p className="mt-1 text-[11px] text-muted">Gross wins ÷ gross losses (&gt;1 is profitable)</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Max Drawdown</p>
                <TrendingDown size={14} className="text-muted" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-down">
                {stats ? `-${stats.maxDD.toFixed(2)}%` : '—'}
              </p>
              <p className="mt-1 text-[11px] text-muted">Worst peak-to-trough equity drop</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Expectancy</p>
                <Activity size={14} className="text-muted" />
              </div>
              <p className={`mt-2 font-mono text-2xl font-bold ${(stats?.expectancy ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                {stats ? fmtSignedUSD(stats.expectancy) : '—'}
              </p>
              <p className="mt-1 text-[11px] text-muted">Average P/L per closed trade</p>
            </Card>
          </div>

          {/* Equity curve */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-base tracking-tight">Equity Curve</h3>
              <span className="text-xs font-mono text-muted">start {fmtUSD(START_CASH)} (demo funds)</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.curve ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: 'rgb(125 137 148)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    width={60}
                    tick={{ fontSize: 10, fill: 'rgb(125 137 148)', fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => fmtUSD(v)}
                  />
                  <ReferenceLine y={START_CASH} stroke="rgb(125 137 148)" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <RTooltip
                    labelFormatter={(t: number) => new Date(t).toLocaleString('en-US')}
                    formatter={(v: number) => [fmtUSD(v), 'Equity']}
                    contentStyle={{ background: 'rgb(17 24 34)', border: '1px solid rgb(51 65 85)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#34d399" strokeWidth={2} fill="url(#eq-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Valued at transaction prices — points appear as trades happen, not live tick data.
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Closed trades table */}
            <Card className="p-5">
              <h3 className="mb-3 font-bold text-base tracking-tight">Closed Trades</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                      <th className="py-2 px-2">Asset</th>
                      <th className="py-2 px-2 text-right">Entry</th>
                      <th className="py-2 px-2 text-right">Exit</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">P/L</th>
                      <th className="py-2 px-2 text-right">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-mono">
                    {(stats?.trades ?? []).slice(0, 30).reverse().map((t, i) => (
                      <tr key={i} className="hover:bg-panel">
                        <td className="py-2 px-2 font-semibold text-txt">{t.symbol}</td>
                        <td className="py-2 px-2 text-right">{fmtPrice(t.entryPrice)}</td>
                        <td className="py-2 px-2 text-right">{fmtPrice(t.exitPrice)}</td>
                        <td className="py-2 px-2 text-right">{t.quantity.toFixed(6)}</td>
                        <td className={`py-2 px-2 text-right font-semibold ${t.pl >= 0 ? 'text-up' : 'text-down'}`}>
                          {fmtSignedUSD(t.pl)} <span className="text-[10px]">({fmtPct(t.plPct)})</span>
                        </td>
                        <td className="py-2 px-2 text-right font-sans text-[11px] text-muted">
                          {t.exitReason === 'take_profit' ? 'Take-profit' : t.exitReason === 'stop_loss' ? 'Stop-loss' : 'Manual'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Per-symbol performance */}
            <Card className="p-5 h-fit">
              <h3 className="mb-3 font-bold text-base tracking-tight">By Asset</h3>
              <div className="space-y-2">
                {(stats?.perSymbol ?? []).map((row) => {
                  const wr = row.trades ? (row.wins / row.trades) * 100 : 0;
                  return (
                    <div key={row.symbol} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-txt">{row.symbol}</p>
                        <p className="text-[11px] text-muted">
                          {row.trades} {row.trades === 1 ? 'trade' : 'trades'} · {wr.toFixed(0)}% win
                        </p>
                      </div>
                      <span className={`font-mono font-semibold ${row.pl >= 0 ? 'text-up' : 'text-down'}`}>
                        {fmtSignedUSD(row.pl)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {stats?.best && (
                <div className="mt-4 space-y-1 text-xs text-muted">
                  <p>
                    Best trade:{' '}
                    <span className="font-mono font-semibold text-up">
                      {stats.best.symbol} {fmtSignedUSD(stats.best.pl)}
                    </span>
                  </p>
                  <p>
                    Worst trade:{' '}
                    <span className="font-mono font-semibold text-down">
                      {stats.worst ? `${stats.worst.symbol} ${fmtSignedUSD(stats.worst.pl)}` : '—'}
                    </span>
                  </p>
                  <p>
                    Avg win: <span className="font-mono font-semibold text-up">{fmtUSD(stats.avgWin)}</span> · Avg loss:{' '}
                    <span className="font-mono font-semibold text-down">{fmtUSD(stats.avgLoss)}</span>
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
