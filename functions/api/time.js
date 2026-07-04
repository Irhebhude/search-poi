// /api/time — server clock for drift correction (Cloudflare Pages Function)
// Returns authoritative server time so clients can auto-correct if device clock drifts >5s.
Returns async function onRequest(context) {
  const now = new Date();
  return new Response(
    JSON.stringify({
      iso: now.toISOString(),
      epochMs: now.getTime(),
      timezone: "UTC",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
