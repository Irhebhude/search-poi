import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hammer, X, Loader2, ChevronLeft, ChevronRight, Play, Pause,
  Clock, Wrench, Package, AlertTriangle, Lightbulb, Video,
  ExternalLink, Sparkles, RotateCcw, Download, Share2, Copy, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const GUIDE_URL = `${BASE}/api/fn/generate-build-guide`;

interface Material {
  name: string;
  quantity: string;
  notes?: string;
}

interface BuildStep {
  stepNumber: number;
  title: string;
  instruction: string;
  tip?: string;
  warning?: string;
  imageUrl?: string;
  isLoadingImage?: boolean;
}

interface BuildGuide {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  materials: Material[];
  tools: string[];
  steps: BuildStep[];
  safetyNotes: string[];
}

interface RelatedVideo {
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  videoId: string;
  platform: string;
}

interface BuildGuideViewerProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const EXAMPLES = [
  "USB-powered LED desk lamp",
  "Arduino temperature monitor",
  "Portable Bluetooth speaker",
  "Phone stand from wood",
  "Solar phone charger",
  "Custom earphone cable",
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "text-green-400 bg-green-400/10",
  Intermediate: "text-yellow-400 bg-yellow-400/10",
  Advanced: "text-orange-400 bg-orange-400/10",
  Expert: "text-red-400 bg-red-400/10",
};

const BuildGuideViewer = ({ isOpen, onClose, initialQuery = "" }: BuildGuideViewerProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [guide, setGuide] = useState<BuildGuide | null>(null);
  const [videos, setVideos] = useState<RelatedVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<"slideshow" | "materials" | "videos">("slideshow");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Auto-advance slideshow
  useEffect(() => {
    if (isPlaying && guide && currentStep < guide.steps.length - 1) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= (guide?.steps.length ?? 1) - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 6000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, guide, currentStep]);

  const generateGuide = useCallback(async () => {
    if (!query.trim()) return;
    setIsGenerating(true);
    setGuide(null);
    setVideos([]);
    setCurrentStep(0);
    setIsPlaying(false);
    setView("slideshow");

    // Fetch structured guide + videos in parallel
    const guidePromise = fetch(GUIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ query: query.trim(), action: "structured" }),
    });

    const videosPromise = fetch(GUIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ query: query.trim() }),
    });

    try {
      const [guideResp, videosResp] = await Promise.allSettled([guidePromise, videosPromise]);

      if (guideResp.status === "fulfilled" && guideResp.value.ok) {
        const data = await guideResp.value.json();
        if (data.guide) {
          setGuide(data.guide);
          // Generate images for first 3 steps
          generateStepImages(data.guide, [0, 1, 2]);
        } else {
          toast({ title: "Error", description: "Failed to generate build guide", variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "Failed to generate build guide", variant: "destructive" });
      }

      if (videosResp.status === "fulfilled" && videosResp.value.ok) {
        const vData = await videosResp.value.json();
        setVideos(vData.videos || []);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [query, toast]);

  const generateStepImages = async (g: BuildGuide, indices: number[]) => {
    for (const idx of indices) {
      if (idx >= g.steps.length) continue;
      const step = g.steps[idx];
      if (step.imageUrl) continue;

      setGuide((prev) => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        steps[idx] = { ...steps[idx], isLoadingImage: true };
        return { ...prev, steps };
      });

      try {
        const resp = await fetch(GUIDE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({
            query: `${g.title} - Step ${step.stepNumber}: ${step.title}. ${step.instruction}`,
            action: "step_image",
            stepDescription: step.instruction,
            stepNumber: step.stepNumber,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.imageUrl) {
            setGuide((prev) => {
              if (!prev) return prev;
              const steps = [...prev.steps];
              steps[idx] = { ...steps[idx], imageUrl: data.imageUrl, isLoadingImage: false };
              return { ...prev, steps };
            });
            continue;
          }
        }
      } catch {
        // Image is optional
      }

      setGuide((prev) => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        steps[idx] = { ...steps[idx], isLoadingImage: false };
        return { ...prev, steps };
      });
    }
  };

  // Preload next step images as user navigates
  useEffect(() => {
    if (guide && currentStep < guide.steps.length - 1) {
      const nextIdx = currentStep + 1;
      if (!guide.steps[nextIdx]?.imageUrl && !guide.steps[nextIdx]?.isLoadingImage) {
        generateStepImages(guide, [nextIdx]);
      }
    }
  }, [currentStep, guide]);

  const goToStep = (dir: number) => {
    if (!guide) return;
    const next = currentStep + dir;
    if (next >= 0 && next < guide.steps.length) {
      setCurrentStep(next);
    }
  };

  if (!isOpen) return null;

  const step = guide?.steps[currentStep];
  const progress = guide ? ((currentStep + 1) / guide.steps.length) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-start justify-center pt-4 px-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          className="w-full max-w-5xl glass rounded-2xl border border-border/30 mb-8 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Hammer className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Build Guide Generator</h2>
                <p className="text-xs text-muted-foreground">AI step-by-step video instructions for gadgets & accessories</p>
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
                onKeyDown={(e) => e.key === "Enter" && generateGuide()}
                placeholder="What gadget or accessory do you want to build?"
                className="flex-1 bg-accent/10 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={generateGuide}
                disabled={isGenerating || !query.trim()}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </button>
            </div>

            {!guide && !isGenerating && (
              <div className="flex flex-wrap gap-2 mt-3">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setQuery(ex)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loading state */}
          {isGenerating && (
            <div className="p-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your build guide with AI...</p>
            </div>
          )}

          {/* Guide content */}
          {guide && (
            <>
              {/* Guide header info */}
              <div className="p-4 border-b border-border/30 flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-bold text-foreground flex-1">{guide.title}</h3>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${DIFFICULTY_COLORS[guide.difficulty] || "text-muted-foreground bg-accent/10"}`}>
                  {guide.difficulty}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {guide.estimatedTime}
                </span>
                <BuildGuideActions guide={guide} />
              </div>

              {/* View tabs */}
              <div className="flex border-b border-border/30">
                {[
                  { id: "slideshow" as const, label: "Step-by-Step", icon: Play },
                  { id: "materials" as const, label: "Materials & Tools", icon: Package },
                  { id: "videos" as const, label: `Tutorials (${videos.length})`, icon: Video },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = view === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setView(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Slideshow view */}
              {view === "slideshow" && step && (
                <div className="p-0">
                  {/* Progress bar */}
                  <div className="h-1 bg-accent/20">
                    <motion.div
                      className="h-full bg-primary"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    {/* Image / Visual area */}
                    <div className="relative aspect-video bg-card flex items-center justify-center border-r border-border/30">
                      <AnimatePresence mode="wait">
                        {step.isLoadingImage ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                            <span className="text-xs text-muted-foreground">Generating visual...</span>
                          </motion.div>
                        ) : step.imageUrl ? (
                          <motion.img
                            key={`img-${currentStep}`}
                            src={step.imageUrl}
                            alt={step.title}
                            initial={{ opacity: 0, scale: 1.02 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 p-8 text-center">
                            <Hammer className="w-12 h-12 text-primary/20" />
                            <p className="text-sm text-muted-foreground">Step {step.stepNumber} visual</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Step counter overlay */}
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
                        Step {currentStep + 1} / {guide.steps.length}
                      </div>
                    </div>

                    {/* Instruction area */}
                    <div className="p-6 flex flex-col justify-between min-h-[300px]">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentStep}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                        >
                          <h4 className="text-lg font-bold text-foreground mb-3">
                            {step.title}
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            {step.instruction}
                          </p>

                          {step.tip && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 mb-3">
                              <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                              <p className="text-xs text-primary/80">{step.tip}</p>
                            </div>
                          )}

                          {step.warning && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                              <p className="text-xs text-destructive/80">{step.warning}</p>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>

                      {/* Controls */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                        <button
                          onClick={() => goToStep(-1)}
                          disabled={currentStep === 0}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
                            className="p-2 rounded-lg hover:bg-accent/20 transition-colors text-muted-foreground"
                            title="Restart"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            title={isPlaying ? "Pause" : "Auto-play"}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        </div>

                        <button
                          onClick={() => goToStep(1)}
                          disabled={currentStep >= guide.steps.length - 1}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 disabled:opacity-30 transition-colors"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step thumbnails */}
                  <div className="flex gap-1 p-3 border-t border-border/30 overflow-x-auto scrollbar-none">
                    {guide.steps.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentStep(i); setIsPlaying(false); }}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          i === currentStep
                            ? "bg-primary/15 text-primary"
                            : i < currentStep
                            ? "bg-accent/10 text-muted-foreground"
                            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/10"
                        }`}
                      >
                        {s.stepNumber}. {s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials view */}
              {view === "materials" && (
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">{guide.description}</p>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                      <Package className="w-4 h-4 text-primary" /> Materials
                    </h4>
                    <div className="grid gap-2">
                      {guide.materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-border/20">
                          <div>
                            <span className="text-sm font-medium text-foreground">{m.name}</span>
                            {m.notes && <span className="text-xs text-muted-foreground ml-2">({m.notes})</span>}
                          </div>
                          <span className="text-xs text-primary font-mono">{m.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                      <Wrench className="w-4 h-4 text-primary" /> Tools Required
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {guide.tools.map((t, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg bg-accent/10 text-xs text-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {guide.safetyNotes.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                        <AlertTriangle className="w-4 h-4 text-destructive" /> Safety Notes
                      </h4>
                      <ul className="space-y-2">
                        {guide.safetyNotes.map((n, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-destructive mt-0.5">⚠</span> {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Videos view */}
              {view === "videos" && (
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {videos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No related tutorial videos found.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {videos.map((v, i) => (
                        <a
                          key={i}
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group glass rounded-xl overflow-hidden border border-border/30 hover:border-primary/40 transition-all"
                        >
                          <div className="relative aspect-video">
                            <img
                              src={v.thumbnail}
                              alt={v.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-3 rounded-full bg-primary/90 text-primary-foreground">
                                <Play className="w-6 h-6" />
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-[10px] font-medium text-foreground">
                              YouTube
                            </div>
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                              {v.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              Watch on YouTube
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// PDF Export & Share Actions Component
const BuildGuideActions = ({ guide }: { guide: BuildGuide }) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportPDF = async () => {
    setExporting(true);
    try {
      // Build a simple text-based PDF using a printable HTML approach
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({ title: "Blocked", description: "Please allow popups to export PDF", variant: "destructive" });
        setExporting(false);
        return;
      }

      const stepsHtml = guide.steps.map((s) => `
        <div style="page-break-inside: avoid; margin-bottom: 24px; border: 1px solid #ddd; border-radius: 8px; padding: 16px;">
          <h3 style="color: #333; margin: 0 0 8px;">Step ${s.stepNumber}: ${s.title}</h3>
          ${s.imageUrl ? `<img src="${s.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px;" crossorigin="anonymous" />` : ""}
          <p style="color: #555; line-height: 1.6;">${s.instruction}</p>
          ${s.tip ? `<p style="color: #0a84ff; font-size: 13px; margin-top: 8px;">💡 Tip: ${s.tip}</p>` : ""}
          ${s.warning ? `<p style="color: #ff3b30; font-size: 13px; margin-top: 8px;">⚠️ Warning: ${s.warning}</p>` : ""}
        </div>
      `).join("");

      const materialsHtml = guide.materials.map((m) =>
        `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #eee;">${m.name}</td><td style="padding: 6px 12px; border-bottom: 1px solid #eee;">${m.quantity}</td><td style="padding: 6px 12px; border-bottom: 1px solid #eee; color: #888;">${m.notes || "—"}</td></tr>`
      ).join("");

      const toolsHtml = guide.tools.map((t) =>
        `<span style="display: inline-block; background: #f0f0f0; padding: 4px 10px; border-radius: 6px; margin: 3px; font-size: 13px;">${t}</span>`
      ).join("");

      printWindow.document.write(`<!DOCTYPE html><html><head><title>${guide.title} - Build Guide</title><style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #111; border-bottom: 2px solid #0a84ff; padding-bottom: 8px; }
        h2 { color: #222; margin-top: 32px; }
        @media print { body { padding: 0; } }
      </style></head><body>
        <h1>${guide.title}</h1>
        <p style="color: #666;">${guide.description}</p>
        <p><strong>Difficulty:</strong> ${guide.difficulty} | <strong>Time:</strong> ${guide.estimatedTime}</p>
        
        <h2>📦 Materials</h2>
        <table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #f8f8f8;"><th style="text-align: left; padding: 8px 12px;">Material</th><th style="text-align: left; padding: 8px 12px;">Quantity</th><th style="text-align: left; padding: 8px 12px;">Notes</th></tr></thead><tbody>${materialsHtml}</tbody></table>
        
        <h2>🔧 Tools</h2>
        <div>${toolsHtml}</div>
        
        <h2>📋 Steps</h2>
        ${stepsHtml}
        
        ${guide.safetyNotes.length > 0 ? `<h2>⚠️ Safety Notes</h2><ul>${guide.safetyNotes.map((n) => `<li style="color: #ff3b30; margin-bottom: 4px;">${n}</li>`).join("")}</ul>` : ""}
        
        <p style="text-align: center; color: #999; margin-top: 40px; font-size: 12px;">Generated by SEARCH-POI Build Guide Generator</p>
      </body></html>`);

      printWindow.document.close();
      // Wait for images to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 1500);

      toast({ title: "PDF Ready", description: "Use your browser's print dialog to save as PDF" });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  };

  const shareGuide = async () => {
    const shareText = `🔧 Build Guide: ${guide.title}\n\n${guide.description}\n\nMaterials: ${guide.materials.map((m) => m.name).join(", ")}\n\n${guide.steps.length} steps | ${guide.difficulty} | ${guide.estimatedTime}\n\nGenerated with SEARCH-POI`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Build Guide: ${guide.title}`,
          text: shareText,
          url: window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast({ title: "Copied!", description: "Build guide summary copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportPDF}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-xs font-medium text-foreground hover:bg-accent/20 transition-colors disabled:opacity-50"
        title="Export as PDF"
      >
        <Download className={`w-3.5 h-3.5 ${exporting ? "animate-bounce" : ""}`} />
        PDF
      </button>
      <button
        onClick={shareGuide}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-xs font-medium text-foreground hover:bg-accent/20 transition-colors"
        title="Share build guide"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
        Share
      </button>
    </div>
  );
};

export default BuildGuideViewer;
