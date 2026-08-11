import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import SystemStatus from "@/components/SystemStatus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiUrl } from "@/lib/api";

interface DebugInfo {
  binding_found: boolean;
  binding_used?: string | null;
  table_exists: boolean;
  row_count: number;
  env_keys: string[];
  details?: string | null;
  help?: string;
}

const Status = () => {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const loadDebug = useCallback(async () => {
    setLoadingDebug(true);
    try {
      const res = await fetch(apiUrl("/api/debug"), { credentials: "include" });
      setDebug(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load debug info");
    } finally {
      setLoadingDebug(false);
    }
  }, []);

  useEffect(() => { loadDebug(); }, [loadDebug]);

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch(apiUrl("/api/semantic-search/reindex"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || `Reindex failed (${res.status})`);
      const n = body.indexed ?? 0;
      setLastRun(`${new Date().toLocaleTimeString()} — ${n} POI${n === 1 ? "" : "s"} embedded`);
      toast.success(n ? `Embedded ${n} POIs` : "All POIs already have embeddings");
      loadDebug();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reindex failed";
      setLastRun(`${new Date().toLocaleTimeString()} — error: ${msg}`);
      toast.error(msg);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="System Status — SEARCH-POI" description="Live health checks for Workers AI, D1, KV cache and runtime configuration." path="/status" />
      <Header />
      <main className="container mx-auto max-w-3xl px-3 sm:px-4 pt-28 pb-16 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold">System Status</h1>
        <p className="text-sm text-muted-foreground">Diagnose production breakages without opening the Cloudflare dashboard.</p>

        <SystemStatus />

        <Card className="glass p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Database diagnostics</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={loadDebug} disabled={loadingDebug} className="min-h-[40px]">
              {loadingDebug ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
          {debug ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Binding found: <span className="text-foreground">{String(debug.binding_found)}{debug.binding_used ? ` (${debug.binding_used})` : ""}</span></p>
              <p>`pois` table exists: <span className="text-foreground">{String(debug.table_exists)}</span></p>
              <p>Rows: <span className="text-foreground tabular-nums">{debug.row_count}</span></p>
              {debug.details && <p className="text-destructive">{debug.details}</p>}
              {debug.help && <p>{debug.help}</p>}
              <p className="break-words">Env keys: {debug.env_keys?.join(", ")}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
        </Card>

        <Card className="glass p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-1">Reindex POIs</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Backfills Workers AI embeddings for POIs missing one. Runs in batches of 200 — press again until it reports 0.
          </p>
          <Button onClick={reindex} disabled={reindexing} className="min-h-[48px] w-full sm:w-auto">
            {reindexing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reindexing…</> : "Reindex POIs"}
          </Button>
          {lastRun && <p className="mt-3 text-xs text-muted-foreground">{lastRun}</p>}
        </Card>
      </main>
    </div>
  );
};

export default Status;
