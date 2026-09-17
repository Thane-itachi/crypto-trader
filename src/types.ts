export type AssetKind = 'crypto' | 'fiat';
export type MarketStatus = 'loading' | 'live' | 'demo' | 'unavailable';
export type ChartRange = '1H' | '1D' | '1W' | '1M' | '3M' | '1Y';
export type Side = 'buy' | 'sell';

export interface AssetDef {
  id: string; // provider id (coingecko id, or fiat code lowercased)
  symbol: string;
  name: string;
  kind: AssetKind;
}

export interface Quote {
  symbol: string;
  name: string;
  kind: AssetKind;
  price: number; // USD value of 1 unit
  change24h: number | null; // percentage
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  updatedAt: number; // epoch ms
  isDemo: boolean;
}

export interface ChartPoint {
  t: number; // epoch ms
  p: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avg_price: number;
}

export interface Txn {
  id: string;
  created_at: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  total: number;
  status: 'completed' | 'failed';
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: string;
  notif_trades: boolean;
  notif_market: boolean;
}

export interface TradeResult {
  ok: boolean;
  message: string;
}

export type TradeAmountType = 'usd' | 'qty';
