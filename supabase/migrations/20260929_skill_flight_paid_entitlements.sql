-- Flight Challenge paid-entitlement preparation (DO NOT enable live until Nochex APC is verified)
alter table public.skill_competitions add column if not exists attempts_per_purchase integer not null default 2 check (attempts_per_purchase > 0);

create table if not exists public.skill_purchases (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.skill_competitions(id),
  user_id uuid not null references auth.users(id),
  provider text not null default 'nochex',
  order_reference text unique not null,
  provider_transaction_id text unique,
  amount_pence integer not null check (amount_pence >= 0),
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded','chargeback','failed')),
  attempts_total integer not null default 2 check (attempts_total > 0),
  attempts_used integer not null default 0 check (attempts_used >= 0 and attempts_used <= attempts_total),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_purchases_user_idx on public.skill_purchases(competition_id,user_id,status);
alter table public.skill_purchases enable row level security;
drop policy if exists "users read own skill purchases" on public.skill_purchases;
create policy "users read own skill purchases" on public.skill_purchases for select using (auth.uid() = user_id);
-- No browser INSERT/UPDATE policy. Payment creation/APC confirmation must run server-side.

update public.skill_competitions
set title='NexaDraw Flight Challenge', prize_pence=15000, attempt_price_pence=100,
    attempts_per_purchase=2, closes_at='2026-10-15T23:59:59+01:00'
where slug='flight-challenge-250';
