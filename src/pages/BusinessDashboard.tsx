import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, BadgeCheck, Upload, Plus, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import IntentAnalytics from "@/components/IntentAnalytics";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Business {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  is_verified: boolean;
  trust_score: number;
  member_discount_percent: number | null;
}

const BusinessDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", category: "general", phone: "", whatsapp: "", email: "",
    website: "", address: "", city: "", state: "", description: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await api
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id) as any;
      if (data) setBusinesses(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { error } = await api.from("businesses").insert({
      owner_id: user.id,
      name: form.name,
      category: form.category,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      description: form.description || null,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Business registered!", description: "Verification review will begin shortly." });
      setShowForm(false);
      setForm({ name: "", category: "general", phone: "", whatsapp: "", email: "", website: "", address: "", city: "", state: "", description: "" });
      // Refresh
      const { data } = await api.from("businesses").select("*").eq("owner_id", user.id) as any;
      if (data) setBusinesses(data);
    }
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 text-center text-muted-foreground">Please sign in to access the Business Dashboard.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Business Dashboard — SEARCH-POI" description="Manage your business listings and view search analytics." path="/business" />
      <Header />

      <main className="container mx-auto max-w-4xl px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Business Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage listings, view analytics, track verification</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Business
          </button>
        </div>

        {/* Registration form */}
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={handleSubmit}
            className="glass rounded-xl p-6 mb-8 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Business Name *" required className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground">
                <option value="general">General</option>
                <option value="food">Food & Restaurant</option>
                <option value="retail">Retail</option>
                <option value="tech">Technology</option>
                <option value="health">Health</option>
                <option value="education">Education</option>
                <option value="fashion">Fashion</option>
                <option value="services">Services</option>
              </select>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp Number" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Business Email" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website URL" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full Address" className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Business Description" rows={3} className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground resize-none" />
            <button type="submit" disabled={submitting || !form.name} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit for Verification"}
            </button>
          </motion.form>
        )}

        {/* Business listings */}
        <div className="space-y-3 mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Businesses</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />)}
            </div>
          ) : businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No businesses registered yet. Click "Register Business" to get started.</p>
          ) : (
            businesses.map((biz) => (
              <div key={biz.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{biz.name}</h3>
                    {biz.is_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{biz.category} • {biz.city || "No location"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Trust Score</p>
                  <p className="text-lg font-bold text-primary">{biz.trust_score}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Intent Analytics */}
        <IntentAnalytics />
      </main>
    </div>
  );
};

export default BusinessDashboard;
