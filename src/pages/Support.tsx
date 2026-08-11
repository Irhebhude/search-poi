import { useCallback, useEffect, useState } from "react";
import { Loader2, LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export interface Ticket {
  id: number;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  reply: string | null;
  created_at: string;
  updated_at?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-primary/15 text-primary",
  pending: "bg-accent/20 text-accent-foreground",
  closed: "bg-muted text-muted-foreground",
};

export function TicketBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

const Support = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const load = useCallback(async (address: string) => {
    if (!address && !isAdmin) return;
    setLoading(true);
    try {
      const query = isAdmin ? "" : `?email=${encodeURIComponent(address)}`;
      const res = await fetch(apiUrl(`/api/tickets${query}`), { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Could not load tickets");
      setTickets(body.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(email); }, [email, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      toast.error("Email and message are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/tickets"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Could not submit ticket");
      toast.success("Ticket submitted — we'll reply by email");
      setMessage("");
      setSubject("");
      load(email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit ticket");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Support — SEARCH-POI" description="Submit a support ticket and track its status." path="/support" />
      <Header />
      <main className="container mx-auto max-w-3xl px-3 sm:px-4 pt-28 pb-16 space-y-4">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Support</h1>
        </div>

        <Card className="glass p-4 sm:p-5">
          <form onSubmit={submit} className="space-y-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" className="min-h-[48px]" />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className="min-h-[48px]" />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue…" rows={5} />
            <Button type="submit" disabled={sending} className="min-h-[48px] w-full sm:w-auto">
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Submit ticket</>}
            </Button>
          </form>
        </Card>

        <Card className="glass p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-3">{isAdmin ? "All tickets" : "Your tickets"}</h2>
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && !tickets.length && <p className="text-xs text-muted-foreground">No tickets yet.</p>}
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{t.subject || "Support request"}</span>
                  <TicketBadge status={t.status} />
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.message}</p>
                {t.reply && <p className="mt-2 text-xs text-primary whitespace-pre-wrap">Reply: {t.reply}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  #{t.id} · {new Date(t.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <p className="mt-3 text-xs text-muted-foreground">
              Manage statuses and transcripts in the <a href="/admin/support" className="text-primary hover:underline">admin support view</a>.
            </p>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Support;
