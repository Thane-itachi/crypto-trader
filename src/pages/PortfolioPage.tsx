import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { useMarket } from '../context/MarketContext';
import { findAsset } from '../lib/assets';
import { fmtPct, fmtPrice, fmtQty, fmtSignedUSD, fmtUSD } from '../lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import AllocationPie from '../components/charts/AllocationPie';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { priceOf } = useMarket();
  const {
    loading,
    cash,
    holdings,
    portfolioValue,
    investedValue,
    unrealizedPL,
    realizedPL,
    totalPL,
    totalPLPercent,
  } = usePortfolio();

  const holdingRows = useMemo(() => {
    return holdings.map((h) => {
      const currentPrice = priceOf(h.symbol);
      const currentValue = h.quantity * currentPrice;
      const invested = h.quantity * h.avg_price;
      const pl = currentValue - invested;
      const plPct = invested > 0 ? (pl / invested) * 100 : 0;
      const assetDef = findAsset(h.symbol);

      return {
        ...h,
        name: assetDef?.name || h.symbol,
        currentPrice,
        currentValue,
        pl,
        plPct,
      };
    });
  }, [holdings, priceOf]);

  const pieData = useMemo(() => {
    return holdingRows.map((h) => ({
      symbol: h.symbol,
      value: h.currentValue,
    }));
  }, [holdingRows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Manage your holdings and evaluate total asset allocation."
        actions={
          <Link to="/app/markets">
            <Button variant="primary" size="md">
              Explore Markets
            </Button>
          </Link>
        }
      />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Value</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-2 text-2xl font-bold font-mono text-txt">{fmtUSD(portfolioValue)}</p>
          )}
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total P/L</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <p className={`text-2xl font-bold font-mono ${totalPL >= 0 ? 'text-up' : 'text-down'}`}>
                {fmtSignedUSD(totalPL)}
              </p>
              <span className={`text-sm font-semibold font-mono ${totalPL >= 0 ? 'text-up' : 'text-down'}`}>
                ({fmtPct(totalPLPercent)})
              </span>
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Unrealized P/L</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={`mt-2 text-2xl font-bold font-mono ${unrealizedPL >= 0 ? 'text-up' : 'text-down'}`}>
              {fmtSignedUSD(unrealizedPL)}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted">Open holdings only</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Realized P/L</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className={`mt-2 text-2xl font-bold font-mono ${realizedPL >= 0 ? 'text-up' : 'text-down'}`}>
              {fmtSignedUSD(realizedPL)}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted">From closed positions</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Invested</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-2 text-2xl font-bold font-mono text-txt">{fmtUSD(investedValue)}</p>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Cash</p>
            <Badge tone="accent">DEMO</Badge>
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-2 text-2xl font-bold font-mono text-txt">{fmtUSD(cash)}</p>
          )}
          <p className="mt-1 text-[11px] text-muted">Virtual DEMO FUNDS</p>
        </div>
      </div>

      {/* Grid: Holdings Table (2fr) + Allocation Pie (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base tracking-tight">Holdings</h3>
              <span className="text-xs font-mono text-muted">
                {holdingRows.length} {holdingRows.length === 1 ? 'asset' : 'assets'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-4 py-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : holdingRows.length === 0 ? (
              <EmptyState
                title="No holdings yet."
                message="You don't own any assets in your paper trading portfolio. Buy your first crypto asset to get started."
                action={
                  <Button variant="primary" onClick={() => navigate('/app/markets')}>
                    Buy your first asset
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                      <th className="py-3 px-3">Asset</th>
                      <th className="py-3 px-3 text-right">Quantity</th>
                      <th className="py-3 px-3 text-right">Avg Entry</th>
                      <th className="py-3 px-3 text-right">Current Price</th>
                      <th className="py-3 px-3 text-right">Value</th>
                      <th className="py-3 px-3 text-right">P/L</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-mono">
                    {holdingRows.map((row) => (
                      <tr
                        key={row.symbol}
                        onClick={() => navigate(`/app/asset/${row.symbol}`)}
                        className="cursor-pointer hover:bg-panel transition-colors"
                      >
                        <td className="py-3 px-3 font-sans">
                          <p className="font-semibold text-txt">{row.name}</p>
                          <p className="text-xs text-muted font-mono">{row.symbol}</p>
                        </td>
                        <td className="py-3 px-3 text-right text-txt">{fmtQty(row.quantity)}</td>
                        <td className="py-3 px-3 text-right text-txt">{fmtPrice(row.avg_price)}</td>
                        <td className="py-3 px-3 text-right text-txt">{fmtPrice(row.currentPrice)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-txt">
                          {fmtUSD(row.currentValue)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            row.pl >= 0 ? 'text-up' : 'text-down'
                          }`}
                        >
                          {fmtSignedUSD(row.pl)}
                          <span className="block text-[11px] font-normal">({fmtPct(row.plPct)})</span>
                        </td>
                        <td
                          className="py-3 px-3 text-right font-sans"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="down"
                            size="sm"
                            onClick={() =>
                              navigate(`/app/trade?symbol=${row.symbol}&side=sell`)
                            }
                          >
                            Sell
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <div>
          <AllocationPie data={pieData} />
        </div>
      </div>
    </div>
  );
}
