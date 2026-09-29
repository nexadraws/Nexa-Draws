import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SLUG = "flight-challenge-250";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const entityId = Deno.env.get("NOCHEX_ENTITY_ID");
    const bearer = Deno.env.get("NOCHEX_BEARER_TOKEN");
    if (!supabaseUrl || !anonKey || !serviceKey || !entityId || !bearer) {
      return json({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sign in required" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: comp, error: compError } = await admin.from("skill_competitions")
      .select("id,status,attempt_price_pence,attempts_per_purchase,closes_at")
      .eq("slug", SLUG).single();
    if (compError || !comp || !["test","live"].includes(comp.status)) return json({ error: "Challenge unavailable" }, 409);
    if (comp.closes_at && new Date(comp.closes_at).getTime() <= Date.now()) return json({ error: "Challenge closed" }, 409);

    // Keep beta free: payment checkout is deliberately unavailable until the competition is switched to live.
    if (comp.status !== "live") return json({ error: "Paid checkout is disabled while the challenge is in test mode" }, 409);

    const amountPence = Number(comp.attempt_price_pence);
    const attempts = Number(comp.attempts_per_purchase);
    if (!Number.isInteger(amountPence) || amountPence !== 100 || !Number.isInteger(attempts) || attempts !== 2) {
      return json({ error: "Unexpected challenge pricing configuration" }, 500);
    }

    const orderReference = crypto.randomUUID();
    const { data: purchase, error: purchaseError } = await admin.from("skill_purchases").insert({
      competition_id: comp.id,
      user_id: user.id,
      provider: "nochex",
      order_reference: orderReference,
      amount_pence: amountPence,
      currency: "GBP",
      status: "pending",
      attempts_total: attempts,
      attempts_used: 0,
    }).select("id,order_reference").single();
    if (purchaseError || !purchase) throw purchaseError || new Error("Could not create purchase");

    const params = new URLSearchParams();
    params.set("entityId", entityId);
    params.set("amount", (amountPence / 100).toFixed(2));
    params.set("currency", "GBP");
    params.set("paymentType", "DB");
    params.set("merchantTransactionId", "flight:" + purchase.id);\n    params.set("notificationUrl", supabaseUrl + "/functions/v1/verify-flight-payment");\n    params.set("merchant.url", "https://nexadraw.co.uk/");

    const response = await fetch("https://eu-prod.oppwa.com/v1/checkouts", {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.id) {
      await admin.from("skill_purchases").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", purchase.id).eq("status", "pending");
      return json({ error: "Unable to create Nochex checkout" }, 502);
    }

    return json({
      success: true,
      purchase_id: purchase.id,
      order_reference: purchase.order_reference,
      checkout_id: String(data.id),
      amount: "1.00",
      currency: "GBP",
      attempts: 2,
      payment_widget_url: `https://eu-prod.oppwa.com/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(String(data.id))}`,
    });
  } catch (e) {
    console.error("create-flight-checkout error", e);
    return json({ error: "Unexpected server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
