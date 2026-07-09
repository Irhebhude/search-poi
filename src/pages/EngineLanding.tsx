import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  MapPin,
  Globe2,
  Zap,
  Shield,
  ArrowRight,
  Search,
  Gauge,
  AlertTriangle,
  BadgeCheck,
  FileText,
  Phone,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";
import SEOHead from "@/components/SEOHead";

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice Commands — "Hey POI"',
    description:
      'Talk to your search engine. Wake it with "Hey POI" and search with your voice. Fully hands-free.',
  },
  {
    icon: MapPin,
    title: "Auto Welcome on Arrival",
    description:
      "Detects when a user arrives in a new Country, State, City, or Place. Instantly welcomes them and shows local Points of Interest — businesses, cash points, and traffic data in real-time.",
  },
  {
    icon: Globe2,
    title: "Own a Private Google",
    description:
      "You own the technology, the code, and the intelligence. Processes data in 45ms. Built on Cloudflare so it needs almost no server costs and stays fast and secure globally.",
  },
];

const ACQ_FEATURES = [
  { icon: Zap, title: "Instant Search", desc: "45ms results, powered by Cloudflare Workers." },
  { icon: AlertTriangle, title: "Risk Score", desc: "Flags unsafe or fraudulent results automatically." },
  { icon: Gauge, title: "Authority Score", desc: "Shows trust and popularity of every result." },
  { icon: FileText, title: "Blueprint", desc: "Explains what each result is in plain language." },
  { icon: Mic, title: 'Voice Command "Hey POI"', desc: "Hands-free voice search wake word." },
  { icon: MapPin, title: "Auto Geo Welcome", desc: "Welcomes users on arrival to a new location." },
  { icon: Globe2, title: "Real-time POI Data", desc: "Businesses, traffic, and cash points, live." },
];

const WHY = [
  { title: "Product Complete", desc: "Launch under your brand tomorrow." },
  { title: "Full IP Transfer", desc: "100% source code + documentation + rights." },
  { title: "Low Operating Cost", desc: "Runs on Cloudflare for less than $20/month." },
  { title: "Strategic Asset", desc: "Own the tech instead of renting from Google." },
];

const DEMO_URL = "https://search-poi.pages.dev/";

// Web Speech API support (Chrome, Edge, Safari)
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

const EngineLanding = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState<string>("");
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const voiceSupported = !!SpeechRecognition;

  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Africa/Lagos",
        }).format(new Date()) + " WAT"
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const runSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Auto Welcome on Arrival — IP geolocation, only re-run on new location
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled || !d?.city) return;
        const city = d.city as string;
        const state = (d.region as string) || "";
        const country = (d.country_name as string) || "";
        const key = `${country}|${state}|${city}`.toLowerCase();
        setWelcome(
          `Welcome to ${[city, state, country].filter(Boolean).join(", ")}! Here are POIs near you.`
        );
        const last = localStorage.getItem("poi_last_location");
        if (last !== key) {
          localStorage.setItem("poi_last_location", key);
          // Auto-run search only when the location is new
          navigate(`/search?q=${encodeURIComponent(`POIs in ${city}`)}`);
        }
      } catch {
        // Location failed — hide banner, do nothing, no errors shown
        if (!cancelled) setWelcome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const startListening = () => {
    if (!voiceSupported) return;
    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-NG";
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 3;

      rec.onresult = (e: any) => {
        let transcript: string = e.results[0][0].transcript || "";
        // Remove "Hey POI" wake word before searching
        transcript = transcript.replace(/\bhey\s+poi\b[,\s]*/gi, "").trim();
        setListening(false);
        setQuery(transcript);
        runSearch(transcript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="SEARCH-POI Engine v1 — Own The Future of Local Search"
        description="An AI-powered search engine for Points of Interest. 45ms results, risk & authority scoring, voice commands. Full IP for acquisition — $55,000 one-time."
        path="/engine"
        keywords={[
          "SEARCH-POI Engine",
          "private search engine",
          "voice search",
          "risk intelligence",
          "points of interest",
          "Cloudflare search",
          "acquisition",
          "POI Foundation",
        ]}
      />

      {/* AUTO WELCOME BANNER */}
      {welcome && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-b border-primary/20 text-sm text-foreground text-center"
        >
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span>{welcome}</span>
          <button
            onClick={() => setWelcome(null)}
            aria-label="Dismiss welcome"
            className="ml-1 p-1 rounded-md hover:bg-foreground/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-accent/10 to-background" />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative z-10 container mx-auto max-w-4xl px-4 pt-20 pb-16 sm:pt-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-primary font-medium mb-6"
          >
            <Shield className="w-3 h-3" />
            Independent · Owned by POI Foundation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-4"
          >
            <span className="text-foreground">SEARCH</span>
            <span className="gradient-text">-POI</span>
            <span className="block text-2xl sm:text-3xl md:text-4xl mt-2 text-muted-foreground font-semibold">
              ENGINE v1
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-lg sm:text-2xl gradient-text font-semibold mb-3"
          >
            Own The Future of Local Search.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            An AI-powered search engine for Points of Interest that processes data in{" "}
            <span className="text-primary font-semibold tabular-nums">45ms</span>.
          </motion.p>

          {/* SEARCH BAR WITH VOICE */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="max-w-2xl mx-auto"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(query);
              }}
              className="glass rounded-2xl flex items-center gap-2 px-4 py-2.5 glow-border"
            >
              <Search className="w-5 h-5 text-primary shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search POIs, businesses, cash points…"
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-base"
              />
              {voiceSupported ? (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? "Stop listening" : "Voice search"}
                  className={`p-2.5 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    listening
                      ? "bg-destructive/15 text-destructive animate-pulse"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              ) : (
                <span
                  title="Voice not supported in this browser"
                  className="p-2.5 rounded-xl text-muted-foreground/50 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-not-allowed"
                >
                  <MicOff className="w-5 h-5" />
                </span>
              )}
              <button
                type="submit"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-4 h-4" />
                Search
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              {voiceSupported
                ? 'Tap mic and say "Hey POI". Voice works best in Chrome, Edge, Safari.'
                : "Voice not supported in this browser — type your search above."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-8"
          >
            <a
              href="#acquisition"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors min-h-[48px] glow-border"
            >
              <Zap className="w-4 h-4" />
              View Acquisition Offer
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* KEY FEATURES */}
      <section className="container mx-auto max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="glass rounded-2xl p-6 hover:glow-border transition-all duration-300"
            >
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="live-demo" className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Live Demo</h2>
          <p className="text-muted-foreground">
            Try: <span className="text-primary font-medium">"Hey POI, find hospitals near me"</span>
          </p>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-border">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="w-3 h-3 rounded-full bg-destructive/70" />
            <span className="w-3 h-3 rounded-full bg-accent" />
            <span className="w-3 h-3 rounded-full bg-primary/70" />
            <span className="ml-2 text-xs text-muted-foreground truncate">{DEMO_URL}</span>
          </div>
          <iframe
            src={DEMO_URL}
            title="SEARCH-POI Engine v1 Live Demo"
            className="w-full h-[520px] sm:h-[640px] bg-background"
            loading="lazy"
          />
        </div>
      </section>

      {/* ACQUISITION */}
      <section
        id="acquisition"
        className="relative overflow-hidden border-y border-border/40 py-16 sm:py-24"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-background" />
        <div className="relative z-10 container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-primary mb-4">
              <BadgeCheck className="w-4 h-4" />
              Ready to Deploy
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-3">For Acquisition</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sell the entire product and IP in one transaction. Own search infrastructure in
              Africa and beyond.
            </p>
          </div>

          {/* Acquisition feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {ACQ_FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 * i }}
                className="glass rounded-xl p-5 flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Who this is for */}
          <div className="glass rounded-2xl p-6 mb-8 text-center">
            <h3 className="font-semibold text-foreground mb-2">Who This Is For</h3>
            <p className="text-sm text-muted-foreground">
              Fintechs · Crypto platforms · Media companies · Investors · Entrepreneurs who want to
              own search infrastructure.
            </p>
          </div>

          {/* Why acquire now */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {WHY.map((w) => (
              <div key={w.title} className="glass rounded-xl p-5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{w.title}</h4>
                  <p className="text-xs text-muted-foreground">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Price card */}
          <div className="glass rounded-2xl p-8 text-center glow-border max-w-xl mx-auto">
            <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
              Acquisition Price
            </p>
            <p className="text-5xl sm:text-6xl font-bold gradient-text mb-1">$55,000</p>
            <p className="text-sm text-muted-foreground mb-6">One-time payment</p>
            <p className="text-sm text-foreground/90 mb-8">
              Includes full source code, deployment, 30 days support, and full IP transfer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://calendly.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors min-h-[48px]"
              >
                <Phone className="w-4 h-4" />
                Book 10min Call with Founder
              </a>
              <a
                href="mailto:prosperirhebhude65@gmail.com?subject=SEARCH-POI%20Engine%20v1%20—%20Demo%20%2B%20Documentation"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold hover:bg-primary/20 transition-colors min-h-[48px]"
              >
                <FileText className="w-4 h-4" />
                Request Full Demo + Documentation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p className="tabular-nums text-primary/90 mb-2">Last update: {now} | Online</p>
        <p className="mb-1 text-foreground/80 font-medium">
          Built by Prosper Ozoya Irhebhude | Founder, POI FOUNDATION LTD
        </p>
        <p>
          © {new Date().getFullYear()} POI Foundation · SEARCH-POI Engine v1 ·{" "}
          <Link to="/" className="text-primary hover:underline">
            Home
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default EngineLanding;
