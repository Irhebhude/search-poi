import { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, Clock, MapPin, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api as supabase } from "@/lib/api";
import { getSearchHistory } from "@/lib/search-context";

interface SearchAutocompleteProps {
  query: string;
  isOpen: boolean;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

interface TrendingSuggestion {
  query: string;
  search_count: number;
}

const SearchAutocomplete = ({ query, isOpen, onSelect, onClose }: SearchAutocompleteProps) => {
  const [trending, setTrending] = useState<TrendingSuggestion[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch trending searches
  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await supabase
        .from("trending_searches" as any)
        .select("query, search_count")
        .order("search_count", { ascending: false })
        .limit(6);
      if (data) setTrending(data as any);
    };
    fetchTrending();

    // Realtime subscription for trending updates
    const channel = supabase
      .channel("trending-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "trending_searches" }, () => {
        fetchTrending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Location autocomplete via Nominatim (free, no key)
  useEffect(() => {
    if (!query || query.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Only fetch location suggestions if query looks location-related
      const locationKeywords = ["near", "in", "at", "restaurant", "hotel", "shop", "store", "cafe", "park", "hospital", "airport", "station", "map", "place", "location", "directions"];
      const isLocationQuery = locationKeywords.some(kw => query.toLowerCase().includes(kw));
      
      if (!isLocationQuery) {
        setLocationSuggestions([]);
        return;
      }

      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&addressdetails=1`,
          { headers: { "User-Agent": "SEARCH-POI/1.0" } }
        );
        const data = await resp.json();
        setLocationSuggestions(data.map((r: any) => r.display_name).slice(0, 3));
      } catch {
        setLocationSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Get filtered trending + history
  const recentHistory = getSearchHistory().slice(0, 3).map(h => h.query);
  
  const filteredTrending = query.length > 0
    ? trending.filter(t => t.query.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : trending.slice(0, 4);

  const filteredHistory = query.length > 0
    ? recentHistory.filter(h => h.toLowerCase().includes(query.toLowerCase()) && !filteredTrending.some(t => t.query.toLowerCase() === h.toLowerCase()))
    : recentHistory.filter(h => !filteredTrending.some(t => t.query.toLowerCase() === h.toLowerCase()));

  const hasResults = filteredTrending.length > 0 || filteredHistory.length > 0 || locationSuggestions.length > 0;

  if (!isOpen || !hasResults) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="absolute top-full mt-2 w-full glass rounded-xl overflow-hidden z-50 shadow-lg"
      >
        {/* Trending */}
        {filteredTrending.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              Trending Now
            </div>
            {filteredTrending.map((item, i) => (
              <button
                key={`t-${i}`}
                onMouseDown={() => onSelect(item.query)}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-accent/30 transition-colors text-secondary-foreground"
              >
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="flex-1 text-sm">{item.query}</span>
                <span className="text-xs text-muted-foreground">{item.search_count} searches</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Recent history */}
        {filteredHistory.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Recent
            </div>
            {filteredHistory.map((item, i) => (
              <button
                key={`h-${i}`}
                onMouseDown={() => onSelect(item)}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-accent/30 transition-colors text-secondary-foreground"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="flex-1 text-sm">{item}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Location suggestions */}
        {locationSuggestions.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary" />
              Nearby Places
            </div>
            {locationSuggestions.map((place, i) => (
              <button
                key={`l-${i}`}
                onMouseDown={() => onSelect(place)}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-accent/30 transition-colors text-secondary-foreground"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="flex-1 text-sm truncate">{place}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchAutocomplete;
