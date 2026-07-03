import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, ExternalLink, Search, X, Phone, Globe, Download } from "lucide-react";
import { livePoiSearch, poiToCsv, type LivePOI } from "@/lib/search-api";

interface LocationSearchProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const LocationSearch = ({ isOpen, onClose, initialQuery = "" }: LocationSearchProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LivePOI[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchPlaces = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await livePoiSearch(q, 50);
      setResults(data.results);
      setCached(!!data.cached);
      if (data.results.length === 0) {
        setMessage(data.message || "No live data found. Try different keywords.");
      }
    } catch {
      setResults([]);
      setMessage("Live search failed. Try again.");
    }
    setLoading(false);
  };

  const openInMap = (lat: number, lon: number) => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`, "_blank");
  };

  const downloadCsv = () => {
    if (!results.length) return;
    const blob = new Blob([poiToCsv(results)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-poi-${query.trim().replace(/\s+/g, "-").toLowerCase().slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="glass rounded-2xl border border-border/30 w-full max-w-2xl max-h-[75vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Live Business Search</h2>
            </div>
            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <button
                  onClick={downloadCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors min-h-[44px] sm:min-h-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              )}
              <button onClick={onClose} className="p-2.5 rounded-lg hover:bg-secondary/50 text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="p-4 border-b border-border/30">
            <form onSubmit={(e) => { e.preventDefault(); searchPlaces(query); }} className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Fuel stations Ikeja, Restaurants Lekki..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Live data from OpenStreetMap — real businesses only, no fake results
              {cached && results.length > 0 && <span className="ml-1 text-primary">• cached</span>}
            </p>
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-[48vh] divide-y divide-border/20">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Fetching live business data...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {message || "Enter a location to search real businesses."}
              </div>
            ) : (
              results.map((place) => (
                <motion.div
                  key={place.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(selectedId === place.id ? null : place.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{place.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{place.category} • {place.address}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {place.phone && (
                          <a href={`tel:${place.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-primary min-h-[36px]">
                            <Phone className="w-3 h-3" /> {place.phone}
                          </a>
                        )}
                        {place.website && (
                          <a href={place.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-primary min-h-[36px]">
                            <Globe className="w-3 h-3" /> Website
                          </a>
                        )}
                      </div>
                      {selectedId === place.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 flex items-center gap-2"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); openInMap(place.lat, place.lon); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors min-h-[44px]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open in Map
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LocationSearch;
