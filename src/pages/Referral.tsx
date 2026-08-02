import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Check, Users, Trophy, Share2, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";

interface ReferralData {
  total: number;
  verified: number;
  pending: number;
  rewards: number;
}

interface ReferralDetail {
  referred_id: string;
  referred_display_name: string | null;
  referred_ip: string | null;
  referrer_ip: string | null;
  status: string;
  created_at: string;
  is_flagged: boolean;
}

const Referral = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralData>({ total: 0, verified: 0, pending: 0, rewards: 0 });
  const [referralDetails, setReferralDetails] = useState<ReferralDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const publishedUrl = "https://search-poi.lovable.app";
  const referralLink = profile?.referral_code
    ? `${publishedUrl}/auth?ref=${profile.referral_code}`
    : "";

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchStats = async () => {
      const [referralsRes, rewardsRes] = await Promise.all([
        supabase.from("referrals").select("status").eq("referrer_id", user.id),
        supabase.from("referral_rewards").select("id").eq("user_id", user.id),
      ]);

      const referrals = referralsRes.data || [];

      // Fetch detailed referral info with IP check
      const { data: details } = await supabase.rpc("get_referral_details", { referrer_uid: user.id });
      const detailsList = (details || []) as ReferralDetail[];
      setReferralDetails(detailsList);

      // Flagged IDs should not count as verified
      const flaggedIds = new Set(
        detailsList.filter((d) => d.is_flagged).map((d) => d.referred_id)
      );
      const legitimateVerified = referrals.filter(
        (r: any) => (r.status === "verified" || r.status === "rewarded") && !flaggedIds.has(r.referred_id)
      ).length;

      setStats({
        total: referrals.length,
        verified: legitimateVerified,
        pending: referrals.filter((r: any) => r.status === "pending").length,
        rewards: rewardsRes.data?.length || 0,
      });


      setLoading(false);
    };

    fetchStats();
  }, [user]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join SEARCH-POI",
        text: "Try SEARCH-POI — the AI-powered search engine that's smarter than Google!",
        url: referralLink,
      });
    } else {
      copyLink();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-20 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <SEOHead title="Referral Program — SEARCH-POI" description="Refer 10 friends to SEARCH-POI and get a free month of premium access." path="/referral" />
        <main className="pt-20 pb-16 px-4">
          <div className="container mx-auto max-w-2xl text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Gift className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-4">
                Refer Friends, Get <span className="text-primary">Free Access</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
                Refer 10 real users to SEARCH-POI and unlock a free month of premium access. It's that simple.
              </p>

              <div className="glass rounded-2xl p-6 border border-border/30 mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">How it works</h2>
                <div className="grid gap-4 text-left">
                  {[
                    { step: "1", text: "Sign up for a free SEARCH-POI account" },
                    { step: "2", text: "Share your unique referral link with friends" },
                    { step: "3", text: "Friends sign up and create an account" },
                    { step: "4", text: "After 10 verified referrals, you get a free month!" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {item.step}
                      </div>
                      <p className="text-muted-foreground text-sm pt-1">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Sign Up to Start Referring
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  const progressPercent = Math.min((stats.verified % 10) / 10 * 100, 100);
  const nextRewardIn = 10 - (stats.verified % 10);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEOHead title="Your Referrals — SEARCH-POI" description="Track your referrals and earn free premium access on SEARCH-POI." path="/referral" />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-foreground mb-2 text-center">
              Your <span className="text-primary">Referrals</span>
            </h1>
            <p className="text-muted-foreground text-center mb-8">
              Share SEARCH-POI and earn free premium access
            </p>

            {/* Referral link card */}
            <div className="glass rounded-2xl p-6 border border-primary/20 mb-6">
              <label className="text-sm font-medium text-foreground mb-2 block">Your Referral Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/30 text-foreground text-sm truncate"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2.5 rounded-xl bg-secondary border border-border/30 hover:bg-accent/20 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button
                  onClick={shareLink}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Code: <span className="text-primary font-mono">{profile?.referral_code}</span>
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { icon: Users, label: "Total Referred", value: stats.total, color: "text-primary" },
                { icon: Check, label: "Verified", value: stats.verified, color: "text-green-400" },
                { icon: Gift, label: "Pending", value: stats.pending, color: "text-yellow-400" },
                { icon: Trophy, label: "Rewards Earned", value: stats.rewards, color: "text-purple-400" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-4 border border-border/30 text-center">
                  <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Referred Users List with IP Status */}
            {referralDetails.length > 0 && (
              <div className="glass rounded-2xl p-6 border border-border/30 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Referred Users
                </h3>
                <div className="space-y-3">
                  {referralDetails.map((detail) => (
                    <div
                      key={detail.referred_id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        detail.is_flagged
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border/30 bg-secondary/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Blinking status indicator */}
                        <div className="relative flex items-center justify-center">
                          {detail.is_flagged ? (
                            <>
                              <span className="absolute inline-flex h-4 w-4 rounded-full bg-destructive/60 animate-ping" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                            </>
                          ) : (
                            <>
                              <span className="absolute inline-flex h-4 w-4 rounded-full bg-green-400/60 animate-ping" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {detail.referred_display_name || "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {detail.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {detail.is_flagged ? (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs font-semibold">Flagged</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-green-500">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-xs font-semibold">Legit</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress to next reward */}
            <div className="glass rounded-2xl p-6 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Progress to Next Reward</h3>
                <span className="text-xs text-muted-foreground">{stats.verified % 10}/10 verified</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {nextRewardIn === 10 && stats.verified === 0
                  ? "Start referring friends to earn your first reward!"
                  : nextRewardIn === 0
                  ? "🎉 You've earned a reward! Check your rewards above."
                  : `${nextRewardIn} more verified referral${nextRewardIn === 1 ? "" : "s"} until your next free month!`}
              </p>
            </div>

            {/* Anti-fraud notice */}
            <div className="mt-6 p-4 rounded-xl bg-secondary/30 border border-border/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Fair Play Policy:</strong> Referrals are verified via IP address and search activity. Users sharing the same IP as you will be flagged. Only unique, real users with 1+ search count toward your referral goal.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Referral;
