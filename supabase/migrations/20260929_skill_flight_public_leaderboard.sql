-- Safe public Flight Challenge leaderboard.
-- Shows the player's NexaDraw account name from Supabase Auth metadata without exposing email or UUID.
create or replace function public.get_flight_leaderboard()
returns table (
  player_label text,
  best_score integer,
  first_verified_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      'Player ' || upper(substr(md5(a.user_id::text), 1, 6))
    ) as player_label,
    max(a.score)::integer as best_score,
    min(a.verified_at) filter (where a.score is not null) as first_verified_at
  from public.skill_attempts a
  join public.skill_competitions c on c.id = a.competition_id
  join auth.users u on u.id = a.user_id
  where a.status = 'verified'
    and c.slug = 'flight-challenge-250'
  group by a.user_id, u.raw_user_meta_data
  order by best_score desc, first_verified_at asc
  limit 10;
$$;

revoke all on function public.get_flight_leaderboard() from public;
grant execute on function public.get_flight_leaderboard() to anon, authenticated;
