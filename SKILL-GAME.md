# NexaDraw Flight Challenge (development)

This branch isolates the skill-game prototype from the existing draw/instant-win system.

## Security model
- Browser never writes a verified score.
- `start-flight-attempt` creates a one-use server-side attempt for the authenticated user.
- Client records input ticks only.
- `verify-flight-attempt` re-simulates the fixed-step game and computes the authoritative score.
- RLS provides no client INSERT/UPDATE access to `skill_attempts`.
- A consumed attempt cannot be submitted twice.

## Current mode
TEST ONLY. The start function refuses to mint attempts if the competition is changed to `live`. Payment entitlement consumption must be implemented before live paid play.

## Supabase setup required
1. Apply `supabase/migrations/20260929_skill_flight.sql`.
2. Deploy `supabase/functions/start-flight-attempt/index.ts`.
3. Deploy `supabase/functions/verify-flight-attempt/index.ts`.
4. Test with an authenticated NexaDraw account.

Do not put the service-role key in browser code. Supabase provides it to Edge Functions as a server-side environment secret.
