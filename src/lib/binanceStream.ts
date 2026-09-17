// Binance public market-data WebSocket (no API key required).
// Streams kline (candle) updates for the currently forming candle, including
// its open time (t), close time (T) and live OHLC — used to shape the active
// candle in real time and drive the "time to close" countdown.

export interface KlineTick {
  t: number; // candle open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  closeTime: number; // candle close time (ms)
}

// App symbol -> Binance spot pair. USDT/USDC are quote assets (no own stream).
const PAIRS: Record<string, string> = {
  BTC: 'btcusdt',
  ETH: 'ethusdt',
  SOL: 'solusdt',
  XRP: 'xrpusdt',
  BNB: 'bnbusdt',
  ADA: 'adausdt',
  DOGE: 'dogeusdt',
};

export function binancePair(symbol: string): string | null {
  return PAIRS[symbol] ?? null;
}

// Primary host plus Binance's public data-only mirror (used as fallback;
// the market-data vision endpoints are less aggressively geo-restricted).
const HOSTS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];

// REST equivalents for fetching historical klines (true OHLC + volume).
const REST_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];

export interface KlineCandle {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // base-asset volume
}

/**
 * Fetch true OHLCV candles from Binance REST (no API key). Tries the
 * data-only mirror as fallback. Returns null when unreachable so callers
 * can fall back to another source.
 */
export async function fetchKlines(
  pair: string,
  interval: string,
  limit: number,
): Promise<KlineCandle[] | null> {
  for (const host of REST_HOSTS) {
    try {
      const res = await fetch(
        `${host}/api/v3/klines?symbol=${pair.toUpperCase()}&interval=${interval}&limit=${limit}`,
      );
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;
      return rows.map((r) => ({
        t: (r as unknown[])[0] as number,
        o: +r[1],
        h: +r[2],
        l: +r[3],
        c: +r[4],
        v: +r[5],
      }));
    } catch {
      // try next host
    }
  }
  return null;
}

/**
 * Opens a kline stream. Retries with exponential backoff (alternating hosts)
 * and gives up silently after 8 attempts — callers then stay on REST polling.
 * Returns a stop function.
 */
export function openKlineStream(
  pair: string,
  interval: string,
  onTick: (k: KlineTick) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  let stopped = false;
  let attempt = 0;
  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRetry = () => {
    if (stopped) return;
    attempt += 1;
    if (attempt > 8) return; // stay on REST fallback
    const delay = Math.min(1000 * 2 ** (attempt - 1), 30_000);
    retryTimer = setTimeout(attemptConnect, delay);
  };

  const attemptConnect = () => {
    if (stopped) return;
    const host = HOSTS[attempt % HOSTS.length];
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${host}/ws/${pair}@kline_${interval}`);
    } catch {
      scheduleRetry();
      return;
    }
    ws = sock;
    const openGuard = setTimeout(() => {
      try { sock.close(); } catch { /* already closed */ }
    }, 10_000);

    sock.onopen = () => {
      clearTimeout(openGuard);
      attempt = 0;
      onStatus(true);
    };
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        const k = msg?.k;
        if (!k) return;
        onTick({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, closeTime: k.T });
      } catch {
        // ignore malformed frames
      }
    };
    sock.onerror = () => {
      try { sock.close(); } catch { /* close event follows */ }
    };
    sock.onclose = () => {
      clearTimeout(openGuard);
      if (stopped) return;
      onStatus(false);
      scheduleRetry();
    };
  };

  attemptConnect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch { /* noop */ }
    }
  };
}
