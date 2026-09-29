-- Safe public Flight Challenge leaderboard.
-- Returns an opaque display label instead of exposing auth user UUIDs.
create or replace function public.get_flight_leaderboard()
returns table (
  player_label text,
  best_score integer,
  first_verified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    'Player ' || upper(substr(md5(a.user_id::text), 1, 6)) as player_label,
    max(a.score)::integer as best_score,
    min(a.verified_at) filter (where a.score is not null) as first_verified_at
  from public.skill_attempts a
  join public.skill_competitions c on c.id = a.competition_id
  where a.status = 'verified'
    and c.slug = 'flight-challenge-250'
  group by a.user_id
  order by best_score desc, first_verified_at asc
  limit 10;
$$;

revoke all on function public.get_flight_leaderboard() from public;
grant execute on function public.get_flight_leaderboard() to anon, authenticated;
