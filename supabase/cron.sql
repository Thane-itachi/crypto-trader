-- ============================================================
-- Optional (but recommended): schedule the refresh-prices Edge Function
-- every 2 minutes so the server-side price feed stays fresh
-- (execute_trade rejects prices older than 10 minutes).
--
-- PREREQUISITES:
--   1. Deploy the Edge Function:
--        supabase functions deploy refresh-prices --no-verify-jwt
--   2. Store your service role key in the vault:
--        select vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'service_role_key');
--   3. Replace <PROJECT_REF> below with your project ref (from Settings → API).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

select cron.schedule(
  'refresh-prices',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/refresh-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
