import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, AlertCircle, Globe, Image, Video, Newspaper, Cpu, Hammer, MapPin, Brain, Shield, FileText } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import SearchBar from "@/components/SearchBar";
import AIAnswer from "@/components/AIAnswer";
import WebSearchResults from "@/components/WebSearchResults";
import ImageSearchResults from "@/components/ImageSearchResults";
import VideoSearchResults from "@/components/VideoSearchResults";
import NewsSearchResults from "@/components/NewsSearchResults";
import SearchModeSelector from "@/components/SearchModeSelector";
import ToolsMenu from "@/components/ToolsMenu";
import UrlSummarizer from "@/components/UrlSummarizer";
import BlueprintGenerator from "@/components/BlueprintGenerator";
import BuildGuideViewer from "@/components/BuildGuideViewer";
import LocationSearch from "@/components/LocationSearch";
import AdSense from "@/components/AdSense";
import PulseAnalytics from "@/components/PulseAnalytics";
import CommodityPulse from "@/components/CommodityPulse";

import SEOHead from "@/components/SEOHead";
import { streamSearch, webSearch, imageSearch, videoSearch, newsSearch } from "@/lib/search-api";
import type { SearchMode, WebResult, ImageResult as ImageResultType, VideoResult as VideoResultType, NewsResult as NewsResultType } from "@/lib/search-api";
import type { SourceRef } from "@/components/SourceCitations";
import { addSearchToHistory, getRecentQueries } from "@/lib/search-context";
import { useToast } from "@/hooks/use-toast";

type SearchTab = "web" | "images" | "videos" | "news";

const TAB_CONFIG: { id: SearchTab; label: string; icon: React.ElementType }[] = [
  { id: "web", label: "Web", icon: Globe },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
  { id: "news", label: "News", icon: Newspaper },
];

/** Extract source refs from web results for the citation panel */
const buildSources = (results: WebResult[]): SourceRef[] => {
  return results.slice(0, 8).map((r) => {
    let domain = "";
    try { domain = new URL(r.url).hostname.replace("www.", ""); } catch { domain = r.url; }
    return { url: r.url, title: r.title, domain };
  });
};

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const query = searchParams.get("q") || "";
  const initialTab = (searchParams.get("tab") as SearchTab) || "web";
  const liteMode = profile?.lite_mode ?? false;
  const isPremium = profile?.is_premium ?? false;

  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [isWebLoading, setIsWebLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [webPage, setWebPage] = useState(1);
  const [hasMoreWeb, setHasMoreWeb] = useState(true);
  const [imageResults, setImageResults] = useState<ImageResultType[]>([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [videoResults, setVideoResults] = useState<VideoResultType[]>([]);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [newsResults, setNewsResults] = useState<NewsResultType[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [mode, setMode] = useState<SearchMode>("default");
  const [showSummarizer, setShowSummarizer] = useState(false);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [showBuildGuide, setShowBuildGuide] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [sources, setSources] = useState<SourceRef[]>([]);

  const performSearch = useCallback(
    async (q: string, searchMode: SearchMode = mode, tab: SearchTab = activeTab) => {
      setAnswer("");
      setIsStreaming(true);
      setError(null);
      setSearchTime(null);
      setSources([]);
      const start = performance.now();
      let accumulated = "";

      addSearchToHistory(q, searchMode);
      const recentContext = getRecentQueries(5);

      supabase.rpc("increment_search_count" as any).then(() => {});
      supabase.rpc("log_search_activity" as any, { search_query: q, search_mode: searchMode }).then(() => {});

      const aiPromise = (async () => {
        try {
          await streamSearch({
            query: q,
            mode: searchMode,
            context: recentContext,
            onDelta: (chunk) => {
              accumulated += chunk;
              setAnswer(accumulated);
            },
            onDone: () => {
              setIsStreaming(false);
              setSearchTime(Math.round(performance.now() - start));
            },
          });
        } catch (e: any) {
          setIsStreaming(false);
          setError(e.message);
          toast({ title: "Search Error", description: e.message, variant: "destructive" });
        }
      })();

      if (tab === "web") {
        setWebResults([]);
        setIsWebLoading(true);
        setWebPage(1);
        setHasMoreWeb(true);
        const webPromise = webSearch(q).then((r) => {
          setWebResults(r);
          setSources(buildSources(r));
          setIsWebLoading(false);
          if (r.length < 10) setHasMoreWeb(false);
        }).catch(() => setIsWebLoading(false));
        await Promise.allSettled([webPromise, aiPromise]);
      } else if (tab === "images") {
        setImageResults([]);
        setIsImageLoading(true);
        const imgPromise = imageSearch(q).then((r) => { setImageResults(r); setIsImageLoading(false); }).catch(() => setIsImageLoading(false));
        await Promise.allSettled([imgPromise, aiPromise]);
      } else if (tab === "videos") {
        setVideoResults([]);
        setIsVideoLoading(true);
        const vidPromise = videoSearch(q).then((r) => { setVideoResults(r); setIsVideoLoading(false); }).catch(() => setIsVideoLoading(false));
        await Promise.allSettled([vidPromise, aiPromise]);
      } else if (tab === "news") {
        setNewsResults([]);
        setIsNewsLoading(true);
        const newsPromise = newsSearch(q).then((r) => { setNewsResults(r); setIsNewsLoading(false); }).catch(() => setIsNewsLoading(false));
        await Promise.allSettled([newsPromise, aiPromise]);
      }
    },
    [toast, mode, activeTab]
  );

  useEffect(() => {
    if (query) performSearch(query);
  }, [query, performSearch]);

  const handleLoadMoreWeb = useCallback(async () => {
    if (!query || isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = webPage + 1;
    try {
      const moreResults = await webSearch(query, 10);
      if (moreResults.length === 0) {
        setHasMoreWeb(false);
      } else {
        setWebResults((prev) => {
          const existingUrls = new Set(prev.map(r => r.url));
          const newResults = moreResults.filter(r => !existingUrls.has(r.url));
          if (newResults.length === 0) setHasMoreWeb(false);
          return [...prev, ...newResults];
        });
        setWebPage(nextPage);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  }, [query, webPage, isLoadingMore]);

  const handleNewSearch = (newQuery: string) => {
    navigate(`/search?q=${encodeURIComponent(newQuery)}&tab=${activeTab}`);
  };

  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode);
    if (query) performSearch(query, newMode, activeTab);
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}&tab=${tab}`, { replace: true });
      performSearch(query, mode, tab);
    }
  };

  const handleToolAction = (action: string) => {
    if (action === "summarize") setShowSummarizer(true);
    if (action === "blueprint") setShowBlueprint(true);
    if (action === "buildguide") setShowBuildGuide(true);
    if (action === "location") setShowLocation(true);
    if (action === "images") handleTabChange("images");
    if (action === "videos") handleTabChange("videos");
    if (action === "news") handleTabChange("news");
  };

  const modeLabel = mode !== "default" ? ` • ${mode.replace("_", " ").toUpperCase()} MODE` : "";

  return (
    <>
    <div className={`min-h-screen bg-background ${liteMode ? "lite-mode" : ""}`}>
      <SEOHead title={`${query} — SEARCH-POI Results`} description={`AI-powered search results for "${query}". Get instant answers, web results, images, videos & news.`} path={`/search?q=${encodeURIComponent(query)}`} />
      <Header />

      <div className="pt-20 pb-4 px-4 border-b border-border/30 glass">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <SearchModeSelector activeMode={mode} onChange={handleModeChange} />
            </div>
            <ToolsMenu onSelectMode={handleModeChange} onAction={handleToolAction} />
          </div>
          <SearchBar onSearch={handleNewSearch} isLoading={isStreaming} compact initialQuery={query} />

          {/* Quick Tool Buttons — always visible */}
          {!liteMode && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button onClick={() => setShowBlueprint(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <Cpu className="w-3.5 h-3.5" /> Blueprints
              </button>
              <button onClick={() => setShowBuildGuide(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <Hammer className="w-3.5 h-3.5" /> Build Guide
              </button>
              <button onClick={() => handleTabChange("images")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <Image className="w-3.5 h-3.5" /> Images
              </button>
              <button onClick={() => handleTabChange("videos")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <Video className="w-3.5 h-3.5" /> Videos
              </button>
              <button onClick={() => handleTabChange("news")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <Newspaper className="w-3.5 h-3.5" /> News
              </button>
              <button onClick={() => setShowSummarizer(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <FileText className="w-3.5 h-3.5" /> Summarizer
              </button>
              <button onClick={() => setShowLocation(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                <MapPin className="w-3.5 h-3.5" /> Location
              </button>
            </div>
          )}

          {/* Search tabs */}
          {!liteMode && (
            <div className="flex items-center gap-1 mt-3 -mb-4 pb-0">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                      isActive
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        {searchTime && !isStreaming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
            <Clock className="w-3 h-3" />
            AI answer generated in {(searchTime / 1000).toFixed(2)}s{modeLabel}
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border-destructive/30 mb-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          </motion.div>
        )}

        <AIAnswer answer={answer} isStreaming={isStreaming} query={query} sources={sources} liteMode={liteMode} />

        {/* Commodity Pulse + Premium Analytics */}
        {!liteMode && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <CommodityPulse />
            {isPremium && <PulseAnalytics />}
          </div>
        )}

        {!liteMode && <AdSense adSlot="9944378861" adFormat="horizontal" className="mb-6" />}

        {activeTab === "web" && (
          <WebSearchResults
            results={webResults}
            isLoading={isWebLoading}
            onLoadMore={handleLoadMoreWeb}
            isLoadingMore={isLoadingMore}
            hasMore={hasMoreWeb}
            isPremiumUser={isPremium}
            liteMode={liteMode}
            query={query}
          />
        )}
        {activeTab === "images" && !liteMode && <ImageSearchResults results={imageResults} isLoading={isImageLoading} />}
        {activeTab === "videos" && !liteMode && <VideoSearchResults results={videoResults} isLoading={isVideoLoading} />}
        {activeTab === "news" && <NewsSearchResults results={newsResults} isLoading={isNewsLoading} />}

        {/* Blueprint buttons */}
        {query && !isStreaming && !liteMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setShowBlueprint(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all text-sm font-medium text-foreground group"
            >
              <Cpu className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              Generate Blueprint
            </button>
            <button
              onClick={() => setShowBuildGuide(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all text-sm font-medium text-foreground group"
            >
              <Hammer className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              Build Guide Video
            </button>
          </motion.div>
        )}

        {!liteMode && <AdSense adSlot="9944378861" adFormat="auto" className="mt-8" />}

        <div className="text-center mt-12 text-xs text-muted-foreground">
          Powered by <span className="text-primary font-semibold">SEARCH-POI Engine v1</span> • Intelligent Reasoning • POI Foundation
        </div>
      </main>

      <UrlSummarizer isOpen={showSummarizer} onClose={() => setShowSummarizer(false)} />
      <BlueprintGenerator isOpen={showBlueprint} onClose={() => setShowBlueprint(false)} initialQuery={query} />
      <BuildGuideViewer isOpen={showBuildGuide} onClose={() => setShowBuildGuide(false)} initialQuery={query} />
      <LocationSearch isOpen={showLocation} onClose={() => setShowLocation(false)} initialQuery={query} />
    </div>
    </>
  );
};

export default SearchResults;
