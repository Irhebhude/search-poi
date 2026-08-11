import { useCallback, useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import PoiMap, { type MapPoint } from "@/components/PoiMap";
import SystemStatus from "@/components/SystemStatus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api";

interface Poi extends MapPoint {
  address?: string | null;
  created_at?: string;
  distance_km?: number;
}

const Explore = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Poi[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/pois?q=${encodeURIComponent(q)}`), { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.help || body?.error || `Request failed (${res.status})`);
      setResults(body.results ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { search(""); }, [search]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        toast.success("Location captured");
      },
      (err) => toast.error(err.message || "Could not get your location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const addPoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !latitude || !longitude) {
      toast.error("Name, latitude and longitude are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/pois"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, latitude: Number(latitude), longitude: Number(longitude) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.help || body?.error || `Request failed (${res.status})`);
      toast.success(`${name} added`);
      setName(""); setDescription(""); setLatitude(""); setLongitude("");
      search(query);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add POI");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="POI Explorer — Search & Add Places | SEARCH-POI"
        description="Search points of interest on a live map and contribute new places with your device location."
        path="/explore"
      />
      <Header />
      <main className="container mx-auto max-w-4xl px-3 sm:px-4 pt-28 pb-16 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold">POI Explorer</h1>

        <Tabs defaultValue="search">
          <TabsList className="w-full grid grid-cols-2 h-auto">
            <TabsTrigger value="search" className="min-h-[48px]">Search</TabsTrigger>
            <TabsTrigger value="add" className="min-h-[48px]">Add POI</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 mt-4">
            <Card className="glass p-4">
              <form
                onSubmit={(e) => { e.preventDefault(); search(query); }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places…" className="min-h-[48px]" />
                <Button type="submit" disabled={searching} className="min-h-[48px]">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Search</span>
                </Button>
              </form>
              {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            </Card>

            <PoiMap points={results} />

            <Card className="glass p-4">
              <h2 className="text-sm font-semibold mb-3">{results.length} result{results.length === 1 ? "" : "s"}</h2>
              <ul className="space-y-2">
                {results.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
                {!results.length && !searching && <li className="text-xs text-muted-foreground">No places found.</li>}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="add" className="mt-4">
            <Card className="glass p-4">
              <form onSubmit={addPoi} className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="min-h-[48px]" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude *" inputMode="decimal" className="min-h-[48px]" />
                  <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude *" inputMode="decimal" className="min-h-[48px]" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="button" variant="secondary" onClick={useMyLocation} className="min-h-[48px]">
                    <Crosshair className="w-4 h-4 mr-2" /> Use my location
                  </Button>
                  <Button type="submit" disabled={saving} className="min-h-[48px]">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Add POI"}
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <SystemStatus compact />
      </main>
    </div>
  );
};

export default Explore;
