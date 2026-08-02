import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, MapPin } from "lucide-react";
import { api as supabase } from "@/lib/api";

interface TrendItem {
  query: string;
  count: number;
}

const IntentAnalytics = () => {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      const { data } = await supabase
        .from("trending_searches")
        .select("query, search_count")
        .order("search_count", { ascending: false })
        .limit(10);

      if (data) {
        setTrends(data.map((d) => ({ query: d.query, count: d.search_count })));
      }
      setLoading(false);
    };
    fetchTrends();
  }, []);

  const maxCount = Math.max(...trends.map((t) => t.count), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Search Intent Analytics
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-muted/20 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {trends.map((trend, i) => (
            <div key={i} className="relative">
              <div
                className="absolute inset-0 rounded-md bg-primary/10"
                style={{ width: `${(trend.count / maxCount) * 100}%` }}
              />
              <div className="relative flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}</span>
                  <TrendingUp className="w-3 h-3 text-primary/60" />
                  <span className="text-xs text-foreground truncate max-w-[160px]">{trend.query}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{trend.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <MapPin className="w-3 h-3" />
        Anonymous aggregate data • Updated in real-time
      </div>
    </motion.div>
  );
};

export default IntentAnalytics;
