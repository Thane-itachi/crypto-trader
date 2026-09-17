# Crypto-Trader

A modern, responsive **paper-trading web platform** for monitoring cryptocurrency and fiat
currency markets and practicing trading with virtual funds. **PAPER TRADING / DEMO MODE only —
no real-money transactions.**

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (dark-mode-first design system, custom theme tokens)
- **Supabase** — authentication, PostgreSQL, Row Level Security, server-side trading
- **Recharts** — interactive price charts and portfolio allocation
- **CoinGecko** — live crypto market data (public API, no key required)
- **open.er-api.com** — live fiat FX rates (public API, no key required)
- **Supabase Edge Function (`refresh-prices`)** — the only writer of trade execution prices
- **Vercel** — frontend hosting (SPA rewrites in `vercel.json`)

No Firebase. No Prisma. One backend: Supabase.

## Security architecture (trading)

The browser has **no trade-price authority and no balance authority**:

1. Trade execution prices live in the `asset_prices` table, written **only** by the
   `refresh-prices` Edge Function using the service-role key. Clients can read, never write.
2. `execute_trade()` reads the price server-side from `asset_prices` and rejects trades when the
   price is missing or older than **10 minutes**. The client cannot submit or influence the price.
3. `execute_trade()` enforces a **server-side asset allowlist**: only
   BTC, ETH, SOL, XRP, BNB, ADA, DOGE, USDT, USDC may ever be traded.
4. `portfolios`, `holdings`, and `transactions` are **SELECT-only** for clients (RLS).
   Every mutation — balance, holdings, avg-price, realized P/L, transaction rows, even failed
   attempts (`status='failed'`) — happens inside the security-definer RPC. The browser has no
   write path to money data.
5. Authentication is Supabase Auth (sessions persist across refreshes and devices). Passwords
   are never stored, hashed, or handled manually by the app.
6. Only public keys reach the browser (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   The service-role key exists only as an Edge Function secret / vault entry.

## P/L accounting

- **Average entry**: weighted average across repeated buys at different prices (computed server-side).
- **Realized P/L**: on every (partial or full) sell: `proceeds − sold quantity × avg entry`, accumulated in `portfolios.realized_pl` — selling a whole position does not erase history.
- **Unrealized P/L**: open holdings: `quantity × (current price − avg entry)`.
- **Total P/L** = realized + unrealized; **return %** = total P/L ÷ (current cost basis + realized cost basis).
- **24h P/L**: exact relative to the reported 24h change (`value − value/(1+chg/100)`), based on live market quotes.

## Demo-data policy

Display market data comes live from the configured APIs. If an API is unavailable, the app
switches to a clearly labeled **DEMO MARKET DATA** fallback (status pill, per-row badges, chart
labels) and never presents fallback data as live. Fiat historical charts are demo-labeled because
the FX provider serves latest rates only — they are never described as real FX history.

## Setup

### 1. Supabase (database + auth)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run the entire [`supabase/schema.sql`](supabase/schema.sql).
   This creates all tables, RLS policies (money tables are read-only for clients), the new-user
   trigger ($10,000 DEMO FUNDS + profile), and the hardened `execute_trade` function.
3. Copy **Settings → API → Project URL** and **anon public key**.

### 2. Price feed (required for trading)

`execute_trade` only executes at fresh server-side prices, so deploy the feed:

1. Install the Supabase CLI, then from the project root:
   ```bash
   supabase functions deploy refresh-prices --no-verify-jwt
   ```
2. Schedule it every 2 minutes: follow [`supabase/cron.sql`](supabase/cron.sql)
   (stores the service-role key in the vault, then pg_cron + pg_net calls the function).
3. Verify: `asset_prices` should contain 17 rows with recent `updated_at`.

Without the feed, the app still shows live market prices and charts, but trading is disabled
with a clear "server price feed not running or stale" message.

### 3. Environment

```bash
cp .env.example .env
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run / build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite production build
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Vercel → **Add New → Project → Import** the repo.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. SPA rewrites for direct navigation to `/app/*` routes come from `vercel.json`.

## Architecture

```
Display data:   CoinGecko / FX API → src/lib/market.ts (live + labeled demo fallback) → MarketContext → UI
Execution data:  Edge Function refresh-prices → asset_prices (service-role writes) → execute_trade RPC
User data:       Supabase Auth → profiles / portfolios / holdings / transactions / watchlist_items / notifications
Notifications:  persisted per user in the notifications table (loaded on login, read state synced)
```

## Notifications

Persistent: stored in the `notifications` table per user, loaded on login, and read/clear state
is synced to the database. Toasts provide instant in-session feedback.

## Known limitations

- Market orders execute at the server price captured by the 2-minute feed (no limit/stop orders yet).
- Fiat historical charts use the labeled demo fallback (FX provider serves latest rates only).
- Portfolio valuation on dashboards uses live client-side quotes for display; execution always
  uses the server-side price, so display and execution prices can differ slightly.
- 24h P/L is exact relative to the API-reported 24h change (not tick-level).
- Paper trading only. Not financial advice.
