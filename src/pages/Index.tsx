import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Zap, Globe, Shield, Cpu, Layers, MapPin, Crown, Building2, TrendingUp, BarChart3, LineChart } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import FeatureCard from "@/components/FeatureCard";
import Header from "@/components/Header";
import LiveTopBar from "@/components/LiveTopBar";
import HomeQuickActions from "@/components/HomeQuickActions";
import FloatingMenu from "@/components/FloatingMenu";
import { usePoiLive } from "@/hooks/usePoiLive";
import AdSense from "@/components/AdSense";
import SEOHead from "@/components/SEOHead";
import LiveActivityFeed from "@/components/LiveActivityFeed";
import TrendingTopics from "@/components/TrendingTopics";
import LocationSearch from "@/components/LocationSearch";
import FintechDashboard from "@/components/FintechDashboard";
import heroBg from "@/assets/hero-bg.jpg";

const FEATURES = [
  { icon: Brain, title: "AI-First Search", description: "Direct intelligent answers instead of 10 blue links. Understands meaning, intent, and context." },
  { icon: Zap, title: "Real-Time Results", description: "Live data streaming. Breaking news, stock prices, sports scores — updated in real-time." },
  { icon: Globe, title: "Deep Web Understanding", description: "Semantic analysis across billions of pages. Finds answers others miss." },
  { icon: Shield, title: "Privacy First", description: "No tracking. No profiling. No selling your data. Search freely." },
  { icon: Cpu, title: "Multi-Model AI", description: "Powered by multiple AI models working in parallel for the most accurate answers." },
  { icon: Layers, title: "Research Mode", description: "One query generates comprehensive, academic-quality research reports." },
  { icon: TrendingUp, title: "Fintech Intelligence", description: "Real-time market analytics, FX rates, and commodity tracking for smart financial decisions." },
  { icon: BarChart3, title: "Business Analytics", description: "Custom dashboards tracking key metrics, user engagement, and market performance." },
  { icon: LineChart, title: "Market Analysis", description: "AI-driven market insights, trend predictions, and competitive intelligence reports." },
];

const FINTECH_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SEARCH-POI",
  url: "https://search-poi.lovable.app/",
  description: "AI-powered intelligence ecosystem for search, fintech analytics, market analysis, and business verification. Real-time data streaming with multi-model AI.",
  applicationCategory: "SearchApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "NGN",
    description: "Free AI-powered search with premium tier at ₦1,000/month",
  },
  creator: {
    "@type": "Organization",
    name: "POI Foundation",
    founder: { "@type": "Person", name: "Prosper Ozoya Irhebhude" },
  },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://search-poi.lovable.app/search?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
  featureList: [
    "AI-Powered Search Engine",
    "Real-Time Market Analytics",
    "Fintech Intelligence Dashboard",
    "Business Verification System",
    "Knowledge Vault Repository",
    "Commodity Price Tracking",
    "Multi-Model AI Processing",
    "Location-Based Services",
  ],
};

const Index = () => {
  const navigate = useNavigate();
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const live = usePoiLive();

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };


  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <SEOHead
        title="SEARCH-POI — AI Search Engine & Fintech Intelligence"
        description="Next-gen AI search with real-time market analytics, fintech intelligence, business verification & deep research. Instant answers powered by multi-model AI. Try free."
        path="/"
        keywords={[
          "AI search engine", "fintech intelligence", "market analytics",
          "real-time search", "business verification", "commodity tracking",
          "AI answers", "deep research", "SEARCH-POI", "POI Foundation",
          "alternative to Google", "Nigerian fintech", "FX rates",
          "price comparison", "knowledge vault", "data visualization",
        ]}
        jsonLd={FINTECH_JSON_LD}
      />
      <Header />

      {/* Hero background with lazy loading */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroBg}
          alt="SEARCH-POI AI-powered search engine background"
          className="w-full h-full object-cover opacity-20"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 grid-bg opacity-30" />

      {/* Main content */}
      <main className="relative z-10 pt-24 sm:pt-32 pb-16 sm:pb-20 px-3 sm:px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-12"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-primary font-medium mb-4 sm:mb-6"
            >
              <Zap className="w-3 h-3" />
              Next-Gen AI Search & Fintech Intelligence
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-2 sm:mb-3">
              <span className="text-foreground">SEARCH</span>
              <span className="gradient-text">-POI</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest mb-4">
              <Zap className="w-3 h-3" />
              Powered by SEARCH-POI Engine v1
            </div>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed px-2">
              The world's first <span className="text-foreground font-medium">Intelligent Reasoning Search Engine</span>.
              You don't search anymore — you ask, and it <span className="text-primary font-semibold">solves</span>.
            </p>

            <SearchBar onSearch={handleSearch} />

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-3 sm:mt-4">
              <p className="text-xs text-muted-foreground">
                SEARCH-POI Engine v1 • Multi-Step Reasoning • POI Foundation
              </p>
              <button
                onClick={() => setShowLocationSearch(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors touch-manipulation"
              >
                <MapPin className="w-3 h-3" />
                Location Search
              </button>
            </div>
          </motion.div>

          {/* Real-time widgets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-12"
          >
            <TrendingTopics />
            <LiveActivityFeed />
          </motion.div>

          {/* Fintech Intelligence Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8 sm:mb-12"
          >
            <FintechDashboard />
          </motion.div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} delay={0.08 * i} />
            ))}
          </div>

          {/* Premium & Business CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 mt-8 sm:mt-10 justify-center px-2"
          >
            <Link
              to="/premium"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent/20 border border-accent/30 text-accent-foreground font-semibold hover:bg-accent/30 transition-colors touch-manipulation min-h-[48px]"
            >
              <Crown className="w-4 h-4" />
              Go Premium — ₦1,000/mo
            </Link>
            <Link
              to="/business"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold hover:bg-primary/20 transition-colors touch-manipulation min-h-[48px]"
            >
              <Building2 className="w-4 h-4" />
              Business Dashboard
            </Link>
          </motion.div>

          {/* Ad placement */}
          <AdSense adSlot="9944378861" adFormat="horizontal" className="mt-8 sm:mt-12" />

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-16 sm:mt-20 text-xs text-muted-foreground px-2"
          >
            <p>Founded by <span className="text-foreground">Prosper Ozoya Irhebhude</span> • POI Foundation</p>
            <p className="mt-1">Powered by <span className="text-primary font-semibold">SEARCH-POI Engine v1</span> • Intelligent Reasoning • Privacy Focused</p>
            <p className="mt-2"><a href="/policies" className="text-primary hover:underline">Policies & Governance</a></p>
          </motion.div>
        </div>
      </main>

      <LocationSearch isOpen={showLocationSearch} onClose={() => setShowLocationSearch(false)} />
    </div>
  );
};

export default Index;
