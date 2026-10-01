-- Esquema completo del dashboard. Instalación nueva: pégalo entero en
-- Supabase → SQL Editor → Run (una sola vez). Ver README.
--
-- Seguridad: RLS activado en todas las tablas. El navegador solo puede LEER,
-- y solo si su email es el del dueño (app_settings.owner_email, que la app
-- rellena sola con ALLOWED_EMAIL). Todas las escrituras las hace el servidor
-- con la secret key.

-- Configuración --------------------------------------------------------------

create table app_settings (
  key text primary key,
  value text not null
);

create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower((select auth.jwt()) ->> 'email') =
      (select lower(value) from public.app_settings where key = 'owner_email'),
    false
  );
$$;

-- Datos --------------------------------------------------------------------

create table sources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('coinbase', 'wallet')),
  label text not null,
  address text,
  chain text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index sources_coinbase_unico on sources (type) where type = 'coinbase';
create unique index sources_wallet_unica on sources (lower(address), chain) where type = 'wallet';

create table assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text,
  coingecko_id text,
  logo text
);

create table balances (
  source_id uuid not null references sources (id) on delete cascade,
  asset_id uuid not null references assets (id),
  amount numeric not null,
  value_eur numeric,
  synced_at timestamptz not null default now(),
  primary key (source_id, asset_id)
);
create index balances_asset_id on balances (asset_id);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources (id) on delete cascade,
  external_id text not null,
  type text not null,
  raw_type text,
  asset_id uuid not null references assets (id),
  amount numeric not null,
  value_eur_at_time numeric,
  fee_eur numeric,
  tx_hash text,
  chain text,
  occurred_at timestamptz not null,
  is_internal_transfer boolean not null default false,
  raw jsonb,
  unique (source_id, external_id)
);
create index transactions_occurred_at on transactions (occurred_at desc);
create index transactions_asset_id on transactions (asset_id);

create table portfolio_snapshots (
  date date primary key,
  total_value_eur numeric not null,
  invested_eur numeric,
  pnl_eur numeric
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources (id) on delete cascade,
  status text not null check (status in ('running', 'ok', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  api_calls integer
);
create index sync_runs_source_id on sync_runs (source_id);

create table price_history (
  symbol text not null,
  date date not null,
  price_eur numeric not null,
  primary key (symbol, date)
);

create table price_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  direction text not null check (direction in ('above', 'below')),
  price_eur numeric not null check (price_eur > 0),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price_eur numeric
);
create index price_alerts_active on price_alerts (active) where active;

-- Límite de envíos del enlace / código de acceso (solo servidor).
create table magic_link_sends (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  failed_codes integer not null default 0
);

-- Permisos y RLS -----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['app_settings', 'sources', 'assets', 'balances', 'transactions',
    'portfolio_snapshots', 'sync_runs', 'price_history', 'price_alerts', 'magic_link_sends'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on table %I from authenticated', t);
  end loop;
  -- Tablas que el dueño puede leer desde la app.
  foreach t in array array['sources', 'assets', 'balances', 'transactions',
    'portfolio_snapshots', 'sync_runs', 'price_history', 'price_alerts'] loop
    execute format('create policy "solo el dueño lee" on %I for select to authenticated using ((select public.is_owner()))', t);
  end loop;
end $$;
revoke all on table app_settings, magic_link_sends from authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- Funciones del servidor ---------------------------------------------------

-- Transferencias internas: el mismo tx_hash aparece como salida en una de tus
-- fuentes y como entrada en otra.
create or replace function mark_internal_transfers()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.transactions t
  set is_internal_transfer = true
  where t.tx_hash is not null
    and not t.is_internal_transfer
    and exists (
      select 1 from public.transactions o
      where lower(o.tx_hash) = lower(t.tx_hash)
        and o.source_id <> t.source_id
        and sign(o.amount) <> sign(t.amount)
    );
$$;

-- Foto diaria del valor total y del dinero metido neto.
create or replace function take_snapshot()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.portfolio_snapshots (date, total_value_eur, invested_eur, pnl_eur)
  select
    (now() at time zone 'Europe/Madrid')::date,
    v.total,
    i.invested,
    v.total - i.invested
  from
    (select coalesce(sum(value_eur), 0) as total from public.balances) v,
    (select coalesce(sum(case
              when t.type in ('compra', 'recepcion') and t.amount > 0 then t.value_eur_at_time
              when t.type in ('venta', 'envio') and t.amount < 0 then -t.value_eur_at_time
            end), 0) as invested
       from public.transactions t
       join public.assets a on a.id = t.asset_id
      where a.symbol not in ('EUR', 'USD')
        and not t.is_internal_transfer
        and t.type <> 'interno') i
  on conflict (date) do update
    set total_value_eur = excluded.total_value_eur,
        invested_eur = excluded.invested_eur,
        pnl_eur = excluded.pnl_eur;
$$;

-- Reserva atómica de un intento de código de acceso (máx. 5 por envío).
create or replace function claim_code_attempt()
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.magic_link_sends
     set failed_codes = failed_codes + 1
   where id = (
     select id from public.magic_link_sends
      where sent_at > now() - interval '1 hour'
      order by sent_at desc
      limit 1
   )
  returning failed_codes;
$$;

revoke execute on function mark_internal_transfers(), take_snapshot(), claim_code_attempt()
  from public, anon, authenticated;
revoke execute on function is_owner() from public, anon;
grant execute on function is_owner() to authenticated;
