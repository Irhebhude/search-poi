import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Zap, Upload, Trash2, Loader2, ShieldAlert, LogOut, Check, X, Copy,
  FileText, Eye, Inbox, ClipboardList, Lock, Mail,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["Pitch Deck", "Tech Docs", "Pricing", "Demo", "Code"];

interface Doc {
  id: string; title: string; description: string | null; category: string;
  file_path: string; file_name: string; file_size: number | null; created_at: string;
}
interface AccessReq {
  id: string; document_id: string | null; buyer_name: string; buyer_email: string;
  message: string | null; status: string; download_token: string | null;
  token_expires_at: string | null; created_at: string;
}
interface VisitorLog {
  id: string; event_type: string; buyer_email: string | null;
  document_id: string | null; created_at: string;
}

const LoginGate = () => {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast({ title: "Login failed", description: error, variant: "destructive" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-2xl border border-border/40 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold">Deal Room Admin</h1>
            <p className="text-[11px] text-muted-foreground">Authorized access only</p>
          </div>
        </div>
        <div>
          <Label htmlFor="e">Email</Label>
          <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="p">Password</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
    </div>
  );
};

const DealRoomAdmin = () => {
  const { user, signOut, session } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const { toast } = useToast();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [requests, setRequests] = useState<AccessReq[]>([]);
  const [logs, setLogs] = useState<VisitorLog[]>([]);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);

  const loadAll = useCallback(async () => {
    const [d, r, l] = await Promise.all([
      api.from("deal_documents").select("*").order("created_at", { ascending: false }),
      api.from("deal_access_requests").select("*").order("created_at", { ascending: false }),
      api.from("deal_visitor_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setDocs((d.data as Doc[]) || []);
    setRequests((r.data as AccessReq[]) || []);
    setLogs((l.data as VisitorLog[]) || []);
  }, []);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  if (!user) return <LoginGate />;
  if (roleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 text-center">
        <div className="glass rounded-2xl border border-border/40 p-8 max-w-sm">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h1 className="font-bold text-lg">Access denied</h1>
          <p className="text-sm text-muted-foreground mt-1">This account is not authorized for the Deal Room.</p>
          <Button variant="outline" className="mt-4 gap-1" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
        </div>
      </div>
    );
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      toast({ title: "File and title required", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await api.storage.from("deal-room-docs").upload(path, file);
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error: insErr } = await api.from("deal_documents").insert({
      title: title.trim(), description: description.trim() || null, category,
      file_path: path, file_name: file.name, file_size: file.size, mime_type: file.type,
      uploaded_by: user.id,
    } as any);
    setUploading(false);
    if (insErr) {
      toast({ title: "Save failed", description: insErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document uploaded" });
    setFile(null); setTitle(""); setDescription(""); setCategory(CATEGORIES[0]);
    (document.getElementById("file-input") as HTMLInputElement).value = "";
    loadAll();
  };

  const deleteDoc = async (d: Doc) => {
    await api.storage.from("deal-room-docs").remove([d.file_path]);
    await api.from("deal_documents").delete().eq("id", d.id);
    toast({ title: "Deleted" });
    loadAll();
  };

  const decide = async (id: string, action: "approve" | "deny") => {
    const { data, error } = await api.functions.invoke("deal-room-approve", {
      body: { requestId: id, action },
    });
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
      return;
    }
    if (action === "approve") {
      toast({
        title: "Approved",
        description: data?.emailed ? "24h link emailed to buyer." : "Link generated — copy it to send manually.",
      });
    } else {
      toast({ title: "Request denied" });
    }
    loadAll();
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  };

  const docTitle = (id: string | null) => docs.find((d) => d.id === id)?.title || "General";
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead title="Deal Room Admin — SEARCH-POI v1" description="Manage SEARCH-POI v1 Deal Room documents and access requests." />
      <header className="border-b border-border/40 glass sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><Zap className="w-5 h-5 text-primary" /></div>
            <div>
              <h1 className="text-base font-bold">Deal Room Admin</h1>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="docs">
          <TabsList className="mb-6">
            <TabsTrigger value="docs" className="gap-1"><FileText className="w-4 h-4" /> Documents</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1">
              <Inbox className="w-4 h-4" /> Requests{pending > 0 && <Badge className="ml-1 h-5 px-1.5">{pending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1"><ClipboardList className="w-4 h-4" /> Logs</TabsTrigger>
          </TabsList>

          {/* DOCUMENTS */}
          <TabsContent value="docs" className="space-y-6">
            <form onSubmit={handleUpload} className="glass rounded-2xl border border-border/40 p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Upload document</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="file-input">File (PDF, DOCX, PPT, ZIP)</Label>
                  <Input id="file-input" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="t">Title</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SEARCH-POI v1 Pitch Deck" />
              </div>
              <div>
                <Label htmlFor="d">Description</Label>
                <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary buyers will see…" />
              </div>
              <Button type="submit" disabled={uploading} className="gap-1 min-h-[44px]">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </Button>
            </form>

            <div className="space-y-2">
              {docs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>}
              {docs.map((d) => (
                <div key={d.id} className="glass rounded-xl border border-border/40 p-4 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{d.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{d.category}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{d.file_name}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteDoc(d)} className="text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* REQUESTS */}
          <TabsContent value="requests" className="space-y-2">
            {requests.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} className="glass rounded-xl border border-border/40 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.buyer_name}</span>
                      <Badge
                        variant={r.status === "approved" ? "default" : r.status === "denied" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{r.buyer_email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Document: {docTitle(r.document_id)}</p>
                    {r.message && <p className="text-sm mt-1 text-foreground/80">"{r.message}"</p>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 min-h-[40px]" onClick={() => decide(r.id, "approve")}><Check className="w-4 h-4" /> Approve</Button>
                      <Button size="sm" variant="outline" className="gap-1 min-h-[40px]" onClick={() => decide(r.id, "deny")}><X className="w-4 h-4" /> Deny</Button>
                    </div>
                  )}
                </div>
                {r.status === "approved" && r.download_token && (
                  <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-lg p-2">
                    <span className="text-[11px] text-muted-foreground truncate flex-1">{r.download_token}</span>
                    <Button size="sm" variant="ghost" className="gap-1 shrink-0" onClick={() => copyLink(r.download_token!)}>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {/* LOGS */}
          <TabsContent value="logs" className="space-y-2">
            {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="glass rounded-xl border border-border/40 p-3 flex items-center gap-3 text-sm">
                {l.event_type === "request" ? <Inbox className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                <span className="capitalize font-medium">{l.event_type}</span>
                <span className="text-muted-foreground truncate">{l.buyer_email || "anonymous visitor"}</span>
                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DealRoomAdmin;
