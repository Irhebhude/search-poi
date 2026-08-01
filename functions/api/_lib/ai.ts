/**
 * OpenAI-compatible AI client with automatic provider/model failover.
 * Runs on the Cloudflare Workers runtime — plain fetch, no SDK.
 *
 * Providers are tried in order; each entry is keyless-friendly or uses a free
 * tier key supplied through Worker environment variables.
 */

export interface AiEnv {
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  [key: string]: unknown;
}

interface Provider {
  name: string;
  url: string;
  key?: string;
  models: string[];
}

export type ModelChain = "fast" | "balanced" | "powerful";

function providers(env: AiEnv, chain: ModelChain): Provider[] {
  const list: Provider[] = [];
  const groqModels =
    chain === "powerful"
      ? ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
      : chain === "balanced"
        ? ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
        : ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];

  if (env.GROQ_API_KEY) {
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: env.GROQ_API_KEY,
      models: groqModels,
    });
  }
  if (env.OPENROUTER_API_KEY) {
    list.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: env.OPENROUTER_API_KEY,
      models: [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
      ],
    });
  }
  if (env.GEMINI_API_KEY) {
    list.push({
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: env.GEMINI_API_KEY,
      models: chain === "powerful" ? ["gemini-2.5-pro", "gemini-2.5-flash"] : ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    });
  }
  return list;
}

export interface AiResult {
  response: Response;
  model: string;
  attempts: number;
}

export async function aiChat(opts: {
  env: AiEnv;
  messages: Array<{ role: string; content: string }>;
  chain?: ModelChain;
  stream?: boolean;
  extraBody?: Record<string, unknown>;
}): Promise<AiResult> {
  const { env, messages, chain = "fast", stream = false, extraBody = {} } = opts;
  const chainProviders = providers(env, chain);

  if (!chainProviders.length) {
    return {
      response: new Response(
        JSON.stringify({ error: "No AI provider configured. Set GROQ_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
      model: "none",
      attempts: 0,
    };
  }

  let attempts = 0;
  let last: Response | null = null;

  for (const provider of chainProviders) {
    for (const model of provider.models) {
      attempts++;
      try {
        const res = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, stream, ...extraBody }),
        });
        if (res.ok) return { response: res, model: `${provider.name}/${model}`, attempts };
        if ([429, 402, 503, 500].includes(res.status)) {
          last = res;
          continue;
        }
        return { response: res, model: `${provider.name}/${model}`, attempts };
      } catch {
        last = new Response(JSON.stringify({ error: "Network error" }), { status: 502 });
      }
    }
  }

  return {
    response: last || new Response(JSON.stringify({ error: "All AI models unavailable" }), { status: 503 }),
    model: "none",
    attempts,
  };
}

/** Convenience: run a completion and return the plain text answer. */
export async function aiText(opts: {
  env: AiEnv;
  system: string;
  user: string;
  chain?: ModelChain;
  fallback?: string;
}): Promise<string> {
  const { response } = await aiChat({
    env: opts.env,
    chain: opts.chain,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  if (!response.ok) {
    if (opts.fallback !== undefined) return opts.fallback;
    throw new Error((await response.json<any>().catch(() => ({}))).error || "AI request failed");
  }
  const data = await response.json<any>();
  return data.choices?.[0]?.message?.content || opts.fallback || "";
}
