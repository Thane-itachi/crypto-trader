import type { AssetDef } from '../types';

export const CRYPTO_ASSETS: AssetDef[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', kind: 'crypto' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', kind: 'crypto' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', kind: 'crypto' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', kind: 'crypto' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', kind: 'crypto' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', kind: 'crypto' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', kind: 'crypto' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', kind: 'crypto' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', kind: 'crypto' },
];

const FIAT_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  NGN: 'Nigerian Naira',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  CHF: 'Swiss Franc',
};

export const FIAT_CODES = Object.keys(FIAT_NAMES);

export const FIAT_ASSETS: AssetDef[] = FIAT_CODES.map((code) => ({
  id: code.toLowerCase(),
  symbol: code,
  name: FIAT_NAMES[code],
  kind: 'fiat' as const,
}));

export const ALL_ASSETS: AssetDef[] = [...CRYPTO_ASSETS, ...FIAT_ASSETS];

export function findAsset(symbol: string): AssetDef | undefined {
  return ALL_ASSETS.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
}

const SEARCH_ALIASES: Record<string, string> = {
  xbt: 'BTC',
  eth: 'ETH',
  xrp: 'XRP',
  naira: 'NGN',
  dollar: 'USD',
  euro: 'EUR',
  pound: 'GBP',
  yen: 'JPY',
  franc: 'CHF',
};

export function searchAssets(query: string): AssetDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const aliasMatch = SEARCH_ALIASES[q] ? findAsset(SEARCH_ALIASES[q]) : undefined;
  const matches = ALL_ASSETS.filter(
    (a) =>
      a.symbol.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.id.includes(q),
  );
  if (aliasMatch && !matches.some((m) => m.symbol === aliasMatch.symbol)) {
    return [aliasMatch, ...matches];
  }
  return matches;
}

// Base prices used by the demo-data fallback provider (roughly realistic anchors)
export const DEMO_BASE_PRICES: Record<string, { price: number; volatility: number }> = {
  BTC: { price: 63250, volatility: 0.012 },
  ETH: { price: 2620, volatility: 0.016 },
  SOL: { price: 148, volatility: 0.022 },
  XRP: { price: 0.58, volatility: 0.02 },
  BNB: { price: 575, volatility: 0.014 },
  ADA: { price: 0.42, volatility: 0.02 },
  DOGE: { price: 0.12, volatility: 0.03 },
  USDT: { price: 1.0, volatility: 0.0005 },
  USDC: { price: 1.0, volatility: 0.0005 },
  USD: { price: 1, volatility: 0 },
  EUR: { price: 1.08, volatility: 0.002 },
  GBP: { price: 1.27, volatility: 0.002 },
  NGN: { price: 0.00062, volatility: 0.003 },
  JPY: { price: 0.0066, volatility: 0.002 },
  CAD: { price: 0.73, volatility: 0.002 },
  AUD: { price: 0.66, volatility: 0.002 },
  CHF: { price: 1.13, volatility: 0.002 },
};
