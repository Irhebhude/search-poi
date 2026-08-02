import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Calendar, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { api as supabase } from "@/lib/api";

interface ContentData {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  keywords: string[];
  view_count: number;
  created_at: string;
}

const TrendingContentPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetchContent = async () => {
      const { data, error } = await supabase
        .from("trending_content" as any)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (data) {
        setContent(data as any);
        // Increment view count
        await supabase
          .from("trending_content" as any)
          .update({ view_count: (data as any).view_count + 1 })
          .eq("id", (data as any).id);
      }
      setLoading(false);
    };
    fetchContent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-3xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-secondary/50 rounded w-3/4" />
              <div className="h-4 bg-secondary/50 rounded w-1/2" />
              <div className="h-64 bg-secondary/50 rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Content Not Found</h1>
          <Link to="/" className="text-primary hover:underline">Back to SEARCH-POI</Link>
        </main>
      </div>
    );
  }

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    description: content.description,
    url: `https://search-poi.lovable.app/trending/${content.slug}`,
    datePublished: content.created_at,
    author: { "@type": "Organization", name: "SEARCH-POI" },
    publisher: {
      "@type": "Organization",
      name: "SEARCH-POI",
      url: "https://search-poi.lovable.app",
    },
    keywords: content.keywords.join(", "),
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${content.title} — SEARCH-POI`}
        description={content.description}
        path={`/trending/${content.slug}`}
        keywords={content.keywords}
        type="article"
        jsonLd={articleJsonLd}
      />
      <Header />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to SEARCH-POI
          </Link>

          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize mb-3">
                <Tag className="w-3 h-3" />
                {content.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{content.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(content.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {content.view_count} views
                </span>
              </div>
            </div>

            <div className="glass rounded-2xl border border-border/30 p-6 sm:p-8 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{content.content}</ReactMarkdown>
            </div>

            {/* Keywords */}
            <div className="mt-6 flex flex-wrap gap-2">
              {content.keywords.map((kw) => (
                <Link
                  key={kw}
                  to={`/search?q=${encodeURIComponent(kw)}`}
                  className="px-3 py-1 rounded-full bg-secondary/50 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {kw}
                </Link>
              ))}
            </div>
          </motion.article>
        </div>
      </main>
    </div>
  );
};

export default TrendingContentPage;
