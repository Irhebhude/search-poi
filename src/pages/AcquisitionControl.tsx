import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Send, Sparkles, RefreshCw, ExternalLink, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api as supabase } from "@/lib/api";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "prosperozoya50@gmail.com";

interface PostRecord {
  id: string;
  content: string;
  status: "pending" | "sent" | "failed";
  platforms: string[];
  postUrls: { platform: string; url: string }[];
  refId?: string;
  timestamp: string;
}

const AcquisitionControl = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [todayCount, setTodayCount] = useState(0);

  const generateContent = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ayrshare-post", {
        body: { action: "generate" },
      });
      if (error) throw error;
      setDraftContent(data.content || "");
      toast({ title: "Content generated", description: "AI elite copy ready for review." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const publishPost = async () => {
    if (!draftContent.trim()) return;
    setPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ayrshare-post", {
        body: { action: "post", customPost: draftContent, mediaUrl: mediaUrl || undefined },
      });
      if (error) throw error;

      const postUrls: { platform: string; url: string }[] = [];
      if (data.data?.postIds) {
        for (const p of data.data.postIds) {
          if (p.postUrl) postUrls.push({ platform: p.platform, url: p.postUrl });
        }
      }

      const newPost: PostRecord = {
        id: data.data?.id || crypto.randomUUID(),
        content: draftContent.slice(0, 120) + "...",
        status: data.success ? "sent" : "failed",
        platforms: ["twitter", "facebook", "instagram", "linkedin", "tiktok"],
        postUrls,
        refId: data.data?.id,
        timestamp: new Date().toISOString(),
      };
      setPosts((prev) => [newPost, ...prev]);
      setTodayCount((c) => c + 1);
      setDraftContent("");
      setMediaUrl("");
      toast({ title: "Post published!", description: `Distributed to ${postUrls.length} platforms.` });
    } catch (e: any) {
      toast({ title: "Post failed", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data } = await supabase.functions.invoke("ayrshare-post", {
        body: { action: "history" },
      });
      if (Array.isArray(data)) {
        const mapped: PostRecord[] = data.slice(0, 50).map((h: any) => ({
          id: h.id || crypto.randomUUID(),
          content: (h.post || "").slice(0, 120) + "...",
          status: h.status === "success" ? "sent" : "failed",
          platforms: h.platforms || [],
          postUrls: (h.postIds || []).filter((p: any) => p.postUrl).map((p: any) => ({ platform: p.platform, url: p.postUrl })),
          refId: h.id,
          timestamp: h.created || new Date().toISOString(),
        }));
        setPosts(mapped);
      }
    } catch {}
  };

  useEffect(() => {
    if (!authLoading && user?.email === ADMIN_EMAIL) loadHistory();
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEOHead title="Acquisition Control — SEARCH-POI" description="Admin acquisition posting tool" path="/admin/acquisition-control" />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                Acquisition <span className="text-primary">Control</span>
              </h1>
              <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                {todayCount}/20 posts today
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Automated elite social media distribution via Ayrshare</p>
          </motion.div>

          {/* Content Generator */}
          <div className="glass rounded-2xl p-5 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">AI Content Generator</h2>
              <button
                onClick={generateContent}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Elite Copy"}
              </button>
            </div>

            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              rows={8}
              className="w-full bg-secondary/50 border border-border/30 rounded-xl p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="AI-generated content will appear here... or write your own"
            />

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="flex-1 bg-secondary/50 border border-border/30 rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Media URL (optional) — .mp4, .png, .jpg, .pdf"
              />
              <button
                onClick={publishPost}
                disabled={posting || !draftContent.trim() || todayCount >= 20}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[hsl(142,70%,40%)] text-white text-sm font-medium hover:bg-[hsl(142,70%,35%)] disabled:opacity-50 transition-colors"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {posting ? "Posting..." : "Publish to All Platforms"}
              </button>
            </div>
          </div>

          {/* Live Status Table */}
          <div className="glass rounded-2xl border border-border/30 overflow-hidden">
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Live Post Status</h2>
              <button onClick={loadHistory} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Content</th>
                    <th className="text-left p-3 font-medium">Platforms</th>
                    <th className="text-left p-3 font-medium">Links</th>
                    <th className="text-left p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No posts yet. Generate and publish your first elite post.</td></tr>
                  ) : (
                    posts.map((p) => (
                      <tr key={p.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                        <td className="p-3">
                          {p.status === "sent" ? (
                            <span className="flex items-center gap-1 text-[hsl(142,70%,50%)] text-xs font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Sent</span>
                          ) : p.status === "failed" ? (
                            <span className="flex items-center gap-1 text-red-400 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" /> Failed</span>
                          ) : (
                            <span className="flex items-center gap-1 text-yellow-400 text-xs font-semibold"><Clock className="w-3.5 h-3.5" /> Pending</span>
                          )}
                        </td>
                        <td className="p-3 text-foreground max-w-[200px] truncate">{p.content}</td>
                        <td className="p-3 text-muted-foreground text-xs">{p.platforms.join(", ")}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {p.postUrls.map((u, i) => (
                              <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-0.5">
                                {u.platform} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                            {p.postUrls.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{new Date(p.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AcquisitionControl;
