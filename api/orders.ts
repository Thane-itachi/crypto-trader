// Vercel Serverless Function: /api/orders
// Take-Profit / Stop-Loss order engine. All order writes and triggered sells
// happen HERE, server-side, with the Firebase Admin SDK — a client can never
// create, modify, or execute an order by talking to Firestore directly
// (enforced by firestore.rules: users/{uid}/orders is owner READ-only).
//
// Actions (POST, Bearer ID token required):
//   create  { symbol, kind: 'tp' | 'sl', trigger_price, quantity }
//   cancel  { id }
//   settle  { }  — checks the caller's active orders against LIVE prices and
//                 executes triggered sells atomically. The client polls this
//                 periodically while the app is open; execution remains fully
//                 server-authoritative (client can only ask "settle my orders").
//
// One TP and one SL per symbol: creating replaces any existing active order
// of the same symbol+kind.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const ALLOWED: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
  BNB: 'binancecoin', ADA: 'cardano', DOGE: 'dogecoin', USDT: 'tether', USDC: 'usd-coin',
};
const PRICE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function authenticate(req: VercelRequest): Promise<string | null> {
  const token = (req.headers.authorization ?? '').startsWith('Bearer ') ? req.headers.authorization!.slice(7) : '';
  try {
    return (await getAuth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

async function fetchServerPrices(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const ids = symbols.map((s) => ALLOWED[s]).filter(Boolean).join(',');
  if (ids) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false`);
      if (res.ok) {
        for (const row of (await res.json()) as { symbol?: string; current_price?: number }[]) {
          const sym = (row.symbol ?? '').toUpperCase();
          if (typeof row.current_price === 'number' && row.current_price > 0 && sym in ALLOWED) out[sym] = row.current_price;
        }
        const db = getFirestore();
        for (const [sym, price] of Object.entries(out)) {
          db.doc(`asset_prices/${sym}`).set({ price, updated_at: FieldValue.serverTimestamp() }).catch(() => {});
        }
      }
    } catch { /* fall through to cache */ }
  }
  for (const sym of symbols) {
    if (out[sym]) continue;
    const data = (await getFirestore().doc(`asset_prices/${sym}`).get()).data();
    const updatedAt = data?.updated_at as Timestamp | undefined;
    if (data && typeof data.price === 'number' && data.price > 0 && updatedAt && Date.now() - updatedAt.toMillis() <= PRICE_CACHE_MAX_AGE_MS) out[sym] = data.price;
  }
  return out;
}

/** Atomic sell with identical money math to /api/trade's sell branch. */
async function sellHoldings(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  symbol: string,
  qty: number,
  price: number,
  reason?: string,
): Promise<{ ok: boolean; status?: number; message: string; txn?: { symbol: string; side: 'sell'; quantity: number; price: number; total: number; status: 'completed'; reason?: string } }> {
  return db.runTransaction(async (tx) => {
    const portfolioRef = db.doc(`users/${uid}/portfolio/main`);
    const holdingRef = db.doc(`users/${uid}/holdings/${symbol}`);
    const [portfolioSnap, holdingSnap] = await Promise.all([tx.get(portfolioRef), tx.get(holdingRef)]);
    if (!portfolioSnap.data()) return { ok: false, status: 409, message: 'Portfolio not found' };
    const heldQty = Number(holdingSnap.data()?.quantity) || 0;
    const avgPrice = Number(holdingSnap.data()?.avg_price) || 0;
    const sellQty = Math.min(heldQty, qty);
    if (sellQty <= 0) return { ok: false, status: 400, message: `No ${symbol} held` };
    const total = Math.round(sellQty * price * 100) / 100;
    if (heldQty - sellQty <= 0) tx.delete(holdingRef);
    else tx.update(holdingRef, { quantity: FieldValue.increment(-sellQty) });
    tx.update(portfolioRef, {
      cash: FieldValue.increment(total),
      realized_pl: FieldValue.increment(total - sellQty * avgPrice),
      realized_cost: FieldValue.increment(sellQty * avgPrice),
    });
    return { ok: true, message: `Sold ${sellQty} ${symbol} at $${price}`, txn: { symbol, side: 'sell', quantity: sellQty, price, total, status: 'completed', reason } };
  });
}

const MAX_ACTIVE_ORDERS = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }
  try {
    const db = getDb();
    const uid = await authenticate(req);
    if (!uid) {
      res.status(401).json({ ok: false, message: 'Not authenticated' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action;

    // ---------- create ----------
    if (action === 'create') {
      const symbol = typeof body.symbol === 'string' ? body.symbol.toUpperCase() : '';
      const kind = body.kind;
      const triggerPrice = Number(body.trigger_price);
      const quantity = Number(body.quantity);

      if (!(symbol in ALLOWED)) {
        res.status(400).json({ ok: false, message: 'Unsupported asset symbol' });
        return;
      }
      if (kind !== 'tp' && kind !== 'sl') {
        res.status(400).json({ ok: false, message: 'Invalid order kind' });
        return;
      }
      if (!Number.isFinite(triggerPrice) || triggerPrice <= 0 || `${triggerPrice}`.includes('e')) {
        res.status(400).json({ ok: false, message: 'Enter a valid trigger price' });
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0 || `${quantity}`.includes('e')) {
        res.status(400).json({ ok: false, message: 'Enter a valid quantity' });
        return;
      }

      // Quantity must be backed by an actual holding — orders can never sell
      // more than is owned at creation time.
      const holdingSnap = await db.doc(`users/${uid}/holdings/${symbol}`).get();
      const heldQty = Number(holdingSnap.data()?.quantity) || 0;
      if (quantity > heldQty) {
        res.status(400).json({ ok: false, message: `Quantity exceeds your ${symbol} holdings` });
        return;
      }

      const activeSnap = await db
        .collection(`users/${uid}/orders`)
        .where('status', '==', 'active')
        .where('symbol', '==', symbol)
        .where('kind', '==', kind)
        .get();
      if (activeSnap.size + 1 > MAX_ACTIVE_ORDERS) {
        res.status(400).json({ ok: false, message: 'Too many active orders' });
        return;
      }

      const batch = db.batch();
      const ref = db.collection(`users/${uid}/orders`).doc();
      // replace any existing active order of the same symbol+kind
      activeSnap.docs.forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at: FieldValue.serverTimestamp() }));
      batch.set(ref, {
        symbol,
        kind,
        trigger_price: triggerPrice,
        quantity,
        status: 'active',
        created_at: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      res.status(200).json({
        ok: true,
        message: `${kind === 'tp' ? 'Take-profit' : 'Stop-loss'} set: sell ${quantity} ${symbol} at $${triggerPrice}`,
        order: { id: ref.id, symbol, kind, trigger_price: triggerPrice, quantity },
      });
      return;
    }

    // ---------- cancel ----------
    if (action === 'cancel') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) {
        res.status(400).json({ ok: false, message: 'Missing order id' });
        return;
      }
      const ref = db.doc(`users/${uid}/orders/${id}`); // scoped to caller — cannot touch other users' orders
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, message: 'Order not found' });
        return;
      }
      if (snap.data()?.status !== 'active') {
        res.status(409).json({ ok: false, message: 'Order is no longer active' });
        return;
      }
      await ref.update({ status: 'cancelled', cancelled_at: FieldValue.serverTimestamp() });
      res.status(200).json({ ok: true, message: 'Order cancelled' });
      return;
    }

    // ---------- settle ----------
    if (action === 'settle') {
      const snap = await db
        .collection(`users/${uid}/orders`)
        .where('status', '==', 'active')
        .limit(MAX_ACTIVE_ORDERS)
        .get();
      type ActiveOrder = { id: string; symbol: string; kind: 'tp' | 'sl'; trigger_price: number; quantity: number };
      const active: ActiveOrder[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          symbol: String(data.symbol ?? ''),
          kind: (data.kind as 'tp' | 'sl') ?? 'tp',
          trigger_price: Number(data.trigger_price ?? 0),
          quantity: Number(data.quantity ?? 0),
        };
      });
      if (active.length === 0) {
        res.status(200).json({ ok: true, executed: [] });
        return;
      }

      const symbols = Array.from(new Set(active.map((o) => o.symbol as string)));
      const prices = await fetchServerPrices(symbols);

      const executed: {
        id: string;
        symbol: string;
        kind: 'tp' | 'sl';
        quantity: number;
        price: number;
        total: number;
      }[] = [];

      for (const order of active) {
        const price = prices[order.symbol];
        if (typeof price !== 'number' || price <= 0) continue;
        const trigger = Number(order.trigger_price);
        const kind = order.kind as 'tp' | 'sl';
        const triggered = kind === 'tp' ? price >= trigger : price <= trigger;
        if (!triggered) continue;

        const result = await sellHoldings(db, uid, order.symbol, order.quantity, price, kind === 'tp' ? 'take_profit' : 'stop_loss');
        if (!result.ok) {
          // Position was fully sold manually before the trigger — close the order.
          await db.doc(`users/${uid}/orders/${order.id}`).update({
            status: 'cancelled',
            cancelled_at: FieldValue.serverTimestamp(),
            note: 'position closed before trigger',
          });
          continue;
        }
        // record + mark executed
        await db.collection(`users/${uid}/transactions`).add({ ...result.txn, created_at: FieldValue.serverTimestamp() });
        await db.doc(`users/${uid}/orders/${order.id}`).update({
          status: 'executed',
          executed_at: FieldValue.serverTimestamp(),
          executed_price: price,
          executed_total: result.txn?.total ?? 0,
        });
        executed.push({
          id: order.id,
          symbol: order.symbol,
          kind,
          quantity: result.txn?.quantity ?? 0,
          price,
          total: result.txn?.total ?? 0,
        });
      }

      res.status(200).json({ ok: true, executed });
      return;
    }

    res.status(400).json({ ok: false, message: 'Unknown action' });
  } catch {
    res.status(500).json({ ok: false, message: 'Order engine error — please try again.' });
  }
}
