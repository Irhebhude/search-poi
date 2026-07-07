import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Admin-only: approve (or deny) a Deal Room access request.
// On approval, generates a 24h signed download URL for the requested document,
// stores it on the request, and (if email infra is set up) emails the buyer.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Confirm admin role
    const { data: roleRow } = await admin
      .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = (body.requestId || "").toString();
    const action = (body.action || "approve").toString();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: reqErr } = await admin
      .from("deal_access_requests").select("*").eq("id", requestId).single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deny") {
      await admin.from("deal_access_requests").update({ status: "denied" }).eq("id", requestId);
      return new Response(JSON.stringify({ ok: true, status: "denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!request.document_id) {
      return new Response(JSON.stringify({ error: "Request has no document" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await admin
      .from("deal_documents").select("*").eq("id", request.document_id).single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EXPIRES = 60 * 60 * 24; // 24 hours
    const { data: signed, error: signErr } = await admin.storage
      .from("deal-room-docs")
      .createSignedUrl(doc.file_path, EXPIRES, { download: doc.file_name });
    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not create download link" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + EXPIRES * 1000).toISOString();
    await admin.from("deal_access_requests").update({
      status: "approved",
      download_token: signed.signedUrl,
      token_expires_at: expiresAt,
      approved_at: new Date().toISOString(),
    }).eq("id", requestId);

    // Best-effort email to buyer (only works once email infra is configured)
    let emailed = false;
    try {
      const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "deal-room-access",
          recipientEmail: request.buyer_email,
          idempotencyKey: `deal-access-${requestId}`,
          templateData: {
            buyerName: request.buyer_name,
            documentTitle: doc.title,
            downloadUrl: signed.signedUrl,
          },
        },
      });
      emailed = !mailErr;
    } catch (_) { emailed = false; }

    return new Response(JSON.stringify({
      ok: true, status: "approved", downloadUrl: signed.signedUrl, expiresAt, emailed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
