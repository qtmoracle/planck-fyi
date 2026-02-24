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
    a{color:#111827;text-decoration:none}
    a:hover{text-decoration:underline}
    h1{font-size:18px;margin:0 0 12px}
    .muted{color:#6b7280}
    pre{background:#0b1220;color:#e5e7eb;padding:14px;border-radius:12px;overflow:auto;font-size:12px;line-height:1.45}
    .row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
    .meta{font-size:12px;color:#6b7280}
    .photos{display:grid;grid-template-columns:repeat(auto-fill, minmax(100px, 1fr));gap:10px;}
    .photos img{width:100%;height:auto;border-radius:8px;}
  </style>
</head>
<body>
  ${body}
</body>
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }});
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const { request, env, params } = ctx;

  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized();
  if (!checkAuth(request, ADMIN_USER, ADMIN_PASS)) return unauthorized();

  const id = String(params?.id || "").trim();
  if (!id) return page("Planck Admin", `<p class="muted">Missing id.</p>`);

  // @ts-ignore
  const bucket: R2Bucket = env.INTAKE_BUCKET;
  if (!bucket) return page("Planck Admin", `<p class="muted">missing INTAKE_BUCKET binding</p>`);

  const key = `planck/intake_packets/INTAKE_PACKET_v0.01/${id}.json`;
  const obj = await bucket.get(key);
  if (!obj) {
    return page("Planck Admin", `<p class="muted">Not found.</p><p><a href="/admin">← Back</a></p>`);
  }

  const txt = await obj.text();
  let pretty = txt;
  try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch {}

  const packet = JSON.parse(txt);
  const photos = packet?.photos?.items || [];

  // Display photo previews
  const photoPreviews = photos.map(photo => {
    const photoUrl = `https://your-cf-r2-url/${photo.key}`;  // Replace with your actual R2 URL
    return `<img src="${photoUrl}" alt="photo" />`;
  }).join("");

  const body = `
    <div class="row">
      <h1>Intake Packet</h1>
      <div class="meta">${esc(key)}</div>
    </div>
    <p><a href="/admin">← Back to list</a></p>
    <h2>Photos:</h2>
    <div class="photos">
      ${photoPreviews || "<p>No photos available.</p>"}
    </div>
    <h2>Full Submission Data:</h2>
    <pre>${esc(pretty)}</pre>
  `;

  return page("Planck Admin", body);
};
