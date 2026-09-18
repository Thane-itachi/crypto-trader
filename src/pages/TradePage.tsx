import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronDown, Info, Target } from 'lucide-react';
import { CRYPTO_ASSETS } from '../lib/assets';
import { fmtPrice, fmtQty, fmtUSD } from '../lib/format';
import { useMarket } from '../context/MarketContext';
import { usePortfolio } from '../context/PortfolioContext';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { PriceChange, CoinTickerStrip } from '../components/market-bits';
import PriceChart from '../components/charts/PriceChart';
import type { Side } from '../types';

export default function TradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getQuote, status } = useMarket();
  const { cash, holdings, executeTrade, createTPSLOrder } = usePortfolio();

  const paramSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const symbol = CRYPTO_ASSETS.some((a) => a.symbol === paramSymbol) ? paramSymbol : 'BTC';

  const [side, setSide] = useState<Side>(searchParams.get('side') === 'sell' ? 'sell' : 'buy');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showTPSL, setShowTPSL] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');

  // Keep BUY/SELL tab in sync when navigated here with ?side=
  useEffect(() => {
    const s = searchParams.get('side');
    if (s === 'sell' || s === 'buy') setSide(s);
  }, [searchParams]);

  // Live market quote for display and ESTIMATES. The final execution price is
  // fetched server-side at trade time — the client cannot set or predict it.
  const quote = getQuote(symbol);
  const estPrice = quote?.price ?? 0;

  const heldQty = holdings.find((h) => h.symbol === symbol)?.quantity ?? 0;
  const amountNum = parseFloat(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0;

  const estQty = valid && estPrice > 0 && side === 'buy' ? amountNum / estPrice : null;
  const estProceeds = valid && estPrice > 0 && side === 'sell' ? amountNum * estPrice : null;

  // UX hint only — the server makes the authoritative decision and records failed attempts.
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

  const tpNum = parseFloat(tpPrice);
  const slNum = parseFloat(slPrice);
  const tpWarn = side === 'buy' && tpNum > 0 && tpNum <= estPrice;
  const slWarn = side === 'buy' && slNum > 0 && slNum >= estPrice;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setResult(null);
    const res =
      side === 'buy'
        ? await executeTrade(symbol, 'buy', amountNum, 'usd')
        : await executeTrade(symbol, 'sell', amountNum, 'qty');
    setResult(res);
    if (res.ok) {
      setAmount('');
      // attach TP/SL to the exact executed quantity (server-authoritative)
      const qty = res.txn?.quantity ?? 0;
      if (qty > 0 && tpNum > 0) await createTPSLOrder(symbol, 'tp', tpNum, qty);
      if (qty > 0 && slNum > 0) await createTPSLOrder(symbol, 'sl', slNum, qty);
      setTpPrice('');
      setSlPrice('');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade"
        subtitle="Simulated market orders. The final price is fetched and verified server-side at execution. PAPER TRADING only — no real money."
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
              className="input h-10 w-full sm:w-64 sm:hidden"
            >
              {CRYPTO_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <CoinTickerStrip
            symbols={CRYPTO_ASSETS.map((a) => a.symbol)}
            selected={symbol}
            onSelect={selectSymbol}
            getQuote={getQuote}
          />

          <div className="mt-4">
            <PriceChart symbol={symbol} kind="crypto" height={340} />
          </div>
        </Card>

        {/* RIGHT: trading panel */}
        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold">{symbol} / USD</span>
            <Badge tone={quote?.isDemo ? 'accent' : 'up'}>{quote?.isDemo ? 'DEMO QUOTE' : 'LIVE QUOTE'}</Badge>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold">{fmtPrice(estPrice)}</p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-muted">24h:</span>
            <PriceChange value={quote?.change24h ?? null} />
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
              <Info size={13} className="text-muted" aria-label="Executed at the live server-verified price" />
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

          {/* Take-profit / Stop-loss (optional, buy side) */}
          {side === 'buy' && (
            <div className="mt-4">
              <button
                onClick={() => setShowTPSL((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary-500/50 hover:text-txt"
              >
                <span className="flex items-center gap-1.5">
                  <Target size={13} /> Take-profit / Stop-loss
                </span>
                <span className="flex items-center gap-2">
                  {(tpNum > 0 || slNum > 0) && (
                    <span className="rounded bg-primary-500/15 px-1.5 py-0.5 font-mono text-[10px] text-primary-500">
                      {(tpNum > 0 ? 'TP ' : '') + (slNum > 0 ? 'SL' : '')}
                    </span>
                  )}
                  <ChevronDown size={14} className={showTPSL ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </span>
              </button>
              {showTPSL && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-[10px]" htmlFor="tp-price">
                      Take-profit at
                    </label>
                    <input
                      id="tp-price"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder={`> ${fmtPrice(estPrice)}`}
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      className={`input font-mono text-xs ${tpWarn ? 'border-down/50' : ''}`}
                    />
                    <p className="mt-1 text-[10px] text-muted">Auto-sell when price rises to this level.</p>
                  </div>
                  <div>
                    <label className="label text-[10px]" htmlFor="sl-price">
                      Stop-loss at
                    </label>
                    <input
                      id="sl-price"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder={`< ${fmtPrice(estPrice)}`}
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      className={`input font-mono text-xs ${slWarn ? 'border-down/50' : ''}`}
                    />
                    <p className="mt-1 text-[10px] text-muted">Auto-sell to cut the loss if price drops here.</p>
                  </div>
                  {(tpWarn || slWarn) && (
                    <p className="col-span-2 flex items-start gap-1.5 rounded-md border border-down/30 bg-down/10 px-2 py-1.5 text-[10px] font-semibold text-down">
                      <AlertCircle size={11} className="mt-0.5 shrink-0" />
                      {tpWarn && 'Take-profit is at or below the current price — it would trigger immediately. '}
                      {slWarn && 'Stop-loss is at or above the current price — it would trigger immediately.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Estimates */}
          <div className="mt-4 space-y-2 rounded-lg bg-panel p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Est. price (live)</span>
              <span className="font-mono font-semibold">{fmtPrice(estPrice)}</span>
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

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            Estimates use the live quote shown here. Your order executes at the price the server
            fetches at execution time — final price and quantity may differ slightly.
          </p>

          {/* Insufficient balance warning (non-blocking: the server validates and records failed attempts) */}
          {valid && insufficiency && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-xs font-semibold text-down">
              <AlertCircle size={14} />
              {insufficiency}
            </div>
          )}

          {/* Submit */}
          <Button
            variant={side === 'buy' ? 'up' : 'down'}
            className="mt-4 w-full"
            size="lg"
            loading={busy}
            disabled={!valid}
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
            Simulated market order. The execution price, every balance check, and the transaction
            record are produced server-side. Virtual funds only
            {status === 'demo' ? ' — display quotes are currently in DEMO fallback mode.' : '.'}
          </p>
        </Card>
      </div>
    </div>
  );
}
