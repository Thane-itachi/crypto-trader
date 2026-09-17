const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const usdExact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
});

export function fmtUSD(n: number | null | undefined, exact = false): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return exact ? usdExact.format(n) : usd.format(n);
}

export function fmtPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const digits = n >= 1000 ? 2 : n >= 1 ? 3 : 6;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtQty(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function fmtSignedUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const s = fmtUSD(Math.abs(n));
  return `${n >= 0 ? '+' : '-'}${s}`;
}

export function fmtTime(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtDateTime(ts: string): string {
  return `${fmtDate(ts)} · ${fmtTime(ts)}`;
}
