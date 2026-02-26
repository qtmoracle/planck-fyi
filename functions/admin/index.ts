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
    .pill.pending{background:#f9fafb}
    .pill.approved{background:#ecfeff}
    .pill.denied{background:#fef2f2}
    .pill.queued{background:#f5f3ff}
    .pill.completed{background:#f0fdf4}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}
    .small{font-size:12px;color:#6b7280}
    form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
    label{font-size:12px;color:#374151;display:flex;flex-direction:column;gap:6px}
    input,select,button{font-size:14px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px}
    button{background:#111827;color:#fff;border-color:#111827;cursor:pointer}
    button:hover{opacity:.92}
    .count{font-variant-numeric:tabular-nums}
  </style>
</head>
<body>
  ${body}
</body>
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }});
}

type IntakeStateStatus = "pending" | "approved" | "denied" | "queued" | "completed";
type IntakeState = {
  id: string;
  status: IntakeStateStatus;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
  queue?: { position: number | null; scheduledFor: string | null };
};

const PACKET_PREFIX = "planck/intake_packets/INTAKE_PACKET_v0.01/";
const STATE_PREFIX  = "planck/intake_state/INTAKE_STATE_v0.01/";

function defaultState(id: string): IntakeState {
  return {
    id,
    status: "pending",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    notes: "",
    queue: { position: null, scheduledFor: null },
  };
}

async function readState(bucket: R2Bucket, id: string): Promise<IntakeState> {
  const key = `${STATE_PREFIX}${id}.json`;
  const obj = await bucket.get(key);
  if (!obj) return defaultState(id);
  try {
    const txt = await obj.text();
    const s = JSON.parse(txt);
    if (!s || typeof s !== "object") return defaultState(id);
    const status = String(s.status || "pending") as IntakeStateStatus;
    if (!["pending","approved","denied","queued","completed"].includes(status)) return defaultState(id);
    return {
      id,
      status,
      updatedAt: String(s.updatedAt || new Date().toISOString()),
      updatedBy: String(s.updatedBy || "admin"),
      notes: typeof s.notes === "string" ? s.notes : "",
      queue: {
        position: (s.queue && typeof s.queue.position === "number") ? s.queue.position : null,
        scheduledFor: (s.queue && typeof s.queue.scheduledFor === "string") ? s.queue.scheduledFor : null,
      },
    };
  } catch {
    return defaultState(id);
  }
}

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

// tolerate old/new labels: "Maintenance" vs "Maintenance Protocol" etc
function tierMatches(packetTier: string, selectedTier: string) {
  const p = norm(packetTier);
  const t = norm(selectedTier);
  if (!t) return true;
  if (!p) return false;

  if (p === t) return true;
  if (p.includes(t)) return true;
  if (t.includes(p)) return true;
  if (p.startsWith(t)) return true;
  if (t.startsWith(p)) return true;

  return false;
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const { request, env } = ctx;

  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized();
  if (!checkAuth(request, ADMIN_USER, ADMIN_PASS)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";
  const tier = searchParams.get("tier") || "";
  const serviceArea = searchParams.get("service_area") || "";
  const statusFilter = (searchParams.get("status") || "").trim();

  // @ts-ignore
  const bucket: R2Bucket = env.INTAKE_BUCKET;
  if (!bucket) return page("Planck Admin", `<p class="muted">missing INTAKE_BUCKET binding</p>`);

  const list = await bucket.list({ prefix: PACKET_PREFIX, limit: 50 });

  const rows: string[] = [];

  for (const obj of list.objects) {
    const key = obj.key;
    const id = key.replace(PACKET_PREFIX, "").replace(/\.json$/, "");

    let name = "";
    let asset = "";
    let packetTier = "";
    let area = "";
    let photoCount = 0;
    let ts = "";

    try {
      const file = await bucket.get(key);
      const txt = file ? await file.text() : "";
      const packet = txt ? JSON.parse(txt) : null;

      name = String(packet?.data?.contact?.name || "");
      asset = String(packet?.data?.asset?.details || "");
      packetTier = String(packet?.data?.request?.tier || "");
      area = String(packet?.data?.request?.service_area || "");
      photoCount = Array.isArray(packet?.photos?.items) ? packet.photos.items.length : 0;
      ts = String(packet?.ts || packet?.createdAt || "");
    } catch {}

    const uploaded = obj.uploaded ? obj.uploaded : null;
    const dateObj = ts ? new Date(ts) : (uploaded ? uploaded : null);

    if (fromDate && dateObj && dateObj < new Date(fromDate)) continue;
    if (toDate && dateObj && dateObj > new Date(toDate)) continue;

    if (!tierMatches(packetTier, tier)) continue;

    if (serviceArea && !norm(area).includes(norm(serviceArea))) continue;

    const st = await readState(bucket, id);
    if (statusFilter && st.status !== statusFilter) continue;

    const dateStr = dateObj ? dateObj.toISOString() : (uploaded ? uploaded.toISOString() : "");
    const pillClass = `pill ${st.status}`;

    rows.push(`
      <tr>
        <td class="small">${esc(dateStr || "—")}</td>
        <td>${esc(name || "—")}</td>
        <td>${esc(asset || "—")}</td>
        <td><span class="pill">${esc(packetTier || "—")}</span></td>
        <td>${esc(area || "—")}</td>
        <td><span class="${pillClass}">${esc(st.status)}</span></td>
        <td class="count">${photoCount}</td>
        <td><a href="/admin/intake/${encodeURIComponent(id)}">Open</a></td>
      </tr>
    `);
  }

  const body = `
    <div class="top">
      <div>
        <h1>Planck Admin — Intake Submissions</h1>
        <div class="small">Showing up to 50 most recent</div>
      </div>

      <form method="GET" action="/admin">
        <label>From
          <input type="date" name="from" value="${esc(fromDate)}" />
        </label>
        <label>To
          <input type="date" name="to" value="${esc(toDate)}" />
        </label>
        <label>Tier
          <select name="tier">
            <option value="" ${tier === "" ? "selected" : ""}>All</option>
            <option value="Maintenance Protocol" ${tier === "Maintenance Protocol" ? "selected" : ""}>Maintenance Protocol</option>
            <option value="Correction Protocol" ${tier === "Correction Protocol" ? "selected" : ""}>Correction Protocol</option>
            <option value="Full Surface Reset" ${tier === "Full Surface Reset" ? "selected" : ""}>Full Surface Reset</option>
            <option value="Not sure — recommend" ${tier === "Not sure — recommend" ? "selected" : ""}>Not sure — recommend</option>
          </select>
        </label>
        <label>Service Area
          <input type="text" name="service_area" value="${esc(serviceArea)}" placeholder="e.g. Pinecrest" />
        </label>
        <label>Status
          <select name="status">
            <option value="" ${statusFilter === "" ? "selected" : ""}>All</option>
            <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>pending</option>
            <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>approved</option>
            <option value="denied" ${statusFilter === "denied" ? "selected" : ""}>denied</option>
            <option value="queued" ${statusFilter === "queued" ? "selected" : ""}>queued</option>
            <option value="completed" ${statusFilter === "completed" ? "selected" : ""}>completed</option>
          </select>
        </label>
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
          <th>Status</th>
          <th>Photos</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("") || `<tr><td colspan="8" class="muted">No submissions found yet.</td></tr>`}
      </tbody>
    </table>
  `;

  return page("Planck Admin", body);
};
