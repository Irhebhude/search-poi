import { useState, useEffect, ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, Gift, ExternalLink, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import { Link } from "react-router-dom";

const ADMIN_EMAIL = "prosperozoya50@gmail.com";

interface ReferralGateProps {
  children: ReactNode;
}

const ReferralGate = ({ children }: ReferralGateProps) => {
  // All access is currently free — bypass the gate
  return <>{children}</>;
};

const GateUI = ({
  message,
  showSignUp,
  showReferral,
}: {
  message: string;
  showSignUp?: boolean;
  showReferral?: boolean;
}) => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full text-center"
    >
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Lock className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">
        Unlock <span className="text-primary">SEARCH-POI</span>
      </h2>
      <p className="text-muted-foreground mb-6 leading-relaxed">{message}</p>

      <div className="glass rounded-2xl p-5 border border-border/30 mb-6 text-left">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> How to unlock
        </h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Share your unique referral link with friends</li>
          <li>Friends sign up and create an account</li>
          <li>Each friend must perform at least 1 free search to prove they're real</li>
          <li>After 10 verified referrals, access unlocks automatically!</li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {showSignUp && (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign Up Now
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        <Link
          to="/referral"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-primary/30 text-primary font-semibold hover:bg-primary/10 transition-colors"
        >
          <Gift className="w-4 h-4" />
          {showReferral ? "Share Referral Link" : "How It Works"}
        </Link>
      </div>
    </motion.div>
  </div>
);

export default ReferralGate;
