import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { CRYPTO_ASSETS, FIAT_ASSETS } from '../lib/assets';
import { fmtTime } from '../lib/format';
import { Badge, Card, PageHeader } from '../components/ui';

interface QuickPreset {
  label: string;
  from: string;
  to: string;
  amount: string;
}

const PRESETS: QuickPreset[] = [
  { label: '100 USD → NGN', from: 'USD', to: 'NGN', amount: '100' },
  { label: '1 BTC → USD', from: 'BTC', to: 'USD', amount: '1' },
  { label: '1 ETH → USD', from: 'ETH', to: 'USD', amount: '1' },
  { label: '100 EUR → USD', from: 'EUR', to: 'USD', amount: '100' },
  { label: '1 SOL → USD', from: 'SOL', to: 'USD', amount: '1' },
];

export default function ConverterPage() {
  const { priceOf, getQuote, lastUpdated } = useMarket();
  const [fromSymbol, setFromSymbol] = useState('BTC');
  const [toSymbol, setToSymbol] = useState('USD');
  const [amountStr, setAmountStr] = useState('1');

  const amountNum = parseFloat(amountStr);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;

  const fromPrice = priceOf(fromSymbol);
  const toPrice = priceOf(toSymbol);

  const hasPrices = fromPrice > 0 && toPrice > 0;
  const resultNum = isValidAmount && hasPrices ? (amountNum * fromPrice) / toPrice : null;
  const unitRate = hasPrices ? fromPrice / toPrice : null;

  const fromQuote = getQuote(fromSymbol);
  const toQuote = getQuote(toSymbol);
  const isDemo = Boolean(fromQuote?.isDemo || toQuote?.isDemo);

  const handleSwap = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
  };

  const handlePreset = (preset: QuickPreset) => {
    setFromSymbol(preset.from);
    setToSymbol(preset.to);
    setAmountStr(preset.amount);
  };

  const formatResult = (val: number | null) => {
    if (val === null) return '—';
    if (val >= 1000) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (val >= 1) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  const formatRate = (val: number | null) => {
    if (val === null) return '—';
    if (val >= 1000) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (val >= 1) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Currency Converter"
        subtitle="Instant conversion between crypto assets and fiat currencies with live rate calculation"
      />

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted tracking-wider mr-1">
          Quick Presets:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-txt transition-colors hover:border-primary-500 hover:bg-surface"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Converter Card */}
      <Card className="p-6 space-y-6">
        {/* From Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="label">Amount</label>
            <input
              type="number"
              min="0"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Enter amount..."
              className="input font-mono text-lg font-semibold"
            />
          </div>
          <div>
            <label className="label">From</label>
            <select
              value={fromSymbol}
              onChange={(e) => setFromSymbol(e.target.value)}
              className="input font-mono font-semibold"
            >
              <optgroup label="Crypto Assets">
                {CRYPTO_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} - {a.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Fiat Currencies">
                {FIAT_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} - {a.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap Currencies"
            className="inline-flex items-center justify-center rounded-full border border-line bg-panel p-2.5 text-muted transition-colors hover:bg-surface hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>

        {/* To Section */}
        <div>
          <label className="label">To</label>
          <select
            value={toSymbol}
            onChange={(e) => setToSymbol(e.target.value)}
            className="input font-mono font-semibold"
          >
            <optgroup label="Crypto Assets">
              {CRYPTO_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} - {a.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Fiat Currencies">
              {FIAT_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} - {a.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Result Display Box */}
        <div className="rounded-xl border border-line bg-panel p-5 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted tracking-wide">
            Converted Result
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-3xl font-extrabold text-txt tracking-tight">
              {formatResult(resultNum)}
            </span>
            <span className="font-mono text-lg font-bold text-primary-500">
              {toSymbol}
            </span>
          </div>

          {/* Rate Line */}
          <div className="pt-2 border-t border-line/60 flex flex-wrap items-center justify-between text-xs text-muted">
            <span>
              1 {fromSymbol} = {formatRate(unitRate)} {toSymbol}
            </span>
            <span>
              rate as of {lastUpdated ? fmtTime(lastUpdated) : '—'}
            </span>
          </div>
        </div>

        {/* Demo Data Note */}
        {isDemo && (
          <div className="flex items-center gap-2 rounded-lg bg-primary-500/10 border border-primary-500/20 px-3 py-2 text-xs text-muted">
            <Badge tone="accent">DEMO</Badge>
            <span>Note: Rates are calculated using demo market rates.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
