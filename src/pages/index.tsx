import { useState, useEffect } from "react";
import { Search, Mic, MapPin, Wallet, Fuel, TrafficCone, Shield, Menu, X, Zap, TrendingUp, Rocket, Brain, Globe, Lock, Layers, BarChart3 } from "lucide-react";

export default function Home() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "long", timeStyle: "medium" }));
    update(); setInterval(update, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <header className="sticky top-0 bg-[#05070A]/80 backdrop-blur-md border-b border-[#1A1F2E] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center"><Zap className="w-5 h-5 text-cyan-400" /></div>
            <h1 className="text-xl font-bold">SEARCH<span className="text-cyan-400">-POI</span></h1>
          </div>
          <Menu className="w-6 h-6" />
        </div>
        <div className="mt-3 text-xs text-gray-400">Mode: Live Data → GPS Ready</div>
        <div className="text-xs text-yellow-400">Live GPS | Locating you... POS ₦47K cash now</div>
      </header>

      <main className="p-4">
        <h2 className="text-3xl font-bold text-center mt-4">SEARCH<span className="text-cyan-400">-POI</span></h2>
        <p className="text-center text-xl mt-2">Don't search. <span className="text-cyan-400">Ask.</span></p>
        
        <div className="relative mt-6">
          <Search className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
          <input placeholder="Ask anything..." className="w-full h-14 pl-12 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E]" />
          <Mic className="absolute right-4 top-4 w-5 h-5 text-gray-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button className="p-4 rounded-2xl bg-[#0A0E14] border-[#1A1F2E] flex gap-2"><Wallet className="text-yellow-400"/> POS Cash</button>
          <button className="p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] flex gap-2"><Fuel className="text-green-400"/> Fuel Price</button>
          <button className="p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] flex gap-2"><TrafficCone className="text-orange-400"/> Traffic</button>
          <button className="p-4 rounded-2xl bg-[#0A0E14] border border-[#1A1F2E] flex gap-2"><Shield className="text-red-400"/> Danger</button>
        </div>

        <button className="w-full h-14 mt-4 rounded-2xl bg-cyan-500 text-black font-bold flex items-center justify-center gap-2">
          <MapPin /> Near me
        </button>
      </main>
    </div>
  )
}
