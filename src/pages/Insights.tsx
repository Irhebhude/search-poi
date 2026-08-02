import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Eye, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { api } from "@/lib/api";

interface InsightArticle {
  id: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  view_count: number;
  created_at: string;
  keywords: string[];
}

// Programmatic SEO pages - these are auto-generated high-value queries
const SEO_PAGES = [
  { title: "Best Business to Start in Lagos with ₦200K (2026)", slug: "best-business-lagos-200k-2026", category: "business-ideas", keywords: ["business ideas Lagos", "₦200K startup", "small business Nigeria"] },
  { title: "How to Make Money Online in Nigeria (2026 Guide)", slug: "make-money-online-nigeria-2026", category: "income", keywords: ["make money Nigeria", "online income", "side hustle"] },
  { title: "Top SME Opportunities in Africa 2026", slug: "top-sme-opportunities-africa-2026", category: "market-analysis", keywords: ["SME Africa", "business opportunities", "African market"] },
  { title: "Nigeria FX Rate Predictions & Analysis", slug: "nigeria-fx-rate-predictions-2026", category: "fintech", keywords: ["Naira exchange rate", "FX forecast", "Nigeria forex"] },
  { title: "Best POS Business Locations in Lagos", slug: "best-pos-business-locations-lagos", category: "location-intelligence", keywords: ["POS business", "Lagos locations", "fintech Nigeria"] },
  { title: "Food Business Ideas in Nigeria Under ₦100K", slug: "food-business-ideas-nigeria-100k", category: "business-ideas", keywords: ["food business", "low capital", "Nigeria"] },
  { title: "AI Tools for Nigerian Entrepreneurs", slug: "ai-tools-nigerian-entrepreneurs", category: "technology", keywords: ["AI tools", "entrepreneur", "productivity"] },
  { title: "Real Estate Investment Guide Nigeria 2026", slug: "real-estate-investment-nigeria-2026", category: "investment", keywords: ["real estate Nigeria", "property investment", "Lagos housing"] },
];

const Insights = () => {
  const [trendingContent, setTrendingContent] = useState<InsightArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await api
        .from("trending_content")
        .select("*")
        .order("view_count", { ascending: false })
        .limit(12);
      if (data) setTrendingContent(data as InsightArticle[]);
      setLoading(false);
    };
    fetchContent();
  }, []);

  const JSON_LD = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "SEARCH-POI Insights",
    description: "AI-powered business intelligence, market analysis, and actionable insights for African entrepreneurs and investors.",
    url: "https://search-poi.lovable.app/insights",
    publisher: {
      "@type": "Organization",
      name: "POI Foundation",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="SEARCH-POI Insights — AI Business Intelligence & Market Analysis"
        description="Discover AI-powered business insights, market analysis, startup ideas, and investment opportunities for Nigeria and Africa. Updated daily."
        path="/insights"
        keywords={["business insights Nigeria", "market analysis Africa", "AI business intelligence", "startup ideas", "investment opportunities"]}
        jsonLd={JSON_LD}
      />
      <Header />

      <main className="container mx-auto max-w-5xl px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <TrendingUp className="w-3.5 h-3.5" />
            SEARCH-POI INSIGHTS
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Business Intelligence & <span className="text-primary">Market Insights</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-generated analysis for African business decisions. Every insight is powered by SEARCH-POI Engine v1.
          </p>
        </motion.div>

        {/* Programmatic SEO Pages */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Popular Guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SEO_PAGES.map((page, i) => (
              <motion.div
                key={page.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/search?q=${encodeURIComponent(page.title)}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-secondary/20 hover:bg-secondary/40 transition-colors group"
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{page.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {page.keywords.slice(0, 3).map(k => (
                        <span key={k} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trending Content from DB */}
        {trendingContent.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Trending Analysis
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingContent.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/trending/${article.slug}`}
                    className="block p-4 rounded-xl border border-border/30 bg-secondary/10 hover:bg-secondary/30 transition-colors group"
                  >
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase">{article.category}</span>
                    <h3 className="text-sm font-semibold text-foreground mt-2 group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.view_count}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading insights...</div>
        )}

        <div className="text-center mt-16 text-xs text-muted-foreground">
          Powered by <span className="text-primary font-semibold">SEARCH-POI Engine v1</span> • AI Business Intelligence for Africa
        </div>
      </main>
    </div>
  );
};

export default Insights;
