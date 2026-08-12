import { Link } from "react-router-dom";
import { Code2, KeyRound } from "lucide-react";

const SNIPPET = `curl "https://search-poi.pages.dev/api/search?q=abuja&api_key=YOUR_KEY"`;

/** "For developers" card — public fact-based search API. */
const DeveloperSection = () => (
  <div className="glass rounded-2xl p-5 sm:p-6 text-left">
    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
      <Code2 className="w-3.5 h-3.5" /> For developers
    </div>
    <h2 className="text-lg sm:text-xl font-bold text-foreground">Use SEARCH-POI in your own app</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Get your free API key and make 1000 requests/month.
    </p>

    <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/40 p-4 font-mono text-[11px] sm:text-xs text-muted-foreground">
      {SNIPPET}
    </pre>

    <Link
      to="/dashboard/api-keys"
      className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
    >
      <KeyRound className="w-4 h-4" />
      Get API Key
    </Link>
  </div>
);

export default DeveloperSection;
