import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Gift, CheckCircle, Clock, Trophy, Zap } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface POITask {
  id: string;
  title: string;
  description: string;
  points_reward: number;
  task_type: string;
}

interface TaskCompletion {
  task_id: string;
  status: string;
}

const PREMIUM_COST = 1000;

const POIPointsDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<POITask[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [pointsLog, setPointsLog] = useState<{ points: number; reason: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("poi_tasks").select("*").eq("is_active", true),
      supabase.from("poi_task_completions").select("task_id, status").eq("user_id", user.id),
      supabase.from("poi_points_log").select("points, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([tasksRes, compRes, logRes]) => {
      setTasks((tasksRes.data || []) as POITask[]);
      setCompletions((compRes.data || []) as TaskCompletion[]);
      setPointsLog((logRes.data || []) as any[]);
      setLoading(false);
    });
  }, [user]);

  const handleCompleteTask = async (task: POITask) => {
    if (!user) return;
    const { error } = await supabase.from("poi_task_completions").insert({
      task_id: task.id,
      user_id: user.id,
      status: "completed",
      proof_data: { completed_at: new Date().toISOString() },
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already completed", description: "You've already done this task." });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }

    // Award points
    await supabase.rpc("award_poi_points", {
      target_user_id: user.id,
      amount: task.points_reward,
      point_reason: `Completed: ${task.title}`,
    });

    toast({ title: `+${task.points_reward} POI Points!`, description: task.title });
    setCompletions(prev => [...prev, { task_id: task.id, status: "completed" }]);
  };

  const handleRedeem = async () => {
    if (!profile || profile.poi_points < PREMIUM_COST) {
      toast({ title: "Not enough points", description: `You need ${PREMIUM_COST} points to redeem.`, variant: "destructive" });
      return;
    }
    toast({ title: "Redemption submitted!", description: "Your premium access will be activated shortly." });
  };

  const points = profile?.poi_points ?? 0;
  const progressPercent = Math.min((points / PREMIUM_COST) * 100, 100);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 text-center">
          <p className="text-muted-foreground">Please <Link to="/auth" className="text-primary hover:underline">sign in</Link> to view your POI Points.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="POI Points Dashboard — SEARCH-POI" description="Earn and redeem POI Points for premium access." path="/points" />
      <Header />

      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Points Overview */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[hsl(45,90%,50%)]/10">
                  <Trophy className="w-6 h-6 text-[hsl(45,90%,55%)]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{points}</h1>
                  <p className="text-xs text-muted-foreground">POI Points</p>
                </div>
              </div>
              <button
                onClick={handleRedeem}
                disabled={points < PREMIUM_COST}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(45,90%,50%)]/10 text-[hsl(45,90%,55%)] font-medium text-sm hover:bg-[hsl(45,90%,50%)]/20 transition-colors disabled:opacity-40 border border-[hsl(45,90%,50%)]/20"
              >
                <Gift className="w-4 h-4" />
                Redeem Premium
              </button>
            </div>

            {/* Progress to Premium */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{points} / {PREMIUM_COST} points</span>
                <span>Free Premium Month</span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(45,90%,55%)] transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Bounty Tasks */}
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Knowledge Bounties
          </h2>
          <div className="space-y-3 mb-8">
            {tasks.map(task => {
              const completed = completions.some(c => c.task_id === task.id);
              return (
                <div key={task.id} className="glass rounded-xl p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground text-sm">{task.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(45,90%,50%)]/10 text-[hsl(45,90%,55%)] font-bold">+{task.points_reward} pts</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                  </div>
                  {completed ? (
                    <CheckCircle className="w-5 h-5 text-[hsl(142,70%,50%)] shrink-0 ml-3" />
                  ) : (
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 ml-3"
                    >
                      Complete
                    </button>
                  )}
                </div>
              );
            })}
            {loading && <div className="text-center py-4"><Clock className="w-5 h-5 text-muted-foreground animate-pulse mx-auto" /></div>}
          </div>

          {/* Points History */}
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Points History
          </h2>
          <div className="space-y-2">
            {pointsLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/10 text-xs">
                <span className="text-foreground">{entry.reason}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[hsl(45,90%,55%)]">+{entry.points}</span>
                  <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {pointsLog.length === 0 && !loading && (
              <p className="text-center text-muted-foreground text-sm py-4">No points earned yet. Complete tasks above!</p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default POIPointsDashboard;
