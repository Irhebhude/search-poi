import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { TicketBadge, type Ticket } from "./Support";

const SupportAdmin = () => {
  const { isAdmin, loading: checking } = useIsAdmin();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/tickets"), { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Could not load tickets");
      setTickets(body.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const update = async (id: number, patch: { status?: string; reply?: string }) => {
    setBusy(id);
    try {
      const res = await fetch(apiUrl(`/api/tickets/${id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Update failed");
      toast.success("Ticket updated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-background grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4 text-center">
        <div>
          <ShieldAlert className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Support Admin — SEARCH-POI" description="Review, reply to and close support tickets." path="/admin/support" />
      <Header />
      <main className="container mx-auto max-w-4xl px-3 sm:px-4 pt-28 pb-16 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">Support Admin</h1>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="min-h-[44px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {!loading && !tickets.length && <p className="text-sm text-muted-foreground">No tickets in the queue.</p>}

        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="glass p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold">{t.subject || "Support request"}</span>
                <TicketBadge status={t.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{t.email} · #{t.id} · {new Date(t.created_at).toLocaleString()}</p>
              <p className="text-sm whitespace-pre-wrap mb-3">{t.message}</p>
              {t.reply && <p className="text-xs text-primary whitespace-pre-wrap mb-3">Current reply: {t.reply}</p>}

              <Textarea
                rows={3}
                placeholder="Write a reply…"
                value={replies[t.id] ?? ""}
                onChange={(e) => setReplies((r) => ({ ...r, [t.id]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" className="min-h-[44px]" disabled={busy === t.id || !(replies[t.id] ?? "").trim()}
                  onClick={() => update(t.id, { reply: replies[t.id], status: "pending" })}>
                  Save reply
                </Button>
                <Button size="sm" variant="secondary" className="min-h-[44px]" disabled={busy === t.id}
                  onClick={() => update(t.id, { status: "open" })}>Reopen</Button>
                <Button size="sm" variant="outline" className="min-h-[44px]" disabled={busy === t.id}
                  onClick={() => update(t.id, { status: "closed" })}>Close</Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SupportAdmin;
