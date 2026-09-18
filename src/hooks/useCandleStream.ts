import { useEffect, useRef, useState } from 'react';
import { binancePair, fetchKlines, openKlineStream, type KlineTick } from '../lib/binanceStream';

/**
 * Subscribes to the Binance kline stream for the given symbol + interval.
 * Pass null symbol/interval to disconnect.
 *
 * Tiered live updates, strongest first:
 *   1. WebSocket kline stream (tick-by-tick)
 *   2. Binance REST klines polling every `pollMs` (default 10s) while the
 *      WS is disconnected — same true OHLC data, coarser cadence
 *   3. `getPrice()` market refresh (fed by /api/quotes) if BOTH Binance
 *      transports are unreachable or rate-limited — keeps the active
 *      candle's close moving with real prices instead of freezing
 *
 * Returns the current source so the UI can label it truthfully:
 *   connected   — WS stream is live
 *   fallback    — 'rest' (Binance REST polling) or 'price' (market refresh)
 */
export type StreamSource = 'stream' | 'rest' | 'price' | 'off';

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

export function useCandleStream(
  symbol: string | null,
  interval: string | null,
  onTick: (k: KlineTick) => void,
  opts?: { pollMs?: number; getPrice?: () => number | null },
): { source: StreamSource; connected: boolean } {
  const [source, setSource] = useState<StreamSource>('off');
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const pair = symbol ? binancePair(symbol) : null;

  useEffect(() => {
    if (!pair || !interval) {
      setSource('off');
      return;
    }
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    // ---- Tier 2/3: REST polling fallback while the WS is down ----
    const pollOnce = async () => {
      if (stopped) return;
      const klines = await fetchKlines(pair, interval, 2);
      if (stopped) return;
      if (klines && klines.length > 0) {
        const k = klines[klines.length - 1];
        tickRef.current({ t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, closeTime: k.closeTime });
        setSource((prev) => (prev === 'stream' ? prev : 'rest'));
      } else {
        // Binance REST unreachable/rate-limited too → market-refresh price
        const price = optsRef.current?.getPrice?.();
        if (typeof price === 'number' && price > 0) {
          const stepMs = INTERVAL_MS[interval] ?? 300_000;
          const t = Math.floor(Date.now() / stepMs) * stepMs;
          tickRef.current({ t, o: price, h: price, l: price, c: price, closeTime: t + stepMs - 1 });
          setSource((prev) => (prev === 'stream' ? prev : 'price'));
        } else {
          setSource((prev) => (prev === 'stream' ? prev : 'off'));
        }
      }
    };

    const startPolling = () => {
      if (stopped || pollTimer) return;
      pollOnce(); // no gap right after a drop
      pollTimer = setInterval(pollOnce, optsRef.current?.pollMs ?? 10_000);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    // ---- Tier 1: WebSocket stream, self-healing retries ----
    const stop = openKlineStream(
      pair,
      interval,
      (k) => {
        tickRef.current(k);
        setSource('stream');
      },
      (connected) => {
        if (stopped) return;
        if (connected) {
          stopPolling();
          setSource('stream');
        } else {
          setSource((prev) => (prev === 'stream' ? 'rest' : prev)); // pollOnce refines below
          startPolling();
        }
      },
    );

    return () => {
      stopped = true;
      stopPolling();
      stop();
      setSource('off');
    };
  }, [pair, interval]);

  return { source, connected: source === 'stream' };
}
