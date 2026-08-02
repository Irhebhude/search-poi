import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, UserX, Shield, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { Navigate } from "react-router-dom";

const ADMIN_EMAIL = "prosperozoya50@gmail.com";

interface UserRow {
  user_id: string;
  display_name: string | null;
  email_verified: boolean;
  search_count: number;
  referral_code: string;
  signup_ip: string | null;
  created_at: string;
  updated_at: string;
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ total_users: 0, active_users: 0, inactive_users: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [statsRes, usersRes] = await Promise.all([
      supabase.rpc("get_admin_user_stats"),
      supabase.rpc("get_admin_users_list"),
    ]);
    if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
      setStats(statsRes.data[0] as any);
    }
    if (usersRes.data) setUsers(usersRes.data as UserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (user?.email !== ADMIN_EMAIL) return;
    fetchData();

    // Real-time subscription to profiles table
    const channel = supabase
      .channel("admin-profiles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, authLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEOHead title="Admin Dashboard — SEARCH-POI" description="Admin-only dashboard" path="/admin" />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-7 h-7 text-primary" />
                  Admin <span className="text-primary">Dashboard</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Real-time user analytics</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border/30 text-sm text-foreground hover:bg-accent/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Users, label: "Total Users", value: stats.total_users, color: "text-primary", bg: "bg-primary/10" },
                { icon: UserCheck, label: "Active Users", value: stats.active_users, color: "text-green-400", bg: "bg-green-400/10" },
                { icon: UserX, label: "Inactive Users", value: stats.inactive_users, color: "text-red-400", bg: "bg-red-400/10" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl p-6 border border-border/30">
                  <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{loading ? "—" : s.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Users table */}
            <div className="glass rounded-2xl border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/30">
                <h2 className="text-lg font-semibold text-foreground">All Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Verified</th>
                      <th className="text-left p-3 font-medium">Searches</th>
                      <th className="text-left p-3 font-medium">Referral Code</th>
                      <th className="text-left p-3 font-medium">IP</th>
                      <th className="text-left p-3 font-medium">Joined</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No users yet</td></tr>
                    ) : (
                      users.map((u) => {
                        const isActive = u.search_count > 0 || new Date(u.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        return (
                          <tr key={u.user_id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                            <td className="p-3 text-foreground font-medium">{u.display_name || "Anonymous"}</td>
                            <td className="p-3">
                              {u.email_verified ? (
                                <span className="text-green-400 text-xs font-semibold">✓ Yes</span>
                              ) : (
                                <span className="text-red-400 text-xs font-semibold">✗ No</span>
                              )}
                            </td>
                            <td className="p-3 text-foreground">{u.search_count}</td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{u.referral_code}</td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{u.signup_ip || "—"}</td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`relative flex h-2.5 w-2.5`}>
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? "bg-green-400" : "bg-red-400"}`} />
                                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isActive ? "bg-green-500" : "bg-red-500"}`} />
                                </span>
                                <span className={`text-xs font-semibold ${isActive ? "text-green-400" : "text-red-400"}`}>
                                  {isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
