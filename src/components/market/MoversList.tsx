import { Link } from 'react-router-dom';
import type { Quote } from '../../types';
import { Card } from '../ui';
import { PriceChange } from '../market-bits';

interface MoversListProps {
  title: string;
  items: Quote[];
}

export default function MoversList({ title, items }: MoversListProps) {
  return (
    <Card className="p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{title}</h3>
      {!items || items.length === 0 ? (
        <p className="text-xs text-muted py-2">No data yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.symbol}
              to={`/app/asset/${item.symbol}`}
              className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-panel"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-txt">{item.symbol}</span>
                <span className="truncate text-xs text-muted">{item.name}</span>
              </div>
              <PriceChange value={item.change24h} />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
