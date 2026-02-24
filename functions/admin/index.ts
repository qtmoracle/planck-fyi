function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Planck Admin"' },
  });
}

function checkAuth(req: Request, user: string, pass: string) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  const raw = h.slice(6).trim();
  let decoded = "";
  try { decoded = atob(raw); } catch { return false; }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return u === user && p === pass;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c] as string));
}

function page(title: string, body: string) {
  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;margin:24px;max-width:1100px}
    h1{font-size:20px;margin:0 0 16px}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e5e7eb;padding:10px 8px;text-align:left;font-size:14px;vertical-align:top}
    th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}
    a{color:#111827;text-decoration:none}
    a:hover{text-decoration:underline}
    .muted{color:#6b7280}
    .pill{display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:2px 10px;font-size:12px;color:#374151}
    .top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
    .small{font-size:12px;color:#6b7280}
  </style>
</head>
<body>
  ${body}
</body>
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }});
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const { request, env } = ctx;

  // Auth check
  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized();
  if (!checkAuth(request, ADMIN_USER, ADMIN_PASS)) return unauthorized();

  // Parse query params for filters (date range, service area, etc.)
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";
  const serviceType = searchParams.get("service_type") || "";
  const serviceArea = searchParams.get("service_area") || "";

  // @ts-ignore
  const bucket: R2Bucket = env.INTAKE_BUCKET;
  if (!bucket) return page("Planck Admin", `<p class="muted">missing INTAKE_BUCKET binding</p>`);

  const prefix = "planck/intake_packets/INTAKE_PACKET_v0.01/";
  const list = await bucket.list({ prefix, limit: 50 });

  // Filter by date range and service area/type
  const objs = list.objects
    .filter((obj) => {
      if (!obj.uploaded) return true;
      const uploadedDate = obj.uploaded;
      return (
        (!fromDate || uploadedDate >= new Date(fromDate)) &&
        (!toDate || uploadedDate <= new Date(toDate))
      );
    })
    .filter((obj) => {
      if (!serviceType && !serviceArea) return true;
      return obj.key.includes(serviceType) && obj.key.includes(serviceArea);
    })
    .sort((a, b) => (b.uploaded?.getTime() || 0) - (a.uploaded?.getTime() || 0));

  const rows: string[] = [];
  for (const obj of objs) {
    const key = obj.key;
    const id = key.replace(prefix, "").replace(/\.json$/, "");
    let summary = { name: "", asset: "", tier: "", area: "", photos: [] };

    try {
      const file = await bucket.get(key);
      const txt = file ? await file.text() : "";
      const packet = txt ? JSON.parse(txt) : null;
      summary = {
        name: String(packet?.data?.contact?.name || ""),
        asset: String(packet?.data?.asset?.details || ""),
        tier: String(packet?.data?.request?.tier || ""),
        area: String(packet?.data?.request?.service_area || ""),
        photos: packet?.photos?.items || [],
      };
    } catch {
      // ignore parse errors; still list it
    }

    const date = summary.ts ? esc(summary.ts) : (obj.uploaded ? esc(obj.uploaded.toISOString()) : "");
    rows.push(`
      <tr>
        <td class="small">${date}</td>
        <td>${esc(summary.name || "—")}</td>
        <td>${esc(summary.asset || "—")}</td>
        <td><span class="pill">${esc(summary.tier || "—")}</span></td>
        <td>${esc(summary.area || "—")}</td>
        <td><a href="/admin/intake/${encodeURIComponent(id)}">Open</a></td>
        <td>
          ${summary.photos.map(photo => `<img src="https://your-cf-r2-url/${photo.key}" width="40" />`).join('')}
        </td>
      </tr>
    `);
  }

  const body = `
    <div class="top">
      <h1>Planck Admin — Intake Submissions</h1>
      <div class="small">Showing up to 50 most recent</div>
      <form method="GET" action="/admin">
        <label>From Date: <input type="date" name="from" value="${fromDate}" /></label>
        <label>To Date: <input type="date" name="to" value="${toDate}" /></label>
        <label>Service Type: 
          <select name="service_type">
            <option value="">All</option>
            <option value="Maintenance" ${serviceType === "Maintenance" ? "selected" : ""}>Maintenance</option>
            <option value="Correction" ${serviceType === "Correction" ? "selected" : ""}>Correction</option>
            <option value="Full Surface Reset" ${serviceType === "Full Surface Reset" ? "selected" : ""}>Full Surface Reset</option>
          </select>
        </label>
        <label>Service Area: <input type="text" name="service_area" value="${serviceArea}" /></label>
        <button type="submit">Filter</button>
      </form>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Name</th>
          <th>Asset</th>
          <th>Tier</th>
          <th>Area</th>
          <th></th>
          <th>Photos</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("") || `<tr><td colspan="7" class="muted">No submissions found yet.</td></tr>`}
      </tbody>
    </table>
  `;

  return page("Planck Admin", body);
};
