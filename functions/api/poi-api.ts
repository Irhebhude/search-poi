export const onRequestOptions = () => new Response(null, {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-api-key",
  }
})

export async function onRequestPost(context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { request, env } = context;
    const body = await request.json().catch(() => ({}));
    const { query, mode = "default" } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers });
    }

    const GROQ_KEY = env.GROQ_API_KEY;
    if (!GROQ_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not set" }), { status: 500, headers });
    }

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: `You are SEARCH-POI Engine v1. Mode: ${mode}. Answer about Lagos/Nigeria businesses.` },
          { role: "user", content: query }
        ],
      })
    });

    const aiData = await aiRes.json();
    return new Response(JSON.stringify({
      success: true,
      data: { answer: aiData.choices[0].message.content, mode },
      meta: { powered_by: "SEARCH-POI Engine v1 - Cloudflare" }
    }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
