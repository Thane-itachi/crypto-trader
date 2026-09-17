# Crypto-Trader

A modern, responsive **paper-trading web platform** for monitoring cryptocurrency and fiat
currency markets and practicing trading with virtual funds. **PAPER TRADING / DEMO MODE only —
no real-money transactions.**

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (dark-mode-first design system, custom theme tokens)
- **Firebase** — Authentication, Cloud Firestore, security rules
- **Recharts** — interactive price charts and portfolio allocation
- **CoinGecko** — live crypto market data (public API, no key required)
- **open.er-api.com** — live fiat FX rates (public API, no key required)
- **Vercel** — hosting, SPA rewrites, and the serverless trade engine (`/api/trade`)

One backend: Firebase. (Previously Supabase — migrated by owner decision; see git history.)

## Security architecture (trading)

The browser has **no trade-price authority and no balance authority**:

1. **`/api/trade`** (Vercel serverless function) is the only trading engine. It verifies the
   caller's Firebase ID token, enforces the **server-side asset allowlist**
   (BTC, ETH, SOL, XRP, BNB, ADA, DOGE, USDT, USDC only), fetches the execution price **live from
   CoinGecko server-side** (≤10-min Firestore cache fallback), and executes everything in ONE
   atomic Firestore transaction — balance checks, holdings, cash, realized P/L, transaction
   records, and failed attempts (`status='failed'`). Concurrent requests cannot double-spend.
2. The client supplies **no price whatsoever** — it only sends side, symbol, and amount.
3. `firestore.rules` makes `portfolio`, `holdings`, and `transactions` **read-only for clients**.
   The single allowed client write is the initial $10,000 DEMO FUNDS seed, and the rule pins the
   exact seed values (cash == 10000, realized P/L == 0); update/delete of the portfolio is
   never allowed from the client.
4. Authentication is Firebase Auth with persistent sessions. Passwords are handled entirely by
   Firebase (the app never stores or hashes them).
5. Only the public Firebase web config reaches the browser (`VITE_FIREBASE_*`). The
   service-account key (`FIREBASE_SERVICE_ACCOUNT`) is a server-only Vercel environment
   variable and is never exposed to the client bundle.

## P/L accounting

- **Average entry**: weighted average across repeated buys at different prices (computed in the
  server-side transaction).
- **Realized P/L**: on every (partial or full) sell: `proceeds − sold quantity × avg entry`,
  accumulated in the portfolio doc — selling a whole position does not erase history.
- **Unrealized P/L**: open holdings: `quantity × (current price − avg entry)`.
- **Total P/L** = realized + unrealized; **return %** = total P/L ÷ (current cost basis + realized cost basis).
- **24h P/L**: exact relative to the API-reported 24h change (`value − value/(1+chg/100)`).

## Demo-data policy

Display market data comes live from the configured APIs. If an API is unavailable, the app
switches to a clearly labeled **DEMO MARKET DATA** fallback (status pill, per-row badges, chart
labels) and never presents fallback data as live. Fiat historical charts are demo-labeled because
the FX provider serves latest rates only. LiveActivity shows **real price ticks** between polls
(labeled LIVE/DEMO PRICE TICK) and your own trades (labeled YOUR TRADE — SIMULATED).

## Setup

### 1. Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → enable Email/Password.**
3. **Firestore Database → Create database** (production mode).
4. Publish the rules: paste [`firestore.rules`](firestore.rules) in **Firestore → Rules**,
   or `firebase deploy --only firestore:rules` with the Firebase CLI.
5. **Project settings → General → Your apps → Web app** — copy the config values
   (`apiKey`, `authDomain`, `projectId`, `appId`).

### 2. Service account for the trade engine

1. **Project settings → Service accounts → Generate new private key** — downloads a JSON file.
2. Minify it to a single line (e.g. `jq -c . key.json`).
3. In Vercel → Project → **Settings → Environment Variables** add:
   `FIREBASE_SERVICE_ACCOUNT = <the single-line JSON>`
   (Server-side only. Do NOT prefix with `VITE_`.)

### 3. Environment

```bash
cp .env.example .env
# Fill the VITE_FIREBASE_* values from your web app config
```

### 4. Run / build

```bash
npm install
npm run dev      # UI at http://localhost:5173 (trading needs the /api/trade function)
vercel dev      # OPTIONAL: full stack locally, including the trade engine
npm run build   # tsc + vite production build
```

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework: Vite, detected automatically).
2. Add environment variables:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT` (server-only)
3. Deploy. SPA rewrites (excluding `/api/*`) are configured in `vercel.json`.

## Architecture

```
Display data:  CoinGecko / FX API → src/lib/market.ts (live + labeled demo fallback,
               escalating backoff, single-flight, series caches) → MarketContext → UI
Execution:     /api/trade (Vercel function, Firebase Admin SDK) → server-fetched price →
               atomic Firestore transaction → portfolio/holdings/transactions
User data:     Firebase Auth → Firestore users/{uid}/{profile,portfolio,holdings,transactions,
               watchlist,notifications} — money data read-only to clients via firestore.rules
Notifications: persisted per user in Firestore, real-time listener, read state synced
```

## Notifications

Persistent: stored per user in `users/{uid}/notifications`, loaded via a real-time listener on
login, and read/clear state is synced to the database. Toasts provide instant in-session feedback.

## Known limitations

- Market orders execute at the server-side price fetched at execution time (no limit/stop orders).
- Firestore listeners are realtime, but the free tier has quotas — monitor usage if many users.
- Fiat historical charts use the labeled demo fallback (FX provider serves latest rates only).
- 24h P/L is exact relative to the API-reported 24h change (not tick-level).
- Paper trading only. Not financial advice.
