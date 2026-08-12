import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Zap, Globe, Shield, Cpu, Layers, MapPin, Crown, Building2, TrendingUp, BarChart3, LineChart, Search, Mic, Wallet, Fuel, TrafficCone, Menu, X } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import Header from "@/components/Header";
import LiveTopBar from "@/components/LiveTopBar";
import FloatingMenu from "@/components/FloatingMenu";
import { usePoiLive } from "@/hooks/usePoiLive";

const Index = () => {
  const navigate = useNavigate();
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const live = usePoiLive();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white relative">
      <Header />
      <LiveTopBar live={live} />
      
      {/* Hero */}
      <main className="relative z-10 pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-3">
              <span className="text-white">SEARCH</span>
              <span className="text-cyan-400">-POI</span>
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-medium mb-6">
              <Zap className="w-3 h-3" /> POWERED BY SEARCH-POI ENGINE V1
            </div>
            <p className="text-2xl md:text-3xl text-white font-semibold">
              Don't search. <span className="text-cyan-400">Ask.</span>
            </p>

            {/* Search Bar */}
            <div className="relative mt-8 max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Mic className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <SearchBar onSearch={handleSearch} />
            </div>

            {/* 4 Cards */}
            <div className="grid grid-cols-2 gap-3 mt-8">
              {[
                { icon: Wallet, label: "POS Cash", color: "text-yellow-400" },
                { icon: Fuel, label: "Fuel Price", color: "text-green-400" },
                { icon: TrafficCone, label: "Traffic", color: "text-orange-400" },
                { icon: Shield, label: "Danger", color: "text-red-400" },
              ].map(({icon: Icon, label, color}) => (
                <button key={label} className="flex items-center gap-3 p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] hover:border-cyan-500/50">
                  <Icon className={`w-6 h-6 ${color}`} />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* Near Me */}
            <button onClick={() => setShowLocationSearch(true)} className="w-full h-14 mt-4 rounded-2xl bg-cyan-500 text-black font-bold flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" /> Near me
            </button>
          </motion.div>
          
          {/* Keep your FintechDashboard and other components here */}
          {/* They will auto inherit the dark bg now */}
        </div>
      </main>

      <FloatingMenu onNearMe={() => setShowLocationSearch(true)} />
    </div>
  );
};

export default Index;
