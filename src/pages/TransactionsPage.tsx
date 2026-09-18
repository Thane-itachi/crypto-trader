import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { findAsset } from '../lib/assets';
import { fmtDate, fmtPrice, fmtQty, fmtTime, fmtUSD } from '../lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';

export default function TransactionsPage() {
  const { transactions, loading } = usePortfolio();
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const assetOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      if (t.symbol) set.add(t.symbol.toUpperCase());
    }
    return Array.from(set).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (sideFilter !== 'all') {
      list = list.filter((t) => t.side === sideFilter);
    }

    if (assetFilter !== 'all') {
      list = list.filter((t) => t.symbol.toUpperCase() === assetFilter.toUpperCase());
    }

    list.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [transactions, sideFilter, assetFilter, sortOrder]);

  const isFiltered = sideFilter !== 'all' || assetFilter !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction History"
        subtitle="Full log of your paper trade executions and simulated orders."
        actions={
          <Link to="/app/markets">
            <Button variant="primary" size="md">
              New Trade
            </Button>
          </Link>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Side Filter Segmented Buttons */}
          <div className="flex items-center gap-1 bg-panel p-1 rounded-lg border border-line">
            {(['all', 'buy', 'sell'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setSideFilter(side)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  sideFilter === side
                    ? 'bg-surface text-txt shadow-sm border border-line'
                    : 'text-muted hover:text-txt'
                }`}
              >
                {side.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Asset Select and Sort Select */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted">Asset:</label>
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-txt outline-none focus:border-primary-500"
              >
                <option value="all">All Assets</option>
                {assetOptions.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted">Sort:</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-txt outline-none focus:border-primary-500"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions Table Card */}
      <Card className="p-5">
        {loading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet."
            message="Your completed demo trades will appear here."
            action={
              <Link to="/app/markets">
                <Button variant="primary">Explore Markets</Button>
              </Link>
            }
          />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="No transactions match your filters."
            message="Try adjusting or resetting your filter criteria to view more records."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSideFilter('all');
                  setAssetFilter('all');
                }}
              >
                Reset Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {filteredTransactions.map((txn) => {
                  const assetDef = findAsset(txn.symbol);
                  return (
                    <tr key={txn.id} className="hover:bg-panel transition-colors">
                      <td className="py-3 px-3 font-sans text-xs">
                        <span className="font-mono text-txt">{fmtDate(txn.created_at)}</span>
                        <span className="block text-muted font-mono">{fmtTime(txn.created_at)}</span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className="font-semibold text-txt">{txn.symbol}</span>
                        {assetDef && <span className="block text-xs text-muted">{assetDef.name}</span>}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <Badge tone={txn.side === 'buy' ? 'up' : 'down'}>
                          {txn.side.toUpperCase()}
                        </Badge>
                        {txn.reason === 'take_profit' && (
                          <Badge tone="up" className="ml-1.5">TP</Badge>
                        )}
                        {txn.reason === 'stop_loss' && (
                          <Badge tone="down" className="ml-1.5">SL</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-txt">{fmtQty(txn.quantity)}</td>
                      <td className="py-3 px-3 text-right text-txt">{fmtPrice(txn.price)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-txt">
                        {fmtUSD(txn.total)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <Badge tone={txn.status === 'completed' ? 'up' : 'down'}>
                          {txn.status === 'completed' ? 'Completed' : 'Failed'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
