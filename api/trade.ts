// Vercel Serverless Function: /api/trade
// THE trading engine. All trade validation and balance math happens HERE,
// server-side, with the Firebase Admin SDK — the browser has no write path
// to portfolio/holdings/transactions (enforced by firestore.rules).
//
// Security model:
//   * Caller must present a valid Firebase ID token (verified via Admin SDK).
//   * Symbol allowlist enforced here: BTC/ETH/SOL/XRP/BNB/ADA/DOGE/USDT/USDC.
//   * The execution price is fetched LIVE from CoinGecko server-side at trade
//     time (with a ≤10-min Firestore cache fallback). The client supplies NO
//     price whatsoever.
//   * Balance/quantity checks + all writes happen atomically in one Firestore
//     transaction (with retry), so concurrent trades cannot double-spend.
//   * Failed attempts are recorded with status='failed'.
//
// Required server env var (Vercel → Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT — the full JSON service-account key, single line.
// Never prefix this with VITE_.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const ALLOWED: Record<string, string> = {
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

const PRICE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

interface TradeRequest {
  side: 'buy' | 'sell';
  symbol: string;
  amount: number; // buy: USD to spend; sell: quantity to sell
}

interface TradeOutcome {
  ok: boolean;
  status?: number;
  message: string;
  txn?: { symbol: string; side: 'buy' | 'sell'; quantity: number; price: number; total: number; status: 'completed' };
}

async function fetchServerPrice(symbol: string): Promise<number> {
  const cgId = ALLOWED[symbol];
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cgId}&sparkline=false&price_change_percentage=24h`,
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.[0]?.current_price;
      if (typeof price === 'number' && price > 0) {
        // refresh the cache for future fallbacks
        getFirestore()
          .doc(`asset_prices/${symbol}`)
          .set({ price, updated_at: FieldValue.serverTimestamp() })
          .catch(() => {});
        return price;
      }
    }
  } catch {
    // fall through to cache
  }
  // Fallback: last cached price, must be fresh
  const snap = await getFirestore().doc(`asset_prices/${symbol}`).get();
  const data = snap.data();
  const updatedAt = data?.updated_at as Timestamp | undefined;
  if (data && typeof data.price === 'number' && data.price > 0 && updatedAt) {
    const age = Date.now() - updatedAt.toMillis();
    if (age <= PRICE_CACHE_MAX_AGE_MS) return data.price;
  }
  throw new Error('PRICE_UNAVAILABLE');
}

async function recordFailed(db: ReturnType<typeof getFirestore>, uid: string, req: TradeRequest, price: number): Promise<void> {
  const total = req.side === 'buy' ? req.amount : Math.round(req.amount * price * 100) / 100;
  const qty = req.side === 'buy' ? (price > 0 ? Math.round((req.amount / price) * 1e8) / 1e8 : 0) : req.amount;
  await db.collection(`users/${uid}/transactions`).add({
    symbol: req.symbol,
    side: req.side,
    quantity: qty,
    price,
    total,
    status: 'failed',
    created_at: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }
  try {
    const db = getDb();

    // --- authenticate: Firebase ID token, verified server-side ---
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ ok: false, message: 'Not authenticated' });
      return;
    }

    // --- request shape + ASSET ALLOWLIST ---
    const body = (req.body ?? {}) as Partial<TradeRequest>;
    const side = body.side;
    const symbol = typeof body.symbol === 'string' ? body.symbol.toUpperCase() : '';
    const amount = Number(body.amount);
    if (side !== 'buy' && side !== 'sell') {
      res.status(400).json({ ok: false, message: 'Invalid order side' });
      return;
    }
    if (!(symbol in ALLOWED)) {
      res.status(400).json({ ok: false, message: 'Unsupported asset symbol' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || `${amount}`.includes('e')) {
      await recordFailed(db, uid, { side, symbol, amount }, 0);
      res.status(400).json({ ok: false, message: 'Enter a valid amount' });
      return;
    }

    // --- SERVER-AUTHORITATIVE PRICE: fetched live server-side ---
    let price: number;
    try {
      price = await fetchServerPrice(symbol);
    } catch {
      res.status(503).json({ ok: false, message: 'Market price unavailable right now. Please try again shortly.' });
      return;
    }

    const reqData: TradeRequest = { side, symbol, amount };

    // --- ATOMIC EXECUTION: single Firestore transaction with retry ---
    const result: TradeOutcome = await getFirestore().runTransaction(async (tx) => {
      const portfolioRef = db.doc(`users/${uid}/portfolio/main`);
      const holdingRef = db.doc(`users/${uid}/holdings/${symbol}`);

      const [portfolioSnap, holdingSnap] = await Promise.all([tx.get(portfolioRef), tx.get(holdingRef)]);
      const portfolio = portfolioSnap.data();

      if (!portfolio) {
        return { ok: false, status: 409, message: 'Portfolio not found — please sign out and back in.' };
      }
      const cash = Number(portfolio.cash) || 0;
      const heldQty = Number(holdingSnap.data()?.quantity) || 0;
      const avgPrice = Number(holdingSnap.data()?.avg_price) || 0;

      if (side === 'buy') {
        // amount = USD to spend
        if (amount > cash) {
          return { ok: false, status: 400, message: 'Insufficient demo balance' };
        }
        const qty = Math.round((amount / price) * 1e8) / 1e8;
        if (qty <= 0) {
          return { ok: false, status: 400, message: 'Amount too small for this price' };
        }
        // weighted-average cost basis across repeated buys at different prices
        const newQty = heldQty + qty;
        const newAvg = (heldQty * avgPrice + qty * price) / newQty;

        tx.set(holdingRef, { symbol, quantity: newQty, avg_price: newAvg }, { merge: true });
        tx.update(portfolioRef, { cash: FieldValue.increment(-amount) });
        return {
          ok: true,
          message: `Bought ${qty} ${symbol} at $${price} (paper trade)`,
          txn: { symbol, side, quantity: qty, price, total: amount, status: 'completed' },
        };
      }

      // sell: amount = quantity to sell
      if (heldQty < amount) {
        return { ok: false, status: 400, message: `Insufficient ${symbol} balance` };
      }
      const total = Math.round(amount * price * 100) / 100;

      // realized P/L survives partial AND full position closes
      if (heldQty - amount <= 0) {
        tx.delete(holdingRef);
      } else {
        tx.update(holdingRef, { quantity: FieldValue.increment(-amount) });
      }
      tx.update(portfolioRef, {
        cash: FieldValue.increment(total),
        realized_pl: FieldValue.increment(total - amount * avgPrice),
        realized_cost: FieldValue.increment(amount * avgPrice),
      });

      return {
        ok: true,
        message: `Sold ${amount} ${symbol} at $${price} (paper trade)`,
        txn: { symbol, side, quantity: amount, price, total, status: 'completed' },
      };
    });

    if (!result.ok) {
      await recordFailed(db, uid, reqData, price);
      res.status(result.status ?? 400).json({ ok: false, message: result.message });
      return;
    }

    // completed transaction record (Admin SDK bypasses rules by design)
    await db.collection(`users/${uid}/transactions`).add({
      ...result.txn,
      created_at: FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true, message: result.message });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Trade engine error — please try again.' });
  }
}
