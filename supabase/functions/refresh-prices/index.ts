// Supabase Edge Function: refresh-prices
// Fetches live crypto (CoinGecko) + fiat FX (open.er-api.com) prices and writes
// them to `asset_prices` with the SERVICE ROLE key. This is the ONLY writer of
// trade execution prices — the browser never supplies an execution price.
//
// Deploy:
//   supabase functions deploy refresh-prices --no-verify-jwt
//   supabase secrets set COINGECKO_IDS=bitcoin,ethereum,... (optional override)
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.)
//
// Schedule: see supabase/cron.sql (pg_cron + pg_net, every 2 minutes).

const CRYPTOS: { id: string; symbol: string }[] = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'cardano', symbol: 'ADA' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'tether', symbol: 'USDT' },
  { id: 'usd-coin', symbol: 'USDC' },
];

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const auth = {
      'Authorization': `Bearer ${serviceRole}`,
      'apikey': serviceRole,
      'Content-Type': 'application/json',
    };

    const rows: { symbol: string; price: number; change24h: number | null; source: string; updated_at: string }[] = [];

    // --- Crypto: CoinGecko ---
    try {
      const ids = CRYPTOS.map((c) => c.id).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=24h`,
      );
      if (res.ok) {
        const data = await res.json();
        const byId = new Map<string, { current_price: number; price_change_percentage_24h: number | null }>(
          data.map((d: any) => [d.id, d]),
        );
        for (const c of CRYPTOS) {
          const d = byId.get(c.id);
          if (d && typeof d.current_price === 'number' && d.current_price > 0) {
            rows.push({
              symbol: c.symbol,
              price: d.current_price,
              change24h: d.price_change_percentage_24h ?? null,
              source: 'coingecko',
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (_e) {
      // crypto fetch failed — keep whatever rows we have
    }

    // --- Fiat: open.er-api.com (USD per 1 unit = 1 / rate) ---
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        const rates = data?.rates as Record<string, number> | undefined;
        if (rates) {
          for (const code of ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'CAD', 'AUD', 'CHF']) {
            const rate = rates[code];
            if (typeof rate === 'number' && rate > 0) {
              rows.push({
                symbol: code,
                price: code === 'USD' ? 1 : 1 / rate,
                change24h: code === 'USD' ? 0 : null,
                source: 'er-api',
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (_e) {
      // fx fetch failed
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: 'No prices fetched' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert all rows (service role bypasses RLS — this is the only writer)
    const { error } = await fetch(`${supabaseUrl}/rest/v1/asset_prices`, {
      method: 'POST',
      headers: { ...auth, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    }).then(async (r) => (r.ok ? { error: null } : { error: await r.text() }));

    if (error) {
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
