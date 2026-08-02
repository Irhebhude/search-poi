import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, FileText, Lock, Send, Loader2, ShieldCheck } from "lucide-react";
import { api as supabase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

interface PublicDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

const CATEGORIES = ["All", "Pitch Deck", "Tech Docs", "Pricing", "Demo", "Code"];

const formatSize = (b: number | null) => {
  if (!b) return "";
  const kb = b / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
};

const DealRoom = () => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<PublicDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  // request modal state
  const [openDoc, setOpenDoc] = useState<PublicDoc | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_public_deal_documents");
      setDocs((data as PublicDoc[]) || []);
      setLoading(false);
      // log the visit
      supabase.from("deal_visitor_logs").insert({
        event_type: "view",
        user_agent: navigator.userAgent,
      } as any);
    };
    load();
  }, []);

  const submitRequest = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("deal_access_requests").insert({
      document_id: openDoc?.id ?? null,
      buyer_name: name.trim(),
      buyer_email: email.trim(),
      message: message.trim() || null,
    } as any);
    if (!error) {
      supabase.from("deal_visitor_logs").insert({
        event_type: "request",
        buyer_email: email.trim(),
        document_id: openDoc?.id ?? null,
        user_agent: navigator.userAgent,
      } as any);
    }
    setSubmitting(false);
    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Access requested", description: "The owner will review and send you a secure download link." });
    setOpenDoc(null);
    setName(""); setEmail(""); setMessage("");
  };

  const filtered = filter === "All" ? docs : docs.filter((d) => d.category === filter);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="SEARCH-POI v1 Deal Room — Secure Document Portal"
        description="Risk + Authority + Blueprint in 1 Second. Request secure access to SEARCH-POI v1 sales documents."
      />

      {/* Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">SEARCH-POI v1</h1>
              <p className="text-[11px] text-muted-foreground">Deal Room</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-[11px]">
            <ShieldCheck className="w-3 h-3 text-primary" /> Verified Portal
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-12 pb-8 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">SEARCH-POI v1 Deal Room</h2>
          <p className="mt-3 text-primary font-medium">Risk + Authority + Blueprint in 1 Second</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
            Browse available documents below. Request access and the owner will send you a secure,
            24-hour download link.
          </p>
        </motion.div>
      </section>

      {/* Category pills */}
      <div className="container mx-auto px-4 flex flex-wrap gap-2 justify-center mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-4 min-h-[40px] rounded-full text-sm font-medium border transition-colors ${
              filter === c
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 text-muted-foreground hover:bg-accent/10"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Document list */}
      <section className="container mx-auto px-4 pb-20 max-w-3xl">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No documents available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-2xl border border-border/40 p-4 flex items-start gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{d.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">{d.category}</Badge>
                  </div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {d.file_name}{d.file_size ? ` · ${formatSize(d.file_size)}` : ""}
                  </p>
                </div>
                <Dialog open={openDoc?.id === d.id} onOpenChange={(o) => setOpenDoc(o ? d : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0 min-h-[44px]">
                      <Lock className="w-3.5 h-3.5" /> Request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card">
                    <DialogHeader>
                      <DialogTitle>Request access — {d.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="rn">Your name</Label>
                        <Input id="rn" value={name} onChange={(e) => setName(e.target.value)} placeholder="King David" />
                      </div>
                      <div>
                        <Label htmlFor="re">Email</Label>
                        <Input id="re" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                      </div>
                      <div>
                        <Label htmlFor="rm">Message (optional)</Label>
                        <Textarea id="rm" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you'd like access…" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={submitRequest} disabled={submitting} className="gap-1 min-h-[44px]">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send request
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DealRoom;
