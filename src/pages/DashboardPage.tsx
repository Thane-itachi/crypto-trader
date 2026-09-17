import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { usePortfolio } from '../context/PortfolioContext';
import { fmtPct, fmtPrice, fmtQty, fmtSignedUSD, fmtTime, fmtUSD } from '../lib/format';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { PriceChange } from '../components/market-bits';
import PriceChart from '../components/charts/PriceChart';
import LiveActivity from '../components/market/LiveActivity';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { list, getQuote } = useMarket();
  const {
    cash,
    portfolioValue,
    todayPL,
    totalPL,
    totalPLPercent,
    watchlist,
    transactions,
  } = usePortfolio();

  const greetingName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Trader';

  // Top gainers: top 4 crypto assets by change24h desc
  const topGainers = useMemo(() => {
    return list
      .filter((q) => q.kind === 'crypto' && q.change24h !== null)
      .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))
      .slice(0, 4);
  }, [list]);

  // Top losers: bottom 4 crypto assets by change24h asc
  const topLosers = useMemo(() => {
    return list
      .filter((q) => q.kind === 'crypto' && q.change24h !== null)
      .sort((a, b) => (a.change24h ?? Infinity) - (b.change24h ?? Infinity))
      .slice(0, 4);
  }, [list]);

  // Watchlist preview: first 5 items
  const watchlistPreview = useMemo(() => {
    return watchlist.slice(0, 5).map((symbol) => ({
      symbol,
      quote: getQuote(symbol),
    }));
  }, [watchlist, getQuote]);

  // Recent transactions: last 5 transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${greetingName}! Here is your paper trading overview.`}
        actions={
          <Link to="/app/markets">
            <Button variant="primary" size="md">
              Trade Markets
            </Button>
          </Link>
        }
      />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Portfolio Value</p>
          <p className="mt-2 text-2xl font-bold font-mono text-txt">{fmtUSD(portfolioValue)}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Demo Cash Balance</p>
            <Badge tone="accent">DEMO FUNDS</Badge>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-txt">{fmtUSD(cash)}</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Today's P/L</p>
          <p className={`mt-2 text-2xl font-bold font-mono ${todayPL >= 0 ? 'text-up' : 'text-down'}`}>
            {fmtSignedUSD(todayPL)}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Overall P/L</p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <p className={`text-2xl font-bold font-mono ${totalPL >= 0 ? 'text-up' : 'text-down'}`}>
              {fmtSignedUSD(totalPL)}
            </p>
            <span className={`text-sm font-semibold font-mono ${totalPL >= 0 ? 'text-up' : 'text-down'}`}>
              ({fmtPct(totalPLPercent)})
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart + Live Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base tracking-tight">Bitcoin Market Chart</h3>
              <p className="text-xs text-muted">Live crypto benchmark reference</p>
            </div>
            <Link to="/app/asset/BTC" className="text-xs font-semibold text-primary-500 hover:underline inline-flex items-center gap-1">
              View BTC <ArrowRight size={13} />
            </Link>
          </div>
          <PriceChart symbol="BTC" kind="crypto" height={260} showRanges={true} />
        </Card>

        <div className="lg:col-span-1">
          <LiveActivity />
        </div>
      </div>

      {/* Gainers, Losers, Watchlist Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Gainers */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-up" />
              <h3 className="font-bold text-sm tracking-tight">Top Gainers</h3>
            </div>
            <span className="text-[11px] text-muted font-medium">24h</span>
          </div>
          <div className="space-y-1">
            {topGainers.map((quote) => (
              <Link
                key={quote.symbol}
                to={`/app/asset/${quote.symbol}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-panel transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold font-mono text-txt">{quote.symbol}</p>
                  <p className="text-[11px] text-muted truncate">{quote.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs font-semibold text-txt">{fmtPrice(quote.price)}</p>
                  <PriceChange value={quote.change24h} />
                </div>
              </Link>
            ))}
            {topGainers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted">No gainers data available.</p>
            )}
          </div>
        </Card>

        {/* Top Losers */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-down" />
              <h3 className="font-bold text-sm tracking-tight">Top Losers</h3>
            </div>
            <span className="text-[11px] text-muted font-medium">24h</span>
          </div>
          <div className="space-y-1">
            {topLosers.map((quote) => (
              <Link
                key={quote.symbol}
                to={`/app/asset/${quote.symbol}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-panel transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold font-mono text-txt">{quote.symbol}</p>
                  <p className="text-[11px] text-muted truncate">{quote.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs font-semibold text-txt">{fmtPrice(quote.price)}</p>
                  <PriceChange value={quote.change24h} />
                </div>
              </Link>
            ))}
            {topLosers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted">No losers data available.</p>
            )}
          </div>
        </Card>

        {/* Watchlist Preview Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
            <div className="flex items-center gap-2">
              <Bookmark size={16} className="text-primary-500" />
              <h3 className="font-bold text-sm tracking-tight">Watchlist</h3>
            </div>
            {watchlist.length > 0 && (
              <Link to="/app/watchlist" className="text-xs font-semibold text-primary-500 hover:underline">
                View all
              </Link>
            )}
          </div>

          {watchlistPreview.length === 0 ? (
            <div className="my-auto py-6 text-center">
              <p className="text-xs text-muted">No assets watched yet.</p>
              <Link to="/app/markets" className="mt-2 inline-block">
                <Button variant="outline" size="sm">
                  Explore Markets
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {watchlistPreview.map(({ symbol, quote }) => (
                <Link
                  key={symbol}
                  to={`/app/asset/${symbol}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-panel transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold font-mono text-txt">{symbol}</p>
                    <p className="text-[11px] text-muted truncate">{quote?.name || symbol}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs font-semibold text-txt">
                      {quote ? fmtPrice(quote.price) : '—'}
                    </p>
                    {quote && <PriceChange value={quote.change24h} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base tracking-tight">Recent Transactions</h3>
            <p className="text-xs text-muted">Your latest completed paper trades</p>
          </div>
          {transactions.length > 0 && (
            <Link to="/app/transactions" className="text-xs font-semibold text-primary-500 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <EmptyState
            title="No transactions yet."
            message="Your completed demo trades will appear here."
            action={
              <Link to="/app/markets">
                <Button variant="primary" size="sm">
                  Start Trading
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Badge tone={txn.side === 'buy' ? 'up' : 'down'}>
                    {txn.side.toUpperCase()}
                  </Badge>
                  <div>
                    <p className="text-sm font-semibold font-mono text-txt">{txn.symbol}</p>
                    <p className="text-xs text-muted font-mono">{fmtTime(txn.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-txt">{fmtUSD(txn.total)}</p>
                  <p className="text-xs text-muted font-mono">
                    {fmtQty(txn.quantity)} @ {fmtPrice(txn.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
