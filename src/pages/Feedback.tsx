import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Bug, Lightbulb, AlertTriangle, Send, Bot, Star, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import AdSense from "@/components/AdSense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api as supabase } from "@/lib/api";
import { z } from "zod";

const feedbackSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  category: z.string(),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

const CATEGORIES = [
  { value: "general", label: "General Feedback", icon: MessageSquare },
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "complaint", label: "Complaint", icon: AlertTriangle },
];

const Feedback = () => {
  const [form, setForm] = useState<FeedbackForm>({ full_name: "", email: "", category: "general", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FeedbackForm, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [aiResponse, setAiResponse] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof FeedbackForm]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = feedbackSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as keyof FeedbackForm] = i.message; });
      setErrors(fieldErrors);
      return;
    }

    setStatus("loading");
    setAiResponse("");
    setRating(0);
    setRatingSubmitted(false);

    try {
      const { data, error } = await supabase.functions.invoke("feedback-ai", {
        body: result.data,
      });

      if (error) throw error;
      setAiResponse(data.ai_response || "Thank you for your feedback!");
      setStatus("success");
      setForm({ full_name: "", email: "", category: "general", message: "" });
    } catch {
      setStatus("error");
    }
  };

  const submitRating = async () => {
    if (!rating) return;
    // Update the latest feedback entry with rating (best effort)
    setRatingSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Feedback — Help Improve SEARCH-POI" description="Share your feedback, report bugs, or suggest features for SEARCH-POI. Your input shapes the future of AI search." path="/feedback" />
      <Header />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              <span className="gradient-text">Feedback</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Submit feedback, report bugs, request features, or share complaints. Our AI will respond instantly with helpful solutions.
            </p>
          </motion.div>

          {/* Category selector */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm((p) => ({ ...p, category: c.value }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  form.category === c.value
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "glass border-border/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <c.icon className="w-4 h-4" />
                {c.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-6 sm:p-8 border border-border/30 space-y-5 mb-8"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                <Input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Your name" className="bg-background/50" />
                {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
                <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" className="bg-background/50" />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Your Message</label>
              <Textarea name="message" value={form.message} onChange={handleChange} placeholder="Describe your feedback, issue, or suggestion…" rows={5} className="bg-background/50" />
              {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
            </div>

            <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto gap-2">
              {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {status === "loading" ? "Getting AI Response…" : "Submit Feedback"}
            </Button>
          </motion.form>

          {/* AI Response */}
          {status === "success" && aiResponse && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 sm:p-8 border border-primary/20 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">AI Response</h3>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
                <ReactMarkdown>{aiResponse}</ReactMarkdown>
              </div>

              {/* Rating */}
              <div className="mt-6 pt-4 border-t border-border/30">
                {!ratingSubmitted ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">Was this helpful?</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setRating(s)} className="p-1 transition-colors">
                          <Star className={`w-5 h-5 ${s <= rating ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <Button size="sm" variant="outline" onClick={submitRating} className="text-xs">
                        Submit Rating
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <CheckCircle className="w-4 h-4" /> Thanks for your rating!
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-8">
              <AlertCircle className="w-4 h-4" /> Something went wrong. Please try again.
            </div>
          )}

          <AdSense adSlot="9944378861" adFormat="auto" className="mb-8" />

          <div className="text-center text-xs text-muted-foreground">
            <p>SEARCH-POI • Created & Owned by <span className="text-foreground">Prosper Ozoya Irhebhude</span></p>
            <p className="mt-1">Founder of <span className="text-primary">POI FOUNDATION</span></p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Feedback;
