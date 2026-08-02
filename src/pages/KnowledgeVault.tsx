import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Eye, Zap, Search, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import SEOHead from "@/components/SEOHead";
import ShareButtons from "@/components/ShareButtons";

interface VaultItem {
  id: string;
  query: string;
  answer: string | null;
  sources: any[];
  created_at: string;
}

interface Vault {
  id: string;
  name: string;
  description: string | null;
  view_count: number;
  created_at: string;
  user_id: string;
}

const KnowledgeVault = () => {
  const { slug } = useParams<{ slug: string }>();
  const [vault, setVault] = useState<Vault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: v } = await api
        .from("knowledge_vaults")
        .select("*")
        .eq("slug", slug)
        .single();
      if (v) {
        setVault(v as Vault);
        const { data: vItems } = await api
          .from("knowledge_vault_items")
          .select("*")
          .eq("vault_id", v.id)
          .order("created_at", { ascending: false });
        setItems((vItems || []) as VaultItem[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Knowledge Vault not found.</p>
        <Link to="/" className="text-primary hover:underline">Go to SEARCH-POI</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${vault.name} — SEARCH-POI Knowledge Vault`}
        description={vault.description || `Curated intelligence collection: ${vault.name}`}
        path={`/vaults/${slug}`}
      />

      {/* Banner */}
      <div className="bg-primary/10 border-b border-primary/20 py-3 px-4">
        <div className="container mx-auto max-w-3xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">SEARCH<span className="text-primary">-POI</span></span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search SEARCH-POI
          </Link>
        </div>
      </div>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <BookOpen className="w-3 h-3" />
            Knowledge Vault
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{vault.name}</h1>
          {vault.description && <p className="text-muted-foreground mb-4">{vault.description}</p>}

          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {vault.view_count} views</span>
            <span>{items.length} items</span>
            <span>{new Date(vault.created_at).toLocaleDateString()}</span>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/10 transition-colors"
                >
                  {expandedItem === item.id ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="font-medium text-foreground text-sm">{item.query}</span>
                </button>
                {expandedItem === item.id && item.answer && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="text-sm text-secondary-foreground whitespace-pre-wrap leading-relaxed border-t border-border/30 pt-3">
                      {item.answer}
                    </div>
                    <div className="mt-3">
                      <ShareButtons text={item.answer} query={item.query} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-8">This vault is empty.</p>
            )}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center glass rounded-2xl p-8">
            <BookOpen className="w-8 h-8 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold text-foreground mb-2">Create Your Own Knowledge Vault</h2>
            <p className="text-muted-foreground text-sm mb-4">Save and curate AI-powered search results into shareable collections.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Search className="w-4 h-4" />
              Get Started Free
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default KnowledgeVault;
