import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Gift, Trophy, Code, Building2, Crown, Info, MapPin } from "lucide-react";

interface Props {
  onNearMe: () => void;
}

const LINKS = [
  { to: "/premium", label: "Go Premium", icon: Crown },
  { to: "/business", label: "Business", icon: Building2 },
  { to: "/referral", label: "Refer & Earn", icon: Gift },
  { to: "/points", label: "POI Points", icon: Trophy },
  { to: "/developer", label: "Developer API", icon: Code },
  { to: "/about", label: "About", icon: Info },
];

/** Floating action menu, bottom-right, matching v1 layout. */
const FloatingMenu = ({ onNearMe }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="glass rounded-2xl p-2 flex flex-col gap-1 mb-1 min-w-[180px] animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => { setOpen(false); onNearMe(); }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-foreground/5 transition-colors min-h-[44px]"
          >
            <MapPin className="w-4 h-4 text-primary" /> Near me
          </button>
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-foreground/5 transition-colors min-h-[44px]"
            >
              <l.icon className="w-4 h-4 text-primary" /> {l.label}
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Menu"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
      >
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default FloatingMenu;
