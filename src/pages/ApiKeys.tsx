import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Copy, Check, RefreshCw, Terminal } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

interface ApiKeyRow {
  id: number;
  key: string;
  requests_count: number;
  period: string | null;
  created_at: string;
  is_active: number;
}

const ApiKeys = () => {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [quota, setQuota] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/keys"), { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not load keys");
      setKeys(body.keys || []);
      setQuota(body.quota ?? 1000);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user, load]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/keys/generate"), { method: "POST", credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not generate a key");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = keys.find((k) => k.is_active) ?? null;

  const copy = () => {
    if (!active) return;
    navigator.clipboard.writeText(active.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const example = `curl "https://search-poi.pages.dev/api/search?q=abuja&api_key=${active?.key ?? "YOUR_KEY"}"`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-16">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Fact-based search over the SEARCH-POI database. {quota.toLocaleString()} requests/month on the free plan.
        </p>

        {!user ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground mb-4">Sign in to create an API key.</p>
            <Link to="/auth" className="inline-flex min-h-[48px] items-center rounded-xl bg-primary px-6 font-medium text-primary-foreground">
              Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Your key</p>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : active ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="flex-1 min-w-[220px] break-all rounded-xl bg-muted/40 px-3 py-3 font-mono text-sm text-primary">
                      {active.key}
                    </code>
                    <button
                      onClick={copy}
                      className="flex min-h-[48px] items-center gap-2 rounded-xl bg-primary/10 px-4 font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {active.requests_count.toLocaleString()} / {quota.toLocaleString()} requests used
                    {active.period ? ` in ${active.period}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No key yet — generate one below.</p>
              )}

              <button
                onClick={generate}
                disabled={busy}
                className="mt-4 flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
                {active ? "Regenerate key" : "Generate key"}
              </button>
              {active && (
                <p className="mt-2 text-xs text-muted-foreground">Regenerating deactivates your current key immediately.</p>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Terminal className="w-4 h-4 text-primary" /> Quick start
              </div>
              <pre className="overflow-x-auto rounded-xl bg-muted/40 p-4 font-mono text-xs text-muted-foreground">{example}</pre>
              <p className="mt-3 text-xs text-muted-foreground">
                Results come straight from the SEARCH-POI database. No AI generation, no invented prices.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ApiKeys;
