import { useState } from "react";
import { Share2, Download, Loader2, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SmartShareButtonProps {
  query: string;
  answer: string;
  sources?: { url: string; title: string; domain: string }[];
}

const generateSlug = (query: string): string => {
  const base = query.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 50);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
};

const SmartShareButton = ({ query, answer, sources = [] }: SmartShareButtonProps) => {
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleShare = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to share search insights.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const slug = generateSlug(query);

    const { error } = await api.from("shared_searches").insert({
      user_id: user.id,
      query,
      answer,
      sources: sources as any,
      slug,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create share link.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const url = `${window.location.origin}/shared/${slug}`;
    setShareUrl(url);
    setSaving(false);

    // Try Web Share API first (mobile-native)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${query} — SEARCH-POI Intelligence`,
          text: `Check out this AI-powered insight from SEARCH-POI: "${query}"`,
          url,
        });
        return;
      } catch { /* user cancelled, fall through to copy */ }
    }

    // Fallback: copy to clipboard
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    toast({ title: "Link created!", description: "Share link copied to clipboard." });
    setTimeout(() => setCopied(false), 3000);
  };

  if (shareUrl && !saving) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Link Ready"}
        </button>
        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check this AI insight: ${shareUrl}`)}`, "_blank")}
          className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
          title="Share on WhatsApp"
        >
          WhatsApp
        </button>
        <button
          onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`AI insight from SEARCH-POI:`)}&url=${encodeURIComponent(shareUrl)}`, "_blank")}
          className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
          title="Share on X"
        >
          X/Twitter
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={saving || !answer}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium disabled:opacity-40"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
      Share as Insight
    </button>
  );
};

export default SmartShareButton;
