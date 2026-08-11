import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Check { ok: boolean; detail: string }
interface Health {
  status: string;
  binding_used?: string | null;
  message?: string;
  help?: string;
  checked_at?: string;
  checks?: Record<string, Check>;
}

const LABELS: Record<string, string> = {
  ai: "Workers AI",
  d1: "D1 database",
  kv: "KV cache",
  config: "Runtime config",
};

export default function SystemStatus({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/health"), { credentials: "include" });
      setHealth(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ok = health?.status === "ok";
  const entries = Object.entries(health?.checks ?? {});

  return (
    <Card className="glass p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${ok ? "text-primary" : "text-destructive"}`} />
          <h2 className="text-sm font-semibold">System Status</h2>
          {health && (
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
              {health.status}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="min-h-[40px]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {health?.message && <p className="text-xs text-destructive mb-2">{health.message}</p>}
      {health?.help && <p className="text-xs text-muted-foreground mb-2">{health.help}</p>}

      <ul className="space-y-2">
        {entries.map(([key, check]) => (
          <li key={key} className="flex items-start gap-2 text-xs">
            {check.ok
              ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
            <span className="font-medium min-w-[92px]">{LABELS[key] ?? key}</span>
            <span className="text-muted-foreground break-words">{check.detail}</span>
          </li>
        ))}
        {!entries.length && !loading && !error && (
          <li className="text-xs text-muted-foreground">No diagnostics returned.</li>
        )}
      </ul>

      {!compact && health?.checked_at && (
        <p className="mt-3 text-[10px] text-muted-foreground tabular-nums">
          Binding: {health.binding_used ?? "none"} · checked {new Date(health.checked_at).toLocaleTimeString()}
        </p>
      )}
    </Card>
  );
}
