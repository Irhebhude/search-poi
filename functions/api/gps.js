// /api/gps — reverse geocode via Mapbox (live). Binding: env.MAPBOX_KEY (secret).
export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return new Response(JSON.stringify({ error: "lat and lon required" }), { status: 400, headers: cors });
  }

  const r = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${env.MAPBOX_KEY}`,
  ).then((res) => res.json());

  const f = r.features?.[0];
  return new Response(
    JSON.stringify({
      place: f?.place_name || "Unknown location",
      context: f?.context || [],
      updated: new Date().toISOString(),
    }),
    { headers: cors },
  );
}
