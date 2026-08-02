import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Zap, Shield, Brain, BarChart3, Upload } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PREMIUM_FEATURES = [
  { icon: Brain, title: "Agentic Action Layer", desc: "Direct quote/order buttons on results. Price comparison for commodities." },
  { icon: Upload, title: "Personal Knowledge Vault", desc: "Upload PDFs/docs. AI answers from YOUR private files using RAG." },
  { icon: BarChart3, title: "Pulse Analytics", desc: "Live Forex, Crypto, Commodities. Custom Job Pulse dashboard." },
  { icon: Shield, title: "POI-Trust Priority", desc: "Verified business results ranked higher with trust badges." },
  { icon: Zap, title: "Unlimited Searches", desc: "No daily limits. Deep research mode. Priority AI models." },
  { icon: Crown, title: "Member Discounts", desc: "Exclusive discounts from POI-Verified merchants." },
];

const Premium = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in first.", variant: "destructive" });
      return;
    }
    setActivating(true);
    // Mock premium activation
    await api.from("profiles").update({ is_premium: true, premium_since: new Date().toISOString() } as any).eq("id", user.id);
    await refreshProfile();
    setActivating(false);
    toast({ title: "🎉 Welcome to Premium!", description: "All premium features are now active." });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="SEARCH-POI Premium — ₦1,000/month" description="Unlock the full power of SEARCH-POI with premium features." path="/premium" />
      <Header />

      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(45,90%,50%)]/10 text-[hsl(45,90%,55%)] text-xs font-semibold mb-4">
            <Crown className="w-3.5 h-3.5" />
            PREMIUM TIER
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Unlock <span className="text-primary">Full Power</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            ₦1,000/month • Cancel anytime
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {PREMIUM_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          {profile?.is_premium ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[hsl(142,70%,35%)]/15 text-[hsl(142,70%,50%)] font-semibold">
              <Check className="w-5 h-5" />
              You're a Premium Member
            </div>
          ) : (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {activating ? "Activating..." : "Activate Premium — ₦1,000/mo"}
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Payment integration coming soon. Currently activates as mock premium.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Premium;
