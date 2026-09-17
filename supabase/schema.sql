-- ============================================================
-- Crypto-Trader — Supabase schema
-- Run this file once in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  theme text not null default 'dark',
  notif_trades boolean not null default true,
  notif_market boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cash numeric(18, 8) not null default 10000,  -- DEMO FUNDS: $10,000 virtual USD
  realized_pl numeric(18, 8) not null default 0,
  realized_cost numeric(18, 8) not null default 0
);

create table if not exists public.holdings (
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  quantity numeric(18, 8) not null default 0,
  avg_price numeric(18, 8) not null default 0,
  primary key (user_id, symbol)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric(18, 8) not null,
  price numeric(18, 8) not null,
  total numeric(18, 8) not null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotent upgrades for databases created with an earlier version of this schema
alter table public.portfolios add column if not exists realized_pl numeric(18, 8) not null default 0;
alter table public.portfolios add column if not exists realized_cost numeric(18, 8) not null default 0;

-- ---------- Row Level Security: users can only touch their own data ----------

alter table public.profiles        enable row level security;
alter table public.portfolios      enable row level security;
alter table public.holdings        enable row level security;
alter table public.transactions    enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.notifications   enable row level security;

create policy "own profile"       on public.profiles        for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own portfolio"     on public.portfolios      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own holdings"      on public.holdings        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions"  on public.transactions    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own watchlist"     on public.watchlist_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- New-user bootstrap: profile + $10,000 DEMO FUNDS ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  insert into public.portfolios (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Paper-trading engine: server-side validated, atomic ----------

create or replace function public.execute_trade(
  p_side   text,
  p_symbol text,
  p_amount numeric,
  p_price  numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_cash  numeric;
  v_hold  numeric;
  v_avg   numeric;
  v_qty   numeric(18, 8);
  v_total numeric(18, 8);
begin
  if v_user is null then
    return json_build_object('ok', false, 'message', 'Not authenticated');
  end if;
  if p_side is null or p_side not in ('buy', 'sell') then
    return json_build_object('ok', false, 'message', 'Invalid order side');
  end if;
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,10}$' then
    return json_build_object('ok', false, 'message', 'Invalid asset symbol');
  end if;
  if p_price is null or p_price <= 0 then
    return json_build_object('ok', false, 'message', 'Market price unavailable');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text !~ '^[0-9]+(\.[0-9]+)?$' then
    return json_build_object('ok', false, 'message', 'Enter a valid amount');
  end if;

  select cash into v_cash from public.portfolios where user_id = v_user for update;
  if v_cash is null then
    insert into public.portfolios (user_id) values (v_user) returning cash into v_cash;
  end if;

  if p_side = 'buy' then
    -- p_amount = USD to spend
    if p_amount > v_cash then
      return json_build_object('ok', false, 'message', 'Insufficient demo balance');
    end if;
    v_qty := round(p_amount / p_price, 8);
    if v_qty <= 0 then
      return json_build_object('ok', false, 'message', 'Amount too small for this price');
    end if;

    select coalesce(quantity, 0), coalesce(avg_price, 0) into v_hold, v_avg
      from public.holdings where user_id = v_user and symbol = p_symbol;

    insert into public.holdings (user_id, symbol, quantity, avg_price)
    values (
      v_user, p_symbol,
      v_hold + v_qty,
      case when v_hold + v_qty > 0 then (v_hold * v_avg + v_qty * p_price) / (v_hold + v_qty) else p_price end
    )
    on conflict (user_id, symbol)
      do update set quantity = excluded.quantity, avg_price = excluded.avg_price;

    update public.portfolios set cash = cash - p_amount where user_id = v_user;

    insert into public.transactions (user_id, symbol, side, quantity, price, total, status)
    values (v_user, p_symbol, 'buy', v_qty, p_price, p_amount, 'completed');

    return json_build_object('ok', true, 'message', 'Buy order completed', 'quantity', v_qty, 'total', p_amount);

  else
    -- p_amount = quantity of the asset to sell
    select coalesce(quantity, 0), coalesce(avg_price, 0) into v_hold, v_avg
      from public.holdings where user_id = v_user and symbol = p_symbol;

    if v_hold < p_amount then
      return json_build_object('ok', false, 'message', 'Insufficient ' || p_symbol || ' balance');
    end if;

    v_total := round(p_amount * p_price, 2);

    if v_hold - p_amount <= 0 then
      delete from public.holdings where user_id = v_user and symbol = p_symbol;
    else
      update public.holdings set quantity = quantity - p_amount where user_id = v_user and symbol = p_symbol;
    end if;

    update public.portfolios
      set cash = cash + v_total,
          realized_pl = realized_pl + (v_total - (p_amount * v_avg)),
          realized_cost = realized_cost + (p_amount * v_avg)
      where user_id = v_user;

    insert into public.transactions (user_id, symbol, side, quantity, price, total, status)
    values (v_user, p_symbol, 'sell', p_amount, p_price, v_total, 'completed');

    return json_build_object('ok', true, 'message', 'Sell order completed', 'quantity', p_amount, 'total', v_total);
  end if;
end;
$$;

grant execute on function public.execute_trade(text, text, numeric, numeric) to authenticated;
