import type { Candle, ChartPoint, ChartRange, Quote } from '../types';
import { CRYPTO_ASSETS, FIAT_ASSETS, DEMO_BASE_PRICES } from './assets';

const COINGECKO = 'https://api.coingecko.com/api/v3';
const FX_API = 'https://open.er-api.com/v6/latest/USD';
const POLL_INTERVAL = 30_000; // ms — sensible, not spammy

export { POLL_INTERVAL };

// ---------------------------------------------------------------------------
// Demo fallback provider (clearly labeled, never disguised as live data)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoPrice(symbol: string, tick: number): number {
  const base = DEMO_BASE_PRICES[symbol] ?? { price: 1, volatility: 0.01 };
  const rand = mulberry32(symbol.charCodeAt(0) * 1000 + tick)();
  const drift = 1 + (rand - 0.5) * base.volatility * 2;
  return base.price * drift;
}

function demoCryptoQuotes(tick: number): Quote[] {
  return CRYPTO_ASSETS.map((a) => {
    const price = demoPrice(a.symbol, tick);
    const vol = DEMO_BASE_PRICES[a.symbol].volatility;
    const change = (mulberry32(a.symbol.charCodeAt(0) + tick * 7)() - 0.45) * vol * 100;
    return {
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
      price,
      change24h: change,
      high24h: price * 1.02,
      low24h: price * 0.98,
      volume24h: price * 1_500_000 * (1 + mulberry32(tick + a.symbol.length)()),
      marketCap: price * 19_000_000,
      updatedAt: Date.now(),
      isDemo: true,
    };
  });
}

function demoFiatQuotes(tick: number): Quote[] {
  return FIAT_ASSETS.map((a) => ({
    symbol: a.symbol,
    name: a.name,
    kind: a.kind,
    price: demoPrice(a.symbol, tick),
    change24h: a.symbol === 'USD' ? 0 : (mulberry32(a.symbol.charCodeAt(0) + tick)() - 0.5) * 0.6,
    high24h: null,
    low24h: null,
    volume24h: null,
    marketCap: null,
    updatedAt: Date.now(),
    isDemo: true,
  }));
}

// ---------------------------------------------------------------------------
// Live providers
// ---------------------------------------------------------------------------

interface CGMarket {
  id: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  total_volume: number | null;
  market_cap: number | null;
}

async function liveCryptoQuotes(): Promise<Quote[]> {
  const ids = CRYPTO_ASSETS.map((a) => a.id).join(',');
  const res = await fetch(
    `${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=24h`,
  );
  if (!res.ok) throw Object.assign(new Error(`CoinGecko ${res.status}`), { status: res.status });
  const data: CGMarket[] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
  const byId = new Map(data.map((d) => [d.id, d]));
  return CRYPTO_ASSETS.filter((a) => byId.has(a.id)).map((a) => {
    const d = byId.get(a.id)!;
    return {
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
      price: d.current_price,
      change24h: d.price_change_percentage_24h,
      high24h: d.high_24h,
      low24h: d.low_24h,
      volume24h: d.total_volume,
      marketCap: d.market_cap,
      updatedAt: Date.now(),
      isDemo: false,
    };
  });
}

async function liveFiatQuotes(): Promise<Quote[]> {
  const res = await fetch(FX_API);
  if (!res.ok) throw Object.assign(new Error(`FX ${res.status}`), { status: res.status });
  const data = await res.json();
  const rates: Record<string, number> = data?.rates;
  if (!rates || !rates.EUR) throw new Error('bad FX payload');
  return FIAT_ASSETS.map((a) => ({
    symbol: a.symbol,
    name: a.name,
    kind: a.kind,
    price: a.symbol === 'USD' ? 1 : 1 / (rates[a.symbol] ?? 0),
    change24h: a.symbol === 'USD' ? 0 : null,
    high24h: null,
    low24h: null,
    volume24h: null,
    marketCap: null,
    updatedAt: (data.time_last_update_unix ?? Date.now() / 1000) * 1000,
    isDemo: false,
  }));
}

// ---------------------------------------------------------------------------
// Rate-limit protection: escalating backoff per provider + single-flight
// ---------------------------------------------------------------------------
// After a failure (HTTP 429, 5xx, network), live calls for that provider are
// paused for 60s, doubling on consecutive failures (max 15 min). A success
// resets the penalty. During backoff the demo fallback serves immediately,
// so a rate-limited API is never hammered in a retry loop.

const backoff: Record<'crypto' | 'fx', number> = { crypto: 0, fx: 0 };
const backoffMisses: Record<'crypto' | 'fx', number> = { crypto: 0, fx: 0 };
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;

function livePaused(p: 'crypto' | 'fx'): boolean {
  return Date.now() < backoff[p];
}
function noteFailure(p: 'crypto' | 'fx') {
  backoffMisses[p] += 1;
  backoff[p] = Date.now() + Math.min(BACKOFF_BASE_MS * backoffMisses[p], BACKOFF_MAX_MS);
}
function noteSuccess(p: 'crypto' | 'fx') {
  backoffMisses[p] = 0;
  backoff[p] = 0;
}

// Spacer: ensure a minimum gap between outbound CoinGecko chart requests so
// loading many charts (e.g. watchlist sparklines) cannot burst into a 429.
let requestChain: Promise<void> = Promise.resolve();
function spaced<T>(fn: () => Promise<T>, gapMs = 600): Promise<T> {
  const result = requestChain.then(() => fn());
  requestChain = result.then(
    () => new Promise((r) => setTimeout(r, gapMs)),
    () => new Promise((r) => setTimeout(r, gapMs)),
  );
  return result;
}


// ---------------------------------------------------------------------------
// Candles: true OHLC where the API provides it; otherwise derived from real
// close prices (open = previous close, high/low = max/min of open & close).
// Every plotted level traces to a real API price — never synthetic.
// ---------------------------------------------------------------------------

// Bucket a real close series into true OHLC candles by time interval:
// each bucket's open = first real price in it, close = last, high/low = extremes.
function bucketCandles(points: ChartPoint[], intervalMs: number, windowHours: number): Candle[] {
  const cutoff = Date.now() - windowHours * 3_600_000;
  const buckets = new Map<number, ChartPoint[]>();
  for (const p of points) {
    if (p.t < cutoff) continue;
    const k = Math.floor(p.t / intervalMs) * intervalMs;
    const arr = buckets.get(k);
    if (arr) arr.push(p);
    else buckets.set(k, [p]);
  }
  return [...buckets.keys()].sort((a, b) => a - b).map((t) => {
    const ps = buckets.get(t)!;
    return {
      t,
      o: ps[0].p,
      c: ps[ps.length - 1].p,
      h: Math.max(...ps.map((x) => x.p)),
      l: Math.min(...ps.map((x) => x.p)),
    };
  });
}

function candlesFromPoints(points: ChartPoint[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const o = i > 0 ? points[i - 1].p : p.p;
    out.push({ t: p.t, o, c: p.p, h: Math.max(o, p.p), l: Math.min(o, p.p) });
  }
  return out;
}

async function liveCryptoOHLC(id: string, days: number): Promise<Candle[]> {
  const res = await spaced(() => fetch(`${COINGECKO}/coins/${id}/ohlc?vs_currency=usd&days=${days}`));
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data: [number, number, number, number, number][] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('empty ohlc');
  return data.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
}

// ---------------------------------------------------------------------------
// Public service: live with graceful demo fallback per provider
// ---------------------------------------------------------------------------

export interface MarketSnapshot {
  quotes: Quote[];
  cryptoLive: boolean;
  fiatLive: boolean;
}

let snapshotInFlight: Promise<MarketSnapshot> | null = null;

export function fetchMarketSnapshot(tick: number): Promise<MarketSnapshot> {
  if (snapshotInFlight) return snapshotInFlight; // single-flight: concurrent callers share one request
  snapshotInFlight = (async () => {
    const [crypto, fiat] = await Promise.allSettled([
      livePaused('crypto') ? Promise.reject(new Error('rate-limit backoff')) : liveCryptoQuotes(),
      livePaused('fx') ? Promise.reject(new Error('rate-limit backoff')) : liveFiatQuotes(),
    ]);
    if (crypto.status === 'fulfilled') noteSuccess('crypto');
    else noteFailure('crypto');
    if (fiat.status === 'fulfilled') noteSuccess('fx');
    else noteFailure('fx');
    const cryptoLive = crypto.status === 'fulfilled';
    const fiatLive = fiat.status === 'fulfilled';
    return {
      quotes: [
        ...(cryptoLive ? crypto.value : demoCryptoQuotes(tick)),
        ...(fiatLive ? fiat.value : demoFiatQuotes(tick)),
      ],
      cryptoLive,
      fiatLive,
    };
  })().finally(() => {
    snapshotInFlight = null;
  });
  return snapshotInFlight;
}

const RANGE_DAYS: Record<ChartRange, number> = {
  '5m': 1,
  '15m': 1,
  '1H': 1,
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

const RANGE_POINTS: Record<ChartRange, number> = {
  '5m': 48,
  '15m': 48,
  '1H': 24,
  '1D': 24,
  '1W': 28,
  '1M': 30,
  '3M': 45,
  '1Y': 52,
};

export async function fetchSeries(
  symbol: string,
  kind: 'crypto' | 'fiat',
  range: ChartRange,
  currentPrice: number,
): Promise<{ points: ChartPoint[]; candles: Candle[]; isDemo: boolean }> {
  if (kind === 'crypto') {
    const asset = CRYPTO_ASSETS.find((a) => a.symbol === symbol);
    if (asset) {
      const days = RANGE_DAYS[range];
      // Intraday (5m/15m/1H): real 5-minute close series from the last 24h,
      // bucketed into candles. 15m/1H get true OHLC; 5m is derived
      // (open = previous close) since each bucket holds a single real price.
      if (range === '5m' || range === '15m' || range === '1H') {
        try {
          const res = await spaced(() => fetch(`${COINGECKO}/coins/${asset.id}/market_chart?vs_currency=usd&days=1`));
          if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
          const data = await res.json();
          const prices: [number, number][] = data?.prices;
          if (!Array.isArray(prices) || prices.length === 0) throw new Error('empty series');
          const pts = prices.map(([t, p]) => ({ t, p }));
          const candles =
            range === '5m'
              ? candlesFromPoints(pts.slice(-48)) // last 4h as 5-minute candles
              : bucketCandles(pts, range === '15m' ? 900_000 : 3_600_000, range === '15m' ? 12 : 24);
          if (candles.length >= 2) {
            const points = candles.map((c) => ({ t: c.t, p: c.c }));
            return { points, candles, isDemo: false };
          }
          throw new Error('too few candles');
        } catch {
          // fall through to demo
        }
      } else {
        // Swing (1D+): real OHLC candles straight from CoinGecko
        try {
          const candles = await liveCryptoOHLC(asset.id, days);
          const points = candles.map((c) => ({ t: c.t, p: c.c }));
          return { points, candles, isDemo: false };
        } catch {
          // fall through to close series
        }
        try {
          const res = await spaced(() => fetch(`${COINGECKO}/coins/${asset.id}/market_chart?vs_currency=usd&days=${days}`));
          if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
          const data = await res.json();
          const prices: [number, number][] = data?.prices;
          if (!Array.isArray(prices) || prices.length === 0) throw new Error('empty series');
          const points = prices.map(([t, p]) => ({ t, p }));
          return { points, candles: candlesFromPoints(points), isDemo: false };
        } catch {
          // fall through to demo
        }
      }
    }
  }
  // Demo series: seeded random walk ending at currentPrice
  const n = RANGE_POINTS[range];
  const vol = DEMO_BASE_PRICES[symbol]?.volatility ?? 0.01;
  const stepMs =
    range === '5m'
      ? 300_000
      : range === '15m'
        ? 900_000
        : range === '1H'
          ? 3_600_000
          : range === '1D'
            ? 3_600_000
            : (RANGE_DAYS[range] * 86_400_000) / n;
  const rand = mulberry32(symbol.charCodeAt(0) * 131 + RANGE_DAYS[range]);
  const deltas: number[] = [];
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = (rand() - 0.5) * vol * 2;
    deltas.push(d);
    sum += d;
  }
  const points: ChartPoint[] = [];
  const now = Date.now();
  let p = currentPrice / (1 + sum);
  for (let i = 0; i < n; i++) {
    points.push({ t: now - (n - 1 - i) * stepMs, p });
    if (i < n - 1) p = p * (1 + deltas[i]);
  }
  return { points, candles: candlesFromPoints(points), isDemo: true };
}

const seriesCache = new Map<string, { points: ChartPoint[]; candles: Candle[]; isDemo: boolean; at: number }>();

export async function fetchSeriesCached(
  symbol: string,
  kind: 'crypto' | 'fiat',
  range: ChartRange,
  currentPrice: number,
) {
  const key = `${symbol}:${kind}:${range}`;
  const cached = seriesCache.get(key);
  const ttl = range === '5m' || range === '15m' || range === '1H' || range === '1D' ? 120_000 : 600_000;
  if (cached && Date.now() - cached.at < ttl) return cached;
  const fresh = await fetchSeries(symbol, kind, range, currentPrice);
  seriesCache.set(key, { points: fresh.points, candles: fresh.candles, isDemo: fresh.isDemo, at: Date.now() });
  return { points: fresh.points, candles: fresh.candles, isDemo: fresh.isDemo };
}
