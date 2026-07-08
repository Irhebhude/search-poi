import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, MapPin, Globe2, Zap, Shield, ArrowRight } from "lucide-react";
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

const DEMO_URL = "https://search-poi.pages.dev/";

const EngineLanding = () => {
  const [now, setNow] = useState<string>("");

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="SEARCH-POI Engine v1 — Your Private Google With Risk Intelligence"
        description="A fully functional AI search engine that processes data in 45ms. Voice commands, auto-arrival welcome, and real-time Points of Interest. Own your private Google."
        path="/engine"
        keywords={[
          "SEARCH-POI Engine",
          "private search engine",
          "voice search",
          "risk intelligence",
          "points of interest",
          "Cloudflare search",
          "POI Foundation",
        ]}
      />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-background to-background" />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative z-10 container mx-auto max-w-4xl px-4 pt-24 pb-20 sm:pt-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-primary font-medium mb-6"
          >
            <Shield className="w-3 h-3" />
            POI Foundation
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
            Your Private Google. With Risk Intelligence.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            A fully functional search engine that processes data in{" "}
            <span className="text-primary font-semibold tabular-nums">45ms</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <a
              href="#live-demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors min-h-[48px] glow-border"
            >
              <Zap className="w-4 h-4" />
              Try Live Demo
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

        <div className="text-center mt-6">
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold hover:bg-primary/20 transition-colors min-h-[48px]"
          >
            Open Full Demo
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p className="tabular-nums text-primary/90 mb-2">Last update: {now} | Online</p>
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
