import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Zap, Globe, Shield, Cpu, Layers, MapPin, Crown, Building2, TrendingUp, BarChart3, LineChart, Search, Mic, Wallet, Fuel, TrafficCone, Rocket, Lock } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import FeatureCard from "@/components/FeatureCard";
import Header from "@/components/Header";
import LiveTopBar from "@/components/LiveTopBar";
import HomeQuickActions from "@/components/HomeQuickActions";
import FloatingMenu from "@/components/FloatingMenu";
import { usePoiLive } from "@/hooks/usePoiLive";
import FintechDashboard from "@/components/FintechDashboard";
import TrendingTopics from "@/components/TrendingTopics";
import LiveActivityFeed from "@/components/LiveActivityFeed";

const Index = () => {
  const navigate = useNavigate();
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const live = usePoiLive();

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <Header />
      <LiveTopBar live={live} />
      <FloatingMenu onNearMe={() => setShowLocationSearch(true)} />

      <main className="relative z-10 pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* HERO */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-3">
              <span className="text-white">SEARCH</span><span className="text-cyan-400">-POI</span>
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-bold mb-4">
              <Zap className="w-3 h-3" /> POWERED BY SEARCH-POI ENGINE V1
            </div>
            <p className="text-2xl md:text-3xl font-semibold">Don't search. <span className="text-cyan-400">Ask.</span></p>

            {/* SEARCH BAR */}
            <div className="relative mt-8 max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Mic className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <SearchBar onSearch={handleSearch} />
            </div>

            {/* 4 CARDS */}
            <div className="grid grid-cols-2 gap-3 mt-8">
              {[{icon: Wallet, label: "POS Cash", color: "text-yellow-400"}, {icon: Fuel, label: "Fuel Price", color: "text-green-400"}, {icon: TrafficCone, label: "Traffic", color: "text-orange-400"}, {icon: Shield, label: "Danger", color: "text-red-400"}].map(({icon: Icon, label, color}) => (
                <button key={label} className="flex items-center gap-3 p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] hover:border-cyan-500/50">
                  <Icon className={`w-6 h-6 ${color}`} /> <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>

            <button onClick={() => setShowLocationSearch(true)} className="w-full h-14 mt-4 rounded-2xl bg-cyan-500 text-black font-bold flex items-center justify-center gap-2">
              <MapPin /> Near me
            </button>
          </motion.div>

          {/* FINTECH + SPACE CARDS */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-8">
            <div className="p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] mb-4">
              <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-5 h-5 text-cyan-400" /><h3 className="font-bold">Fintech Intelligence</h3></div>
              <FintechDashboard />
            </div>
            <div className="p-4 rounded-2xl bg-[#0A0E14] border-[#1A1F2E]">
              <div className="flex items-center gap-2 mb-3"><Rocket className="w-5 h-5 text-cyan-400" /><h3 className="font-bold">Space Intelligence</h3></div>
              <p className="text-sm text-gray-400">Checking space conditions...</p>
            </div>
          </motion.div>

          {/* YOUR EXISTING COMPONENTS */}
          <TrendingTopics />
          <LiveActivityFeed />
        </div>
      </main>
    </div>
  );
};

export default Index;
