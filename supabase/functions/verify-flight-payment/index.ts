import { createClient } from "npm:@supabase/supabase-js@2";

const SUCCESS_CODES = ["000.000.000", "000.100.110"];

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const entityId = Deno.env.get("NOCHEX_ENTITY_ID");
    const bearer = Deno.env.get("NOCHEX_BEARER_TOKEN");
    if (!supabaseUrl || !serviceKey || !entityId || !bearer) return response({ error: "Server configuration error" }, 500);

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let rawPath = "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      rawPath = typeof body?.resourcePath === "string" ? body.resourcePath : "";
    } else {
      const form = new URLSearchParams(await req.text());
      rawPath = form.get("resourcePath") || "";
    }
    const resourcePath = normaliseResourcePath(rawPath);
    if (!resourcePath) return response({ error: "Invalid resourcePath" }, 400);

    const verifyUrl = new URL(`https://eu-prod.oppwa.com${resourcePath}`);
    verifyUrl.searchParams.set("entityId", entityId);
    const nochexResponse = await fetch(verifyUrl.toString(), { headers: { Authorization: `Bearer ${bearer}` } });
    const payment = await nochexResponse.json().catch(() => null);
    const code = String(payment?.result?.code || "");
    if (!payment || !SUCCESS_CODES.includes(code)) return response({ success: false, state: "not_success", result_code: code }, 200);

    const paymentId = String(payment.id || "").trim();
    const merchantTransactionId = String(payment.merchantTransactionId || "").trim();
    const currency = String(payment.currency || "").trim().toUpperCase();
    const paidAmount = Number(payment.amount);
    if (!paymentId || !merchantTransactionId.startsWith("flight:") || currency !== "GBP" || !Number.isFinite(paidAmount)) {
      return response({ error: "Payment details do not match a Flight Challenge purchase" }, 409);
    }

    const purchaseId = merchantTransactionId.slice("flight:".length);
    if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) return response({ error: "Invalid purchase reference" }, 409);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: purchase, error } = await admin.from("skill_purchases")
      .select("id,competition_id,user_id,order_reference,provider_transaction_id,amount_pence,currency,status,attempts_total")
      .eq("id", purchaseId).single();
    if (error || !purchase) return response({ error: "Purchase not found" }, 404);

    if (purchase.status === "paid" && purchase.provider_transaction_id === paymentId) {
      return response({ success: true, state: "success", duplicate: true, purchase_id: purchase.id });
    }
    if (purchase.status !== "pending" || purchase.provider_transaction_id) return response({ error: "Purchase already processed" }, 409);
    if (purchase.currency !== "GBP" || purchase.amount_pence !== 100 || purchase.attempts_total !== 2 || paidAmount.toFixed(2) !== "1.00") {
      return response({ error: "Payment amount or entitlement mismatch" }, 409);
    }

    const { data: duplicate, error: duplicateError } = await admin.from("skill_purchases")
      .select("id").eq("provider_transaction_id", paymentId).neq("id", purchase.id).maybeSingle();
    if (duplicateError) return response({ error: "Unable to validate payment reference" }, 500);
    if (duplicate) return response({ error: "Payment reference already used" }, 409);

    // Conditional update makes repeated notifications idempotent and prevents a stale callback overwriting another state.
    const { data: paid, error: paidError } = await admin.from("skill_purchases").update({
      provider_transaction_id: paymentId,
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id).eq("status", "pending").is("provider_transaction_id", null)
      .select("id,attempts_total,attempts_used").maybeSingle();
    if (paidError) return response({ error: "Verified payment could not be recorded" }, 500);
    if (!paid) {
      const { data: current } = await admin.from("skill_purchases").select("status,provider_transaction_id").eq("id", purchase.id).single();
      if (current?.status === "paid" && current?.provider_transaction_id === paymentId) {
        return response({ success: true, state: "success", duplicate: true, purchase_id: purchase.id });
      }
      return response({ error: "Purchase changed during verification" }, 409);
    }

    return response({ success: true, state: "success", duplicate: false, purchase_id: purchase.id, attempts_granted: paid.attempts_total });
  } catch (e) {
    console.error("verify-flight-payment error", e);
    return response({ error: "Unexpected server error" }, 500);
  }
});

function normaliseResourcePath(input: string) {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = new URL(trimmed, "https://eu-prod.oppwa.com");
    const path = "/" + parsed.pathname.replace(/^\/+/, "");
    const match = path.match(/^\/v1\/checkouts\/([A-Za-z0-9._-]+)(\/payment)?$/);
    if (!match) return null;
    return `/v1/checkouts/${encodeURIComponent(match[1])}${match[2] || ""}`;
  } catch { return null; }
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
