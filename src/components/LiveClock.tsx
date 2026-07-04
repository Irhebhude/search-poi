import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

/**
 * Live date/time engine — ticks every second using the device system clock.
 * Auto-detects the user's timezone (WAT for Nigeria, GMT for UK, etc.).
 * NEVER hardcodes a date. Portable: works on Lovable and on Cloudflare Pages.
 */
const LiveClock = () => {
  const [now, setNow] = useState<Date>(new Date());
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const formatted = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now);

  return (
    <div
      id="liveDateTime"
      className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
      title="Live system clock — auto timezone"
    >
      <Radio
        className={`w-3 h-3 ${online ? "text-primary animate-pulse" : "text-destructive"}`}
      />
      <span className="hidden xs:inline">Live Data:</span>
      <span className="text-foreground/90">{formatted}</span>
    </div>
  );
};

export default LiveClock;
