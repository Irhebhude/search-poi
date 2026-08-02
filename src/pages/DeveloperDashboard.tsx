import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check, Trash2, Plus, Code, BarChart3, Zap, Eye, EyeOff, Play, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  credits_remaining: number;
  total_calls: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface UsageEntry {
  id: string;
  query: string;
  mode: string;
  tokens_used: number;
  created_at: string;
}

const DeveloperDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("Default");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<"keys" | "docs" | "test" | "usage">("keys");

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchKeys();
    fetchUsage();
  }, [user]);

  const fetchKeys = async () => {
    const { data } = await api.from("api_keys" as any).select("*").order("created_at", { ascending: false });
    setKeys((data as any[]) || []);
    setLoading(false);
  };

  const fetchUsage = async () => {
    const { data } = await api.from("api_usage_log" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setUsage((data as any[]) || []);
  };

  const generateKey = async () => {
    const rawKey = `poi_${crypto.randomUUID().replace(/-/g, "")}`;
    const prefix = rawKey.slice(0, 12) + "...";
    
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { error } = await api.from("api_keys" as any).insert({
      user_id: user!.id,
      key_hash: keyHash,
      key_prefix: prefix,
      name: newKeyName,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create API key", variant: "destructive" });
      return;
    }

    setRevealedKey(rawKey);
    toast({ title: "API Key Created", description: "Copy it now — you won't see it again!" });
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    await api.from("api_keys" as any).delete().eq("id", id);
    toast({ title: "Key deleted" });
    fetchKeys();
  };

  const copyKey = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const runTest = async () => {
    if (!testQuery.trim() || keys.length === 0) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await api.functions.invoke("poi-api", {
        body: { query: testQuery, mode: "default" },
        headers: { "x-api-key": "test-from-dashboard" },
      });
      setTestResult(resp.data || resp.error);
    } catch (e: any) {
      setTestResult({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const BASE_URL = `${window.location.origin}/api/poi-api`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Developer API — SEARCH-POI" description="Access the SEARCH-POI Intelligence API" path="/developer" />
      <Header />

      <main className="container mx-auto max-w-4xl px-4 pt-20 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary/10">
              <Code className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">SEARCH-POI Intelligence API</h1>
              <p className="text-sm text-muted-foreground">Build with structured AI intelligence</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border/30">
            {(["keys", "docs", "test", "usage"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "keys" ? "API Keys" : tab === "docs" ? "Documentation" : tab === "test" ? "Test API" : "Usage"}
              </button>
            ))}
          </div>

          {/* API Keys Tab */}
          {activeTab === "keys" && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Key Name</label>
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/30 text-sm text-foreground"
                    placeholder="My App"
                  />
                </div>
                <Button onClick={generateKey} className="gap-2">
                  <Plus className="w-4 h-4" /> Generate Key
                </Button>
              </div>

              {revealedKey && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 border-primary/30 border">
                  <p className="text-xs text-primary font-medium mb-2">⚠️ Copy this key now — you won't see it again!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-secondary/30 p-2 rounded font-mono text-foreground break-all">{revealedKey}</code>
                    <button onClick={() => copyKey(revealedKey, "new")} className="p-2 hover:bg-accent/20 rounded-lg transition-colors">
                      {copiedId === "new" ? <Check className="w-4 h-4 text-[hsl(142,70%,50%)]" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </motion.div>
              )}

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : keys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No API keys yet. Generate one to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div key={k.id} className="glass rounded-xl p-4 flex items-center gap-4">
                      <Key className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{k.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p>{k.credits_remaining} credits</p>
                        <p>{k.total_calls} calls</p>
                      </div>
                      <button onClick={() => deleteKey(k.id)} className="p-2 text-destructive/60 hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documentation Tab */}
          {activeTab === "docs" && (
            <div className="glass rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Quick Start</h3>
                <p className="text-sm text-muted-foreground mb-4">Make a POST request with your API key to get structured AI intelligence.</p>
                
                <div className="bg-secondary/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <p className="text-primary">POST {BASE_URL}</p>
                  <p className="text-muted-foreground mt-2">Headers:</p>
                  <p className="text-foreground ml-2">Content-Type: application/json</p>
                  <p className="text-foreground ml-2">x-api-key: poi_your_key_here</p>
                  <p className="text-muted-foreground mt-2">Body:</p>
                  <pre className="text-foreground ml-2">{JSON.stringify({ query: "Best business ideas in Lagos 2024", mode: "business" }, null, 2)}</pre>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Available Modes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { mode: "default", desc: "General intelligence" },
                    { mode: "business", desc: "Market & business analysis" },
                    { mode: "deep_research", desc: "Academic-level research" },
                    { mode: "code", desc: "Code intelligence" },
                    { mode: "academic", desc: "Scientific research" },
                  ].map((m) => (
                    <div key={m.mode} className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                      <code className="text-xs text-primary">{m.mode}</code>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Response Format</h3>
                <pre className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">{JSON.stringify({
                  success: true,
                  data: {
                    answer: "Direct answer...",
                    key_insights: ["Insight 1", "Insight 2"],
                    recommendations: ["Action 1", "Action 2"],
                    confidence_level: 85,
                    sources_used: ["AI reasoning", "Knowledge base"],
                    mode: "business",
                  },
                  meta: { credits_remaining: 99, powered_by: "SEARCH-POI Engine v1" },
                }, null, 2)}</pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Code Examples</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">JavaScript / Node.js</p>
                    <pre className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">{`const response = await fetch("${BASE_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "poi_your_key_here"
  },
  body: JSON.stringify({
    query: "Market analysis for fintech in Nigeria",
    mode: "business"
  })
});
const data = await response.json();
console.log(data.data.answer);`}</pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Python</p>
                    <pre className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">{`import requests

response = requests.post(
    "${BASE_URL}",
    headers={"x-api-key": "poi_your_key_here"},
    json={"query": "Best investment opportunities", "mode": "business"}
)
print(response.json()["data"]["answer"])`}</pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">cURL</p>
                    <pre className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto">{`curl -X POST "${BASE_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: poi_your_key_here" \\
  -d '{"query": "Top startups in Africa", "mode": "default"}'`}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test API Tab */}
          {activeTab === "test" && (
            <div className="glass rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Test the API</h3>
              <div className="flex gap-2">
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Enter a test query..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/30 text-sm text-foreground"
                  onKeyDown={(e) => e.key === "Enter" && runTest()}
                />
                <Button onClick={runTest} disabled={testing || !testQuery.trim()} className="gap-2">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run
                </Button>
              </div>
              {testResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <pre className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-foreground overflow-x-auto max-h-96">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </motion.div>
              )}
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === "usage" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-4 text-center">
                  <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{keys.reduce((s, k) => s + k.total_calls, 0)}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{keys.reduce((s, k) => s + k.credits_remaining, 0)}</p>
                  <p className="text-xs text-muted-foreground">Credits Left</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <Key className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{keys.length}</p>
                  <p className="text-xs text-muted-foreground">Active Keys</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent API Calls</h3>
              {usage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No API calls yet</p>
              ) : (
                <div className="space-y-1">
                  {usage.map((u) => (
                    <div key={u.id} className="glass rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{u.query}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleString()} • {u.mode}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{u.tokens_used} tokens</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <div className="text-center mt-12 text-xs text-muted-foreground">
          Powered by <span className="text-primary font-semibold">SEARCH-POI Engine v1</span>
        </div>
      </main>
    </div>
  );
};

export default DeveloperDashboard;
