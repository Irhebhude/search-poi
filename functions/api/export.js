// /api/export — convert JSON rows to CSV download.
export async function onRequestPost(context) {
  const { rows = [] } = await context.request.json();
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="search-poi-export.csv"',
      "Access-Control-Allow-Origin": "*",
    },
  });
}
