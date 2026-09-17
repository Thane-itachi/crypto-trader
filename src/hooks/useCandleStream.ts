import { useEffect, useRef, useState } from 'react';
import { binancePair, openKlineStream, type KlineTick } from '../lib/binanceStream';

/**
 * Subscribes to the Binance kline stream for the given symbol + interval.
 * Pass null symbol/interval to disconnect. Returns whether the stream is live;
 * when it is not, callers keep their REST/polling data untouched.
 */
export function useCandleStream(
  symbol: string | null,
  interval: string | null,
  onTick: (k: KlineTick) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const pair = symbol ? binancePair(symbol) : null;

  useEffect(() => {
    if (!pair || !interval) {
      setConnected(false);
      return;
    }
    const stop = openKlineStream(pair, interval, (k) => tickRef.current(k), setConnected);
    return () => {
      stop();
      setConnected(false);
    };
  }, [pair, interval]);

  return connected && !!pair && !!interval;
}
