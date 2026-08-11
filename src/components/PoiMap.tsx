import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapPoint {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
  description?: string | null;
}

export default function PoiMap({ points, className = "" }: { points: MapPoint[]; className?: string }) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView([9.0765, 7.3986], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    valid.forEach((p) => {
      L.marker([p.latitude, p.longitude], { icon })
        .bindPopup(`<strong>${p.name}</strong>${p.description ? `<br/>${p.description}` : ""}`)
        .addTo(layer.current!);
    });
    if (valid.length) {
      map.current.fitBounds(L.latLngBounds(valid.map((p) => [p.latitude, p.longitude] as [number, number])).pad(0.25), {
        maxZoom: 15,
      });
    }
  }, [points]);

  return <div ref={container} className={`w-full h-[320px] sm:h-[420px] rounded-xl overflow-hidden z-0 ${className}`} />;
}
