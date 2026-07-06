import { useNavigate } from "react-router-dom";
import { Banknote, Fuel, TrafficCone, ShieldAlert, MapPin } from "lucide-react";

interface Props {
  onNearMe: () => void;
}

const ACTIONS = [
  { label: "POS Cash", icon: Banknote, query: "POS cash points near me", accent: "hsl(45,90%,55%)" },
  { label: "Fuel Price", icon: Fuel, query: "fuel price petrol stations near me", accent: "hsl(150,70%,55%)" },
  { label: "Traffic", icon: TrafficCone, query: "live traffic conditions near me", accent: "hsl(25,90%,58%)" },
  { label: "Danger", icon: ShieldAlert, query: "safety alerts and danger zones near me", accent: "hsl(0,80%,62%)" },
];

/** 2x2 quick actions grid + Near me button, matching v1 home layout. */
const HomeQuickActions = ({ onNearMe }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto mt-6 sm:mt-8">
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(`/search?q=${encodeURIComponent(a.query)}`)}
            className="flex items-center gap-3 glass rounded-2xl px-4 py-4 text-left hover:bg-foreground/5 transition-colors min-h-[64px]"
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{ backgroundColor: `${a.accent}20`, color: a.accent }}
            >
              <a.icon className="w-5 h-5" />
            </span>
            <span className="font-semibold text-foreground text-sm">{a.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onNearMe}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold py-4 min-h-[56px] hover:opacity-90 transition-opacity"
      >
        <MapPin className="w-5 h-5" />
        Near me
      </button>
    </div>
  );
};

export default HomeQuickActions;
