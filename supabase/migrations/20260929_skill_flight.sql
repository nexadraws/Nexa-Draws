-- NexaDraw Flight Challenge — isolated skill-game schema
create extension if not exists pgcrypto;

create table if not exists public.skill_competitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  prize_pence integer not null check (prize_pence >= 0),
  attempt_price_pence integer not null default 100 check (attempt_price_pence >= 0),
  status text not null default 'test' check (status in ('draft','test','live','closed')),
  game_version text not null,
  starts_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_attempts (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.skill_competitions(id),
  user_id uuid not null references auth.users(id),
  entitlement_source text not null default 'test' check (entitlement_source in ('test','payment','admin')),
  payment_reference text,
  status text not null default 'issued' check (status in ('issued','started','submitted','verified','rejected','void')),
  game_version text not null,
  seed bigint not null,
  started_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz,
  score integer,
  replay jsonb,
  replay_hash text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists skill_attempts_comp_user_idx on public.skill_attempts(competition_id,user_id);
create index if not exists skill_attempts_leaderboard_idx on public.skill_attempts(competition_id,score desc) where status='verified';

alter table public.skill_competitions enable row level security;
alter table public.skill_attempts enable row level security;

drop policy if exists "skill competitions readable" on public.skill_competitions;
create policy "skill competitions readable" on public.skill_competitions for select using (status in ('test','live','closed'));

drop policy if exists "users read own skill attempts" on public.skill_attempts;
create policy "users read own skill attempts" on public.skill_attempts for select using (auth.uid() = user_id);

-- No client INSERT/UPDATE policy on skill_attempts: only Edge Functions/service role mutate attempts.

create or replace view public.skill_leaderboard as
select competition_id,user_id,max(score) as score,min(verified_at) filter (where score is not null) as first_verified_at
from public.skill_attempts
where status='verified'
group by competition_id,user_id;

insert into public.skill_competitions(slug,title,prize_pence,attempt_price_pence,status,game_version)
values ('flight-challenge-250','NexaDraw Flight Challenge',25000,100,'test','flight-v1')
on conflict (slug) do update set title=excluded.title, prize_pence=excluded.prize_pence, game_version=excluded.game_version;
