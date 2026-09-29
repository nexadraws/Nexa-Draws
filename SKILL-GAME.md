# NexaDraw Flight Challenge

## Current mode
TEST MODE remains enabled. Do not set the competition to `live` until Nochex APC/callback confirmation has been tested end-to-end.

## Planned paid product
- Prize: £150.
- Closing date: 15 October 2026.
- £1 purchase grants exactly 2 attempt credits.
- Each attempt is one-use and server-issued.
- The leaderboard uses the player's best server-verified score.

## Payment trust boundary
The browser/return URL is never proof of payment. A server-side Nochex APC/callback handler must:
1. identify an existing pending order created for the authenticated user;
2. verify the APC with Nochex using Nochex's documented verification flow;
3. require the expected merchant, GBP currency and exact £1.00 amount;
4. store the provider transaction ID uniquely (idempotency);
5. mark the purchase `paid` and grant 2 credits only after verification;
6. handle refund/chargeback/cancel states without minting more credits.

Do not put Nochex secrets or the Supabase service-role key in browser code.

## Deployment
Apply migrations in timestamp order and deploy Edge Functions from `supabase/functions`.
The repository contains the paid entitlement data model and live-mode credit consumption, but no live payment is enabled until the Nochex callback details are configured and verified.
