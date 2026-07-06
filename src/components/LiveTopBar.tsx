import { RefreshCw, Satellite, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { PoiLiveState } from "@/hooks/usePoiLive";

interface Props {
  live: PoiLiveState;
}

/** Top status strip: Mode: Live Data — GPS Ready | Sync Now | Live datetime + GPS banner */
const LiveTopBar = ({ live }: Props) => {
  return (
    <div className="fixed top-14 left-0 right-0 z-40 glass border-b border-border/30">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 font-medium">
          {live.online ? (
            <Wifi className="w-3.5 h-3.5 text-primary" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className="text-foreground/90">Mode: Live Data</span>
          <span className="text-muted-foreground">— GPS Ready</span>
        </div>

        <button
          onClick={live.syncNow}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium min-h-[28px]"
        >
          <RefreshCw className="w-3 h-3" />
          Sync Now
        </button>

        <div id="liveDateTime" className="flex items-center gap-1.5 tabular-nums text-foreground/80">
          <Satellite className="w-3.5 h-3.5 text-primary" />
          Live Data: {live.dateTime}
        </div>
      </div>

      {/* GPS + POS cash live banners */}
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-1.5 text-[11px]">
        <span id="gpsBanner" className="text-muted-foreground truncate max-w-full">{live.gpsBanner}</span>
        <span id="poiCashBanner" className="text-[hsl(45,90%,55%)] font-medium">{live.posCash}</span>
        {live.dataError && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="w-3 h-3" /> Data Unavailable
          </span>
        )}
      </div>
    </div>
  );
};

export default LiveTopBar;
