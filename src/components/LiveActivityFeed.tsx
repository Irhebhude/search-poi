import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, Zap } from "lucide-react";
import { api } from "@/lib/api";

interface ActivityItem {
  id: string;
  query: string;
  search_mode: string;
  created_at: string;
}

const LiveActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    // Fetch recent activity
    const fetchRecent = async () => {
      const { data } = await api
        .from("search_activity" as any)
        .select("id, query, search_mode, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (data) setActivities(data as any);
    };
    fetchRecent();

    // Realtime subscription
    const channel = api
      .channel("live-search-activity")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "search_activity",
      }, (payload) => {
        const newItem = payload.new as ActivityItem;
        setActivities(prev => [newItem, ...prev].slice(0, 8));
        setLiveCount(c => c + 1);
      })
      .subscribe();

    return () => { api.removeChannel(channel); };
  }, []);

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const modeColors: Record<string, string> = {
    default: "text-primary",
    deep_research: "text-accent-foreground",
    code: "text-primary",
    academic: "text-accent-foreground",
    business: "text-primary",
  };

  return (
    <div className="glass rounded-2xl border border-border/30 overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-ping" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Live Search Activity</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-primary" />
          <span>{liveCount} live</span>
        </div>
      </div>

      <div className="divide-y divide-border/20 max-h-[300px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {activities.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No recent searches yet — be the first!
            </div>
          ) : (
            activities.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors"
              >
                <Search className={`w-3.5 h-3.5 shrink-0 ${modeColors[item.search_mode] || "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.query}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.search_mode !== "default" && (
                      <span className="text-primary mr-1">{item.search_mode.replace("_", " ")}</span>
                    )}
                    {timeAgo(item.created_at)}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveActivityFeed;
