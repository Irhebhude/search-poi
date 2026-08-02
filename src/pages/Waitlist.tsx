import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, CheckCircle, AlertCircle, Users, Zap, Globe, TrendingUp } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const BENEFITS = [
  { icon: Zap, title: "AI-Powered Search", desc: "Instant answers with deep reasoning across the entire web" },
  { icon: Globe, title: "Real-Time Intelligence", desc: "Live trending topics, news, and location-aware results" },
  { icon: TrendingUp, title: "Auto-Growing SEO", desc: "Self-sustaining content engine that drives organic traffic 24/7" },
  { icon: Users, title: "Built for Scale", desc: "Engineered for 10k+ daily active users from day one" },
];

const Waitlist = () => {
  const [form, setForm] = useState({ full_name: "", email: "", company: "", use_case: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return;
    setStatus("loading");

    const { error } = await api.from("waitlist" as any).insert([{
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      company: form.company.trim() || null,
      use_case: form.use_case.trim() || null,
    }]);

    if (error) {
      if (error.code === "23505") {
        setErrorMsg("You're already on the waitlist! We'll reach out soon.");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
      setStatus("error");
    } else {
      setStatus("success");
      setForm({ full_name: "", email: "", company: "", use_case: "" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Join the SEARCH-POI Waitlist — AI Search Engine"
        description="Be first in line for SEARCH-POI, the AI-powered search engine with real-time intelligence, automated SEO, and deep research capabilities."
        path="/waitlist"
        keywords={["AI search engine", "waitlist", "search technology", "SEARCH-POI"]}
      />
      <Header />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Rocket className="w-4 h-4" />
              Early Access — Limited Spots
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
              The Future of Search<br />
              <span className="gradient-text">Starts Here</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              SEARCH-POI is an AI-powered search engine that delivers instant answers, real-time intelligence, and self-growing SEO — built for businesses that want to dominate organic traffic.
            </p>
          </motion.div>

          {/* Benefits grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="glass rounded-xl p-5 border border-border/30 text-center">
                <b.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-bold text-foreground mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Waitlist form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-lg mx-auto">
            {status === "success" ? (
              <div className="glass rounded-2xl p-8 border border-primary/30 text-center">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">You're on the list! 🎉</h2>
                <p className="text-muted-foreground">We'll reach out with early access details soon. Share SEARCH-POI with others to move up the list.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8 border border-border/30 space-y-4">
                <h2 className="text-xl font-bold text-foreground text-center mb-2">Join the Waitlist</h2>
                <p className="text-sm text-muted-foreground text-center mb-4">Get early access to AI-powered search technology for your business.</p>

                {status === "error" && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                    <Input value={form.full_name} onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your name" required className="bg-background/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@company.com" required className="bg-background/50" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Company (optional)</label>
                  <Input value={form.company} onChange={(e) => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Your company name" className="bg-background/50" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">How would you use SEARCH-POI? (optional)</label>
                  <Textarea value={form.use_case} onChange={(e) => setForm(p => ({ ...p, use_case: e.target.value }))} placeholder="Tell us about your use case…" rows={3} className="bg-background/50" />
                </div>

                <Button type="submit" disabled={status === "loading"} className="w-full gap-2" size="lg">
                  <Rocket className="w-4 h-4" />
                  {status === "loading" ? "Joining…" : "Join the Waitlist"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">No spam. We'll only contact you about SEARCH-POI updates.</p>
              </form>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Waitlist;
