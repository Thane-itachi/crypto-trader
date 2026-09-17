# Crypto-Trader

A modern, responsive **paper-trading web platform** for monitoring cryptocurrency and fiat
currency markets and practicing trading with virtual funds. **PAPER TRADING / DEMO MODE only —
no real-money transactions.**

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (dark-mode-first design system, custom theme tokens)
- **Supabase** — authentication, PostgreSQL database, Row Level Security, server-side validated trading (RPC)
- **Recharts** — interactive price charts and portfolio allocation
- **CoinGecko** — live crypto market data (public API, no key required)
- **open.er-api.com** — live fiat FX rates (public API, no key required)
- **Vercel** — frontend hosting (SPA rewrites configured in `vercel.json`)

No Prisma. No heavyweight dependencies.

## Features

- Email/password authentication with persistent sessions (Supabase Auth)
- **$10,000 virtual USD (DEMO FUNDS)** granted on signup
- Server-side validated paper-trading engine (atomic BUY/SELL with balance checks, holdings, avg entry price, realized + unrealized P/L)
- Live market dashboard: 9 crypto assets + 8 fiat currencies, 30s polling, LIVE/DEMO status
- Interactive charts (1H/1D/1W/1M/3M/1Y) with clearly labeled demo fallback
- Global search (⌘K), asset detail pages, market movers
- Portfolio with allocation chart, watchlist, transaction history with filters
- Currency converter, live market activity feed, notifications + toast center
- Dark/light theme, fully responsive (mobile bottom nav + drawer)

## Demo-data policy

Market data comes live from the configured APIs. If an API is unavailable, the app switches to a
clearly labeled **DEMO MARKET DATA** fallback (per-asset badges, status pill, chart labels) and
never presents fallback data as live.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
   This creates tables, RLS policies, the new-user trigger ($10,000 demo funds + profile), and the
   `execute_trade` server-side trading function.
3. Copy **Settings → API → Project URL** and **anon public key**.

### 2. Environment

```bash
cp .env.example .env
# then fill in:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is a public key by design — all data access is protected by Row Level Security.
Never put the **service-role** key in frontend code.

### 3. Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (tsc + vite)
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy (framework auto-detected: Vite; SPA rewrites come from `vercel.json`).

## Architecture

```
Market APIs (CoinGecko / FX)
        ↓
src/lib/market.ts  (service + demo fallback, caching, rate-conscious polling)
        ↓
src/context/MarketContext.tsx
        ↓
Application (pages/components)

User trading data:
Supabase Auth → profiles / portfolios / holdings / transactions / watchlist_items
        ↓
execute_trade RPC (server-side validation, atomic) → PortfolioContext → UI
```

- `src/context/` — Auth, Market, Portfolio, Notifications providers
- `src/lib/market.ts` — market-data layer (live + demo fallback, isolated from user data)
- `src/components/charts/` — PriceChart, AllocationPie
- `src/pages/` — route-level code-split pages
- `supabase/schema.sql` — full database schema, RLS, trading function

## Security notes

- Passwords handled exclusively by Supabase Auth (never stored or hashed manually).
- Row Level Security on every user-owned table: users can only read/write their own rows.
- Trade validation runs server-side in the `execute_trade` Postgres function; the client-side
  checks are only for UX.
- Only public keys/env vars reach the browser.

## Known limitations

- Order execution uses the current market price at submit time (true market order simulation;
  limit/stop orders are a planned next step).
- Fiat historical charts use the demo fallback (the FX API serves latest rates only); they are
  labeled as demo chart data.
- Notifications are session-based; the `notifications` table exists in the schema for future
  persistence.
- Paper trading only. Not financial advice.
