import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolio } from '../../context/PortfolioContext';
import { fmtUSD } from '../../lib/format';
import { Card } from '../ui';

interface AllocationPieProps {
  data: { symbol: string; value: number }[];
}

const PALETTE = ['#14b8a6', '#0d9488', '#5bd8c5', '#93e9da', '#2dd4bf', '#3b82f6', '#6366f1'];

export default function AllocationPie({ data }: AllocationPieProps) {
  const { cash } = usePortfolio();

  const slices = useMemo(() => {
    const list: { symbol: string; value: number }[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.value > 0) {
          list.push({ symbol: item.symbol, value: item.value });
        }
      }
    }

    if (cash > 0) {
      list.push({ symbol: 'USD Cash', value: cash });
    }

    return list;
  }, [data, cash]);

  const totalValue = useMemo(() => {
    return slices.reduce((sum, s) => sum + s.value, 0);
  }, [slices]);

  if (slices.length === 0 || totalValue <= 0) {
    return (
      <Card className="p-5 flex flex-col items-center justify-center min-h-[260px] text-center">
        <p className="text-sm font-semibold text-muted">No holdings yet.</p>
        <p className="mt-1 text-xs text-muted">Buy crypto or fiat assets to see portfolio allocation.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 flex flex-col justify-between">
      <h3 className="font-bold text-base tracking-tight mb-3">Asset Allocation</h3>
      <div className="h-48 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0].payload as { symbol: string; value: number };
                const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0';
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-txt">{item.symbol}</p>
                    <p className="font-mono text-muted">{fmtUSD(item.value)} ({pct}%)</p>
                  </div>
                );
              }}
            />
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              dataKey="value"
              nameKey="symbol"
            >
              {slices.map((entry, index) => (
                <Cell
                  key={`slice-${entry.symbol}-${index}`}
                  fill={PALETTE[index % PALETTE.length]}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-line text-xs">
        {slices.map((slice, i) => {
          const pct = ((slice.value / totalValue) * 100).toFixed(1);
          const color = PALETTE[i % PALETTE.length];
          return (
            <div key={slice.symbol} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="font-medium text-txt">{slice.symbol}</span>
              <span className="font-mono text-muted">{pct}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
