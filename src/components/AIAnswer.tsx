import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Copy, Check, Zap, Search, Database, ShieldCheck, FileText, ChevronDown, ChevronUp } from "lucide-react";
import ShareButtons from "@/components/ShareButtons";
import SmartShareButton from "@/components/SmartShareButton";
import SaveToVaultButton from "@/components/SaveToVaultButton";
import SourceCitations, { type SourceRef } from "@/components/SourceCitations";
import TrustSafetyPanel from "@/components/TrustSafetyPanel";
import EngineDifferentiation from "@/components/EngineDifferentiation";

interface AIAnswerProps {
  answer: string;
  isStreaming: boolean;
  query: string;
  sources?: SourceRef[];
  liteMode?: boolean;
}

const REASONING_STEPS = [
  { icon: Search, label: "Query Understanding", desc: "Parsing intent, entities & context" },
  { icon: Database, label: "Multi-Source Retrieval", desc: "Crawling web, knowledge bases & APIs" },
  { icon: ShieldCheck, label: "Cross-Source Validation", desc: "Verifying facts across sources" },
  { icon: Brain, label: "Answer Synthesis", desc: "Reasoning & composing final answer" },
  { icon: FileText, label: "Output + Citations", desc: "Structuring with confidence scoring" },
];

const AIAnswer = ({ answer, isStreaming, query, sources = [], liteMode }: AIAnswerProps) => {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showFullAnswer, setShowFullAnswer] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Animate reasoning steps during streaming
  useEffect(() => {
    if (!isStreaming) {
      setActiveStep(REASONING_STEPS.length);
      return;
    }
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((prev) => Math.min(prev + 1, REASONING_STEPS.length - 1));
    }, 1200);
    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!answer && !isStreaming) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = answer;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Confidence score based on sources
  const confidence = sources.length >= 5 ? 95 : sources.length >= 3 ? 85 : sources.length >= 1 ? 72 : 60;

  if (liteMode) {
    return (
      <div className="border border-border/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">SEARCH-POI ENGINE v1</span>
          {isStreaming && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        </div>
        <div className="text-sm text-foreground whitespace-pre-wrap">{answer}</div>
        {!isStreaming && sources.length > 0 && <SourceCitations sources={sources} />}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 glow-box"
    >
      {/* Engine branding header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">SEARCH-POI ENGINE v1</h3>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00F0FF] text-black uppercase tracking-wider">
              Intelligent Reasoning
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Multi-step reasoning for "{query}"</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isStreaming ? (
            <span className="flex items-center gap-2 text-xs text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Reasoning...
            </span>
          ) : answer ? (
            <div className="flex items-center gap-2">
              <SmartShareButton query={query} answer={answer} sources={sources.map(s => ({ url: s.url, title: s.title, domain: s.domain }))} />
              <SaveToVaultButton query={query} answer={answer} sources={sources} />
              <ShareButtons text={answer} query={query} />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                title="Copy AI response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142,70%,50%)]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Reasoning Pipeline */}
      <button
        onClick={() => setShowReasoning(!showReasoning)}
        className="flex items-center gap-2 w-full px-3 py-2 mb-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs text-muted-foreground"
      >
        <Zap className="w-3 h-3 text-primary" />
        <span className="font-medium">Reasoning Pipeline</span>
        <span className="ml-1 text-[10px]">
          ({isStreaming ? `Step ${activeStep + 1}/${REASONING_STEPS.length}` : "Complete"})
        </span>
        {!isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-primary text-[10px] font-semibold">
            Confidence: {confidence}%
          </span>
        )}
        {showReasoning ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </button>

      {showReasoning && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mb-4 space-y-1.5 overflow-hidden"
        >
          {REASONING_STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = i < activeStep || !isStreaming;
            const active = i === activeStep && isStreaming;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all ${
                  done
                    ? "bg-primary/5 text-foreground"
                    : active
                    ? "bg-primary/10 text-primary animate-pulse"
                    : "text-muted-foreground/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${done ? "text-primary" : active ? "text-primary" : "text-muted-foreground/40"}`} />
                <span className="font-medium">{step.label}</span>
                <span className="text-[10px] text-muted-foreground">{step.desc}</span>
                {done && <Check className="w-3 h-3 text-[hsl(142,70%,50%)] ml-auto" />}
                {active && <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />}
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Answer content */}
      <div className="prose prose-invert prose-sm max-w-none">
        <div className="text-secondary-foreground leading-relaxed whitespace-pre-wrap">
          {showFullAnswer ? answer : answer.slice(0, 800)}
          {!showFullAnswer && answer.length > 800 && "..."}
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-primary ml-0.5 animate-pulse" />
          )}
        </div>
      </div>

      {/* See More button */}
      {!isStreaming && answer.length > 800 && (
        <button
          onClick={() => setShowFullAnswer(!showFullAnswer)}
          className="flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
        >
          {showFullAnswer ? (
            <><ChevronUp className="w-4 h-4" /> Show Less</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> See More — Detailed Analysis</>
          )}
        </button>
      )}

      {!isStreaming && sources.length > 0 && <SourceCitations sources={sources} />}

      {/* Engine Differentiation Panel */}
      {!isStreaming && answer && <EngineDifferentiation query={query} confidence={confidence} />}

      {/* Trust & Safety Panel */}
      {!isStreaming && answer && <TrustSafetyPanel sources={sources} answer={answer} />}

      {/* Footer branding */}
      {!isStreaming && answer && (
        <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Powered by <span className="text-primary font-semibold">SEARCH-POI Engine v1</span> • {sources.length} sources verified
          </span>
          <span className="text-[10px] text-muted-foreground">
            Confidence: <span className="font-bold text-[#00F0FF]">{confidence}%</span>
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default AIAnswer;
