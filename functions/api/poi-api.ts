export async function onRequest(context: any) {
  const { request, env } = context;
  
  const body = await request.json();
  const { query, mode = "default" } = body;

  return new Response(JSON.stringify({
    "success": true,
    "data": {
      "answer": `You asked: ${query}`,
      "key_insights": ["This is working from Cloudflare now"],
      "recommendations": ["Delete Supabase next"],
      "mode": mode
    }
  }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
