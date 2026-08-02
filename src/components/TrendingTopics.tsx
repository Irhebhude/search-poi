import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Flame, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface TrendingItem {
  query: string;
  search_count: number;
  last_searched_at: string;
}

const TrendingTopics = () => {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<TrendingItem[]>([]);

  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await api
        .from("trending_searches" as any)
        .select("query, search_count, last_searched_at")
        .order("search_count", { ascending: false })
        .limit(8);
      if (data) setTrending(data as any);
    };
    fetchTrending();

    // Real-time updates
    const channel = api
      .channel("trending-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trending_searches" }, () => {
        fetchTrending();
      })
      .subscribe();

    return () => { api.removeChannel(channel); };
  }, []);

  if (trending.length === 0) return null;

  return (
    <div className="glass rounded-2xl border border-border/30 overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <Flame className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Trending Searches</h3>
      </div>
      <div className="divide-y divide-border/20">
        {trending.map((item, i) => (
          <motion.button
            key={item.query}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/search?q=${encodeURIComponent(item.query)}`)}
            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-secondary/20 transition-colors group"
          >
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{item.query}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {item.search_count} searches
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default TrendingTopics;
