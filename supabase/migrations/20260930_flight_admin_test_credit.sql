-- Admin-only Flight Challenge test credit.
-- This is promotional/test value only: not cash, not withdrawable, not refundable,
-- and usable only while the competition remains in TEST status.

create table if not exists public.skill_test_credit (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_pence integer not null default 0 check (balance_pence >= 0),
  updated_at timestamptz not null default now()
);

alter table public.skill_test_credit enable row level security;

create or replace function public.get_my_flight_test_credit()
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select balance_pence
    from public.skill_test_credit
    where user_id = auth.uid()
  ), 0);
$$;

revoke all on function public.get_my_flight_test_credit() from public;
grant execute on function public.get_my_flight_test_credit() to authenticated;

create or replace function public.spend_flight_test_credit(
  p_user_id uuid,
  p_amount_pence integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_amount_pence <= 0 then
    raise exception 'invalid amount';
  end if;

  update public.skill_test_credit
  set balance_pence = balance_pence - p_amount_pence,
      updated_at = now()
  where user_id = p_user_id
    and balance_pence >= p_amount_pence
  returning balance_pence into v_balance;

  if v_balance is null then
    raise exception 'insufficient test credit';
  end if;
  return v_balance;
end;
$$;

revoke all on function public.spend_flight_test_credit(uuid, integer) from public;

-- Seed exactly £100.00 for the configured admin by replacing ADMIN_UID below
-- in Supabase SQL Editor with the same UUID stored in FLIGHT_ADMIN_UID.
-- insert into public.skill_test_credit (user_id, balance_pence)
-- values ('ADMIN_UID'::uuid, 10000)
-- on conflict (user_id) do update
-- set balance_pence = excluded.balance_pence, updated_at = now();
