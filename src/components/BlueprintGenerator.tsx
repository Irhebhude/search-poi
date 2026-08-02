import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Download, Image, FileText, Loader2, X, Search, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const BLUEPRINT_URL = `${BASE}/api/fn/generate-blueprint`;

interface BlueprintGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const EXAMPLES = [
  "Next-gen smartphone with holographic display",
  "Arduino-based home automation system",
  "DIY solar-powered battery bank",
  "Raspberry Pi security camera system",
  "Custom mechanical keyboard with RGB",
  "Drone with GPS navigation system",
];

const BlueprintGenerator = ({ isOpen, onClose, initialQuery = "" }: BlueprintGeneratorProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [blueprintText, setBlueprintText] = useState("");
  const [blueprintImage, setBlueprintImage] = useState<string | null>(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  const generateBlueprint = async () => {
    if (!query.trim()) return;
    setBlueprintText("");
    setBlueprintImage(null);
    setIsGeneratingText(true);
    setIsGeneratingImage(true);

    // Stream text blueprint
    (async () => {
      try {
        const resp = await fetch(BLUEPRINT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ query: query.trim(), type: "text" }),
        });
        if (!resp.ok || !resp.body) throw new Error("Failed");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const p = JSON.parse(json);
              const c = p.choices?.[0]?.delta?.content;
              if (c) { acc += c; setBlueprintText(acc); }
            } catch {}
          }
        }
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setIsGeneratingText(false);
      }
    })();

    // Generate image
    (async () => {
      try {
        const resp = await fetch(BLUEPRINT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ query: query.trim(), type: "image" }),
        });
        if (!resp.ok) throw new Error("Image generation failed");
        const data = await resp.json();
        if (data.imageUrl) setBlueprintImage(data.imageUrl);
      } catch {
        // Image is optional, don't block on failure
      } finally {
        setIsGeneratingImage(false);
      }
    })();
  };

  const downloadImage = () => {
    if (!blueprintImage) return;
    const a = document.createElement("a");
    a.href = blueprintImage;
    a.download = `blueprint-${query.slice(0, 30).replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const downloadText = () => {
    if (!blueprintText) return;
    const blob = new Blob([blueprintText], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `blueprint-${query.slice(0, 30).replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 px-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          className="w-full max-w-4xl glass rounded-2xl border border-border/30 mb-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Blueprint Generator</h2>
                <p className="text-xs text-muted-foreground">AI-powered technical schematics & build instructions</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent/20 transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateBlueprint()}
                placeholder="Describe the device or system to generate a blueprint for..."
                className="flex-1 bg-accent/10 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={generateBlueprint}
                disabled={isGeneratingText || !query.trim()}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isGeneratingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </button>
            </div>

            {/* Example queries */}
            {!blueprintText && !isGeneratingText && (
              <div className="flex flex-wrap gap-2 mt-3">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setQuery(ex); }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {(blueprintText || isGeneratingText || blueprintImage || isGeneratingImage) && (
            <div ref={contentRef} className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Download buttons */}
              {(blueprintText || blueprintImage) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {blueprintText && (
                    <button onClick={downloadText} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-sm text-foreground transition-colors">
                      <FileText className="w-4 h-4" /> Download Instructions (.md)
                    </button>
                  )}
                  {blueprintImage && (
                    <button onClick={downloadImage} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-sm text-foreground transition-colors">
                      <Image className="w-4 h-4" /> Download Blueprint Image (.png)
                    </button>
                  )}
                </div>
              )}

              {/* Blueprint image */}
              {isGeneratingImage && !blueprintImage && (
                <div className="flex items-center gap-3 p-6 glass rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating blueprint schematic...</span>
                </div>
              )}
              {blueprintImage && (
                <div className="rounded-xl overflow-hidden border border-border/30">
                  <img src={blueprintImage} alt="Blueprint schematic" className="w-full" />
                </div>
              )}

              {/* Blueprint text */}
              {(blueprintText || isGeneratingText) && (
                <div className="glass rounded-xl p-6">
                  {isGeneratingText && !blueprintText && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Generating build instructions...</span>
                    </div>
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{blueprintText}</ReactMarkdown>
                  </div>
                  {isGeneratingText && blueprintText && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BlueprintGenerator;
