import { useEffect, useRef, useState } from "react";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poi-live`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const authFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });

function formatWAT(now: Date) {
  return (
    new Intl.DateTimeFormat("en-NG", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true, timeZone: "Africa/Lagos",
    }).format(now) + " WAT"
  );
}

export interface PoiLiveState {
  online: boolean;
  dateTime: string;
  posCash: string;
  gpsBanner: string;
  lastUpdate: string;
  dataError: boolean;
  syncNow: () => void;
  speak: (text: string) => void;
}

export function usePoiLive(): PoiLiveState {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [dateTime, setDateTime] = useState(() => formatWAT(new Date()));
  const [posCash, setPosCash] = useState("POS cash — live…");
  const [gpsBanner, setGpsBanner] = useState("Live GPS | Locating you…");
  const [lastUpdate, setLastUpdate] = useState("Live Data | Connecting…");
  const [dataError, setDataError] = useState(false);
  const lastCity = useRef<string>("");

  const speak = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.volume = 1;
      u.rate = 1;
      speechSynthesis.speak(u);
    } catch { /* noop */ }
  };

  const fetchIcs = async () => {
    try {
      const res = await authFetch("/ics");
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setPosCash(`POS ₦${data.cash}K cash now`);
      setLastUpdate(`Live Data | Last update: ${formatWAT(new Date())}`);
      setDataError(false);
    } catch {
      setDataError(true);
      setLastUpdate("⚠️ Data Unavailable — live source not connected.");
    }
  };

  // RULE 1: internet check
  useEffect(() => {
    const on = () => { setOnline(true); location.reload(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // RULE 2: live clock + 60s server sync
  useEffect(() => {
    const tick = setInterval(() => setDateTime(formatWAT(new Date())), 1000);
    const sync = setInterval(async () => {
      try {
        const res = await authFetch("/time");
        const data = await res.json();
        if (Math.abs(Date.now() - new Date(data.iso).getTime()) > 5000) {
          setDateTime(data.wat || formatWAT(new Date()));
        }
      } catch { /* keep local clock */ }
    }, 60000);
    return () => { clearInterval(tick); clearInterval(sync); };
  }, []);

  // RULE 3: voice "Hey POI"
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let rec: any;
    try {
      rec = new SR();
      rec.continuous = true;
      rec.lang = "en-NG";
      rec.onresult = (e: any) => {
        const t = e.results[e.results.length - 1][0].transcript.toLowerCase();
        if (t.includes("hey poi")) {
          if (t.includes("what date") || t.includes("what time")) speak(formatWAT(new Date()));
          if (t.includes("where am i")) speak(gpsBanner);
        }
      };
      rec.onerror = () => { /* ignore */ };
      if (navigator.onLine) rec.start();
    } catch { /* mic unavailable */ }
    return () => { try { rec?.stop(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RULE 4: GPS watch
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsBanner("Live GPS | Location not supported");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const res = await authFetch(`/gps?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const a = await res.json();
          const parts = [a.street, a.city, a.state, a.country].filter(Boolean).join(", ");
          setGpsBanner(`Live GPS | You are in: ${parts || "Unknown"}`);
          if (a.city && a.city !== lastCity.current) {
            if (lastCity.current) speak(`You have arrived ${a.city}, ${a.state}, ${a.country}`);
            lastCity.current = a.city;
          }
        } catch {
          setGpsBanner("Live GPS | Location unavailable");
        }
      },
      () => setGpsBanner("Live GPS | Enable location access"),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RULE 5: live data sync every 10s
  useEffect(() => {
    fetchIcs();
    const t = setInterval(fetchIcs, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { online, dateTime, posCash, gpsBanner, lastUpdate, dataError, syncNow: fetchIcs, speak };
}
