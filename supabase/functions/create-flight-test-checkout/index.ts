import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const testEntityId = Deno.env.get("NOCHEX_TEST_ENTITY_ID");
    const testBearer = Deno.env.get("NOCHEX_TEST_BEARER_TOKEN");
    const adminUid = Deno.env.get("FLIGHT_ADMIN_UID");

    if (!url || !anon) return json({ success: false, error: "Supabase server configuration missing" }, 500);
    if (!testEntityId || !testBearer) {
      return json({
        success: false,
        error: "Nochex test credentials are not configured yet. Add NOCHEX_TEST_ENTITY_ID and NOCHEX_TEST_BEARER_TOKEN in Supabase Edge Function secrets."
      }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const auth = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return json({ success: false, error: "Sign in required" }, 401);

    // Keep the admin identity server-side. If FLIGHT_ADMIN_UID is not set, refuse the test.
    if (!adminUid || user.id !== adminUid) {
      return json({ success: false, error: "Administrator access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.package_id || "single");
    const packages: Record<string, { amount: string; attempts: number }> = {
      single: { amount: "1.00", attempts: 1 },
      five: { amount: "4.00", attempts: 5 },
      ten: { amount: "7.00", attempts: 10 },
    };
    const selected = packages[packageId];
    if (!selected) return json({ success: false, error: "Invalid Flight package" }, 400);

    const reference = `flight-test:${crypto.randomUUID()}`;
    const form = new URLSearchParams();
    form.set("entityId", testEntityId);
    form.set("amount", selected.amount);
    form.set("currency", "GBP");
    form.set("paymentType", "DB");
    form.set("merchantTransactionId", reference);
    form.set("customer.merchantCustomerId", user.id);
    form.set("shopperResultUrl", "https://nexadraw.co.uk/?flightTestPayment=return");
    form.set("testMode", "EXTERNAL");

    const gateway = await fetch("https://eu-test.oppwa.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testBearer}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const data = await gateway.json().catch(() => ({}));
    if (!gateway.ok || !data?.id) {
      console.error("Flight Nochex test checkout failed", gateway.status, data);
      return json({
        success: false,
        error: data?.result?.description || "Nochex test checkout could not be created",
      }, 502);
    }

    return json({
      success: true,
      test: true,
      checkout_id: data.id,
      reference,
      amount: selected.amount,
      attempts: selected.attempts,
      payment_widget_url: `https://eu-test.oppwa.com/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(String(data.id))}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("create-flight-test-checkout error:", message, e);
    return json({ success: false, error: message }, 400);
  }
});
