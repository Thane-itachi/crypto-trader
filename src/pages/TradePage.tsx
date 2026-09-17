import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { CRYPTO_ASSETS } from '../lib/assets';
import { fmtPrice, fmtQty, fmtUSD } from '../lib/format';
import { useMarket } from '../context/MarketContext';
import { usePortfolio } from '../context/PortfolioContext';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { PriceChange } from '../components/market-bits';
import PriceChart from '../components/charts/PriceChart';
import type { Side } from '../types';

export default function TradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getQuote } = useMarket();
  const { cash, holdings, executeTrade } = usePortfolio();

  const paramSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const symbol = CRYPTO_ASSETS.some((a) => a.symbol === paramSymbol) ? paramSymbol : 'BTC';

  const [side, setSide] = useState<Side>(searchParams.get('side') === 'sell' ? 'sell' : 'buy');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Keep BUY/SELL tab in sync when navigated here with ?side=
  useEffect(() => {
    const s = searchParams.get('side');
    if (s === 'sell' || s === 'buy') setSide(s);
  }, [searchParams]);

  const quote = getQuote(symbol);
  const price = quote?.price ?? 0;
  const heldQty = holdings.find((h) => h.symbol === symbol)?.quantity ?? 0;
  const amountNum = parseFloat(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0;

  const estQty = valid && price > 0 && side === 'buy' ? amountNum / price : null;
  const estProceeds = valid && price > 0 && side === 'sell' ? amountNum * price : null;
  const available = side === 'buy' ? cash : heldQty;

  const insufficiency =
    !valid
      ? null
      : side === 'buy' && amountNum > cash
        ? 'Insufficient demo balance'
        : side === 'sell' && amountNum > heldQty
          ? `Insufficient ${symbol} balance`
          : null;

  const selectSymbol = (next: string) => {
    setResult(null);
    setAmount('');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('symbol', next);
      return p;
    });
  };

  const switchSide = (next: Side) => {
    setSide(next);
    setResult(null);
    setAmount('');
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('side', next);
      return p;
    });
  };

  const quick = (pct: number) => {
    const v = (side === 'buy' ? cash : heldQty) * pct;
    const rounded = side === 'buy' ? Math.round(v * 100) / 100 : Math.floor(v * 1e8) / 1e8;
    if (rounded > 0) setAmount(String(rounded));
  };

  const submit = async () => {
    if (!valid || insufficiency || busy || price <= 0) return;
    setBusy(true);
    setResult(null);
    const res =
      side === 'buy'
        ? await executeTrade(symbol, 'buy', amountNum, 'usd')
        : await executeTrade(symbol, 'sell', amountNum, 'qty');
    setResult(res);
    setBusy(false);
    if (res.ok) setAmount('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade"
        subtitle="Execute simulated market orders with your virtual DEMO FUNDS. PAPER TRADING only — no real money."
        actions={<Badge tone="accent">PAPER TRADING</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT: asset info + chart */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="label mb-0">Asset</label>
            <select
              value={symbol}
              onChange={(e) => selectSymbol(e.target.value)}
              className="input h-10 w-full sm:w-64"
            >
              {CRYPTO_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <PriceChart symbol={symbol} kind="crypto" height={340} />
        </Card>

        {/* RIGHT: trading panel */}
        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold">
              {symbol} / USD
            </span>
            {quote?.isDemo ? <Badge tone="accent">DEMO PRICE</Badge> : <Badge tone="up">LIVE</Badge>}
          </div>
          <p className="mt-1 font-mono text-2xl font-bold">{fmtPrice(price)}</p>
          <div className="mt-1 text-sm">
            <PriceChange value={quote?.change24h ?? null} />
            <span className="ml-2 text-xs text-muted">24h</span>
          </div>

          {/* BUY / SELL tabs */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => switchSide('buy')}
              className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                side === 'buy' ? 'bg-up text-white' : 'bg-panel text-muted hover:text-txt'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => switchSide('sell')}
              className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                side === 'sell' ? 'bg-down text-white' : 'bg-panel text-muted hover:text-txt'
              }`}
            >
              SELL
            </button>
          </div>

          {/* Order type */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Order type</span>
            <span className="flex items-center gap-1.5 font-semibold">
              Market
              <Info size={13} className="text-muted" aria-label="Market order executes at the current market price" />
            </span>
          </div>

          {/* Amount */}
          <div className="mt-4">
            <label className="label" htmlFor="trade-amount">
              Amount {side === 'buy' ? '(USD)' : `(${symbol})`}
            </label>
            <input
              id="trade-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={side === 'buy' ? '0.00' : '0.00000000'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input font-mono"
            />
            <div className="mt-2 flex gap-2">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <button
                  key={p}
                  onClick={() => quick(p)}
                  className="flex-1 rounded-md border border-line py-1 text-xs font-semibold text-muted transition-colors hover:border-primary-500/50 hover:text-txt"
                >
                  {p === 1 ? 'Max' : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Estimates */}
          <div className="mt-4 space-y-2 rounded-lg bg-panel p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Estimated price</span>
              <span className="font-mono font-semibold">{fmtPrice(price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">
                {side === 'buy' ? 'Estimated quantity' : 'Estimated proceeds'}
              </span>
              <span className="font-mono font-semibold">
                {side === 'buy'
                  ? estQty !== null
                    ? `${fmtQty(estQty)} ${symbol}`
                    : '—'
                  : estProceeds !== null
                    ? fmtUSD(estProceeds)
                    : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Available balance</span>
              <span className="font-mono font-semibold">
                {side === 'buy' ? (
                  <span className="flex items-center gap-1.5">
                    {fmtUSD(cash)} <Badge tone="accent">DEMO FUNDS</Badge>
                  </span>
                ) : (
                  `${fmtQty(heldQty)} ${symbol}`
                )}
              </span>
            </div>
          </div>

          {/* Validation banner */}
          {valid && insufficiency && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-xs font-semibold text-down">
              <AlertCircle size={14} />
              {insufficiency}
            </div>
          )}
          {valid && !insufficiency && price <= 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">
              <AlertCircle size={14} />
              Market price unavailable for {symbol}
            </div>
          )}

          {/* Submit */}
          <Button
            variant={side === 'buy' ? 'up' : 'down'}
            className="mt-4 w-full"
            size="lg"
            loading={busy}
            disabled={!valid || !!insufficiency || price <= 0}
            onClick={submit}
          >
            {side === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`}
          </Button>

          {/* Result banners */}
          {result?.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-up/30 bg-up/10 px-3 py-2 text-xs font-semibold text-up">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              {result.message}
            </div>
          )}
          {result && !result.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-xs font-semibold text-down">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {result.message}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Simulated market order. Every trade is validated server-side and recorded in your
            transaction history. Virtual funds only.
          </p>
        </Card>
      </div>
    </div>
  );
}
