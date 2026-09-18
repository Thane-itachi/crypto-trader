// Vercel Serverless Function: /api/quotes
//
// Root cause of "Market data temporarily unavailable" firing constantly:
// the browser previously called CoinGecko's public /coins/markets endpoint
// (and open.er-api for FX) DIRECTLY from every visitor's tab, once per 30s
// poll. CoinGecko's free public tier rate-limits extremely aggressively —
// verified empirically: ~4 requests within a few seconds is enough to start
// getting HTTP 429, and it does not quickly recover. With N independent
// browser tabs each polling on their own schedule, 429s (and the resulting
// "demo mode" fallback) were near-constant rather than rare.
//
// Fix: centralize the upstream calls here, server-side, shared by ALL
// users. One shared in-memory cache (warm across requests on the same
// lambda instance) means CoinGecko/FX are hit at most once every ~20s
// TOTAL, regardless of how many users are online — nowhere near the rate
// limit. A Firestore-backed snapshot survives cold starts, so even a fresh
// lambda instance serves a recent REAL price (not synthetic demo data)
// while it fetches a new one in the background.
//
// No auth required — this is public, read-only market data.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const COINGECKO = 'https://api.coingecko.com/api/v3';
const FX_API = 'https://open.er-api.com/v6/latest/USD';

const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  BNB: 'binancecoin',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
};
const FIAT_CODES = ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'CAD', 'AUD', 'CHF'];

interface QuoteDTO {
  symbol: string;
  price: number;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
}

const MEMORY_TTL_MS = 20_000; // absorbs bursts across requests on a warm instance
const FIRESTORE_MAX_AGE_MS = 10 * 60 * 1000; // don't serve real data older than this as "live"

let memCache: { crypto: QuoteDTO[] | null; fiat: QuoteDTO[] | null; at: number } = {
  crypto: null,
  fiat: null,
  at: 0,
};

function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function fetchLiveCrypto(): Promise<QuoteDTO[]> {
  const ids = Object.values(CRYPTO_IDS).join(',');
  const res = await fetch(`${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=24h`);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
  const byId = new Map(data.map((d: any) => [d.id, d]));
  const bySymbol = Object.entries(CRYPTO_IDS)
    .filter(([, id]) => byId.has(id))
    .map(([symbol, id]) => {
      const d = byId.get(id) as any;
      return {
        symbol,
        price: d.current_price,
        change24h: d.price_change_percentage_24h ?? null,
        high24h: d.high_24h ?? null,
        low24h: d.low_24h ?? null,
        volume24h: d.total_volume ?? null,
        marketCap: d.market_cap ?? null,
      };
    });
  if (bySymbol.length === 0) throw new Error('no matching ids');
  return bySymbol;
}

async function fetchLiveFiat(): Promise<QuoteDTO[]> {
  const res = await fetch(FX_API);
  if (!res.ok) throw new Error(`FX ${res.status}`);
  const data = await res.json();
  const rates: Record<string, number> = data?.rates;
  if (!rates || !rates.EUR) throw new Error('bad FX payload');
  return FIAT_CODES.map((code) => ({
    symbol: code,
    price: code === 'USD' ? 1 : 1 / (rates[code] ?? 0),
    change24h: code === 'USD' ? 0 : null,
    high24h: null,
    low24h: null,
    volume24h: null,
    marketCap: null,
  }));
}

async function readFirestoreCache(key: string): Promise<{ quotes: QuoteDTO[]; updatedAt: number } | null> {
  try {
    const snap = await getDb().doc(`market_cache/${key}`).get();
    const data = snap.data();
    const updatedAt = data?.updated_at as Timestamp | undefined;
    if (data?.quotes && updatedAt) {
      const age = Date.now() - updatedAt.toMillis();
      if (age <= FIRESTORE_MAX_AGE_MS) return { quotes: data.quotes, updatedAt: updatedAt.toMillis() };
    }
  } catch {
    // no cache available — treat as none
  }
  return null;
}

function writeFirestoreCache(key: string, quotes: QuoteDTO[]) {
  getDb()
    .doc(`market_cache/${key}`)
    .set({ quotes, updated_at: FieldValue.serverTimestamp() })
    .catch(() => {});
}

async function resolveGroup(key: 'crypto' | 'fiat', fetcher: () => Promise<QuoteDTO[]>) {
  try {
    const quotes = await fetcher();
    memCache[key] = quotes;
    memCache.at = Date.now();
    writeFirestoreCache(key, quotes);
    return { live: true, quotes, updatedAt: Date.now() };
  } catch {
    const cached = await readFirestoreCache(key);
    if (cached) return { live: true, quotes: cached.quotes, updatedAt: cached.updatedAt };
    return { live: false, quotes: null, updatedAt: Date.now() };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=15, stale-while-revalidate=30');

  const fresh = Date.now() - memCache.at < MEMORY_TTL_MS;
  if (fresh && memCache.crypto && memCache.fiat) {
    return res.status(200).json({
      crypto: { live: true, quotes: memCache.crypto, updatedAt: memCache.at },
      fiat: { live: true, quotes: memCache.fiat, updatedAt: memCache.at },
    });
  }

  const [crypto, fiat] = await Promise.all([
    resolveGroup('crypto', fetchLiveCrypto),
    resolveGroup('fiat', fetchLiveFiat),
  ]);

  return res.status(200).json({ crypto, fiat });
}
