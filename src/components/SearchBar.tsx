import { useState, useRef, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import VoiceSearchButton from "@/components/VoiceSearchButton";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  initialQuery?: string;
}

const SearchBar = ({ onSearch, isLoading, compact, initialQuery = "" }: SearchBarProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!compact) inputRef.current?.focus();
  }, [compact]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div
          className={`search-glow relative flex items-center gap-3 glass rounded-2xl transition-all duration-300 ${
            compact ? "px-4 py-3" : "px-6 py-4"
          } ${isFocused ? "glow-border !border-[#00F0FF]" : ""}`}
        >
          <Search className="w-5 h-5 text-primary shrink-0" />
          <VoiceSearchButton onTranscript={(text) => { setQuery(text); onSearch(text); }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder="Ask anything... SEARCH-POI understands you"
            className={`flex-1 bg-[#1A1A24] outline-none text-foreground placeholder:text-muted-foreground font-sans rounded-xl ${
              compact ? "text-base px-3 py-2" : "text-lg px-3 py-2"
            }`}
          />
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <button
              type="submit"
              disabled={!query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <Sparkles className="w-4 h-4" />
              Search
            </button>
          )}
        </div>
      </form>

      <SearchAutocomplete
        query={query}
        isOpen={showSuggestions}
        onSelect={handleSuggestionSelect}
        onClose={() => setShowSuggestions(false)}
      />
    </div>
  );
};

export default SearchBar;
