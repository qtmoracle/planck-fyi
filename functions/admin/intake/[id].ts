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
    h2{font-size:14px;margin:18px 0 10px}
    .muted{color:#6b7280}
    pre{background:#0b1220;color:#e5e7eb;padding:14px;border-radius:12px;overflow:auto;font-size:12px;line-height:1.45}
    .row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}
    .meta{font-size:12px;color:#6b7280}
    .photos{display:grid;grid-template-columns:repeat(auto-fill, minmax(100px, 1fr));gap:10px;}
    .photos .ph{border:1px solid #e5e7eb;border-radius:10px;padding:10px;font-size:12px;color:#374151;background:#fafafa}
    .pill{display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:2px 10px;font-size:12px;color:#374151}
    .pill.pending{background:#f9fafb}
    .pill.approved{background:#ecfeff}
    .pill.denied{background:#fef2f2}
    .pill.queued{background:#f5f3ff}
    .pill.completed{background:#f0fdf4}
    .pill.archived{background:#fffbeb}
    .actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    form{margin:0}
    button{font-size:14px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#111827;color:#fff;border-color:#111827;cursor:pointer}
    button.secondary{background:#fff;color:#111827;border-color:#e5e7eb}
    button.danger{background:#991b1b;border-color:#991b1b}
    button.purple{background:#4c1d95;border-color:#4c1d95}
    button.green{background:#166534;border-color:#166534}
    button.blue{background:#1d4ed8;border-color:#1d4ed8}
    button:hover{opacity:.92}
    textarea{width:100%;min-height:90px;font-size:14px;padding:10px;border:1px solid #e5e7eb;border-radius:12px}
    .card{border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin:14px 0}
    .kv{display:grid;grid-template-columns:160px 1fr;gap:8px 14px;font-size:14px}
    .k{color:#6b7280}
    input[type="date"],input[type="time"],input[type="number"],input[type="datetime-local"]{font-size:14px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px}
    .help{font-size:12px;color:#6b7280;margin-top:8px}
  </style>
</head>
<body>
  ${body}
</body>
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }});
}

type IntakeStateStatus = "pending" | "approved" | "denied" | "queued" | "completed" | "archived";
type IntakeState = {
  id: string;
  status: IntakeStateStatus;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
  queue?: {
    position: number | null;
    scheduledFor: string | null; // canonical UTC ISO string (Z)
    // scheduledByTz?: string | null; // optional; saved by /admin/state handler if you add it
  };
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
    const status = String(s.status || "pending") as IntakeStateStatus;
    if (!["pending","approved","denied","queued","completed","archived"].includes(status)) return defaultState(id);
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

  const packetKey = `${PACKET_PREFIX}${id}.json`;
  const obj = await bucket.get(packetKey);
  if (!obj) {
    return page("Planck Admin", `<p class="muted">Not found.</p><p><a href="/admin">← Back</a></p>`);
  }

  const txt = await obj.text();
  let pretty = txt;
  try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch {}

  let packet: any = null;
  try { packet = JSON.parse(txt); } catch { packet = null; }
  const photos = Array.isArray(packet?.photos?.items) ? packet.photos.items : [];

  const st = await readState(bucket, id);
  const pillClass = `pill ${st.status}`;

  const contact = packet?.data?.contact || {};
  const asset = packet?.data?.asset || {};
  const requestData = packet?.data?.request || {};

  // canonical UTC ISO string, if present
  const scheduledUtc = st.queue?.scheduledFor ? String(st.queue.scheduledFor) : "";

  const body = `
    <div class="row">
      <div>
        <h1>Intake Packet</h1>
        <div class="meta">${esc(packetKey)}</div>
      </div>
      <div class="actions">
        <span class="${pillClass}">${esc(st.status)}</span>
        ${(st.status === "queued" || st.status === "completed") ? `<a href="/operators/qtm-detailing/jobs/?job=job_${encodeURIComponent(id)}" style="background:#166534;color:#fff;padding:6px 14px;border-radius:10px;font-size:13px;text-decoration:none;">Open Job →</a>` : ""}
        <a class="meta" href="/admin">← Back to list</a>
      </div>
    </div>

    <div class="card">
      <div class="row" style="align-items:center">
        <h2 style="margin:0">Admin Actions</h2>
        <div class="meta">Sidecar only — packet is immutable</div>
      </div>

      <form id="adminStateForm" method="POST" action="/admin/state/${encodeURIComponent(id)}">
        <div class="kv" style="margin-top:12px">
          <div class="k">Notes</div>
          <div><textarea name="notes" placeholder="Internal notes (optional)">${esc(st.notes || "")}</textarea></div>

          <div class="k">Queue Position</div>
          <div>
            <input name="queue_position" type="number" min="1" step="1" value="${st.queue?.position ?? ""}" style="width:160px" />
            <span class="meta">optional</span>
          </div>

          <div class="k">Scheduled For</div>
          <div>
            <!-- Visible input is LOCAL to the viewer/operator -->
            <input
              id="scheduled_for_local"
              name="scheduled_for_local"
              type="datetime-local"
              value=""
              data-utc="${esc(scheduledUtc)}"
              style="width:260px"
            />
            <!-- Hidden canonical UTC value written on submit -->
            <input id="scheduled_for_utc" name="scheduled_for" type="hidden" value="${esc(scheduledUtc)}" />
            <!-- Optional: capture who scheduled it (timezone label) -->
            <input id="scheduled_by_tz" name="scheduled_by_tz" type="hidden" value="" />
            <span class="meta">optional · displayed in your local time</span>
            <div class="help">Stored as UTC (canonical). Rendered in the viewer’s timezone.</div>
          </div>
        </div>

        <div class="actions" style="margin-top:12px">
          <button name="action" value="approve" class="secondary">Approve</button>
          <button name="action" value="deny" class="danger">Deny</button>
          <button name="action" value="queue" class="purple">Queue</button>
          <button name="action" value="complete" class="green">Complete</button>
          <button name="action" value="archive" class="secondary">Archive</button>
          <button name="action" value="unarchive" class="secondary">Unarchive</button>
        </div>

        <div class="meta" style="margin-top:10px">
          Updated: ${esc(st.updatedAt)} · By: ${esc(st.updatedBy)}
        </div>
      </form>
    </div>

    <div class="card">
      <div class="row" style="align-items:center">
        <h2 style="margin:0">Create Job (JOB_PACKET v0.01)</h2>
        <div class="meta">Creates immutable job packet + job sidecar (separate from intake)</div>
      </div>

      <form method="POST" action="/admin/job/create/${encodeURIComponent(id)}" style="margin-top:12px">
        <div class="kv">
          <div class="k">Day</div>
          <div><input type="date" name="day" required /></div>

          <div class="k">Start</div>
          <div><input type="time" name="start" required /></div>

          <div class="k">End</div>
          <div><input type="time" name="end" required /></div>
        </div>

        <div class="actions" style="margin-top:12px">
          <button class="blue" type="submit">Create Job</button>
        </div>

        <div class="help">
          Single-tech mode: one active job at a time. This will mint <span class="meta">JOB_PACKET_v0.01</span>.
        </div>
        ${(st.status === "queued" || st.status === "completed") ? `
        <div class="help" style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:10px">
          Job surface URL: <code style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:6px">/operators/qtm-detailing/jobs/?job=job_${esc(id)}</code>
        </div>` : ""}
      </form>
    </div>

    <div class="card">
      <h2 style="margin:0 0 10px">Summary</h2>
      <div class="kv">
        <div class="k">Name</div><div>${esc(String(contact?.name || "—"))}</div>
        <div class="k">Email</div><div>${esc(String(contact?.email || "—"))}</div>
        <div class="k">Method</div><div>${esc(String(contact?.method || "—"))}</div>
        <div class="k">Phone</div><div>${esc(String(contact?.phone || "—"))}</div>
        <div class="k">Asset</div><div>${esc(String(asset?.details || "—"))}</div>
        <div class="k">Tier</div><div>${esc(String(requestData?.tier || "—"))}</div>
        <div class="k">Service Area</div><div>${esc(String(requestData?.service_area || "—"))}</div>
        <div class="k">Preferred Days</div><div>${esc(String(requestData?.preferred_days || "—"))}</div>
        <div class="k">Preferred Window</div><div>${esc(String(requestData?.preferred_window || "—"))}</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 10px">Photos</h2>
      <div class="meta">Preview disabled until Step 3 media route. Showing keys only.</div>
      <div class="photos" style="margin-top:10px">
        ${photos.map((p: any) => `<div class="ph">${esc(String(p?.category || "photo"))}<br/><span class="meta">${esc(String(p?.key || ""))}</span></div>`).join("") || `<p class="muted">No photos available.</p>`}
      </div>
    </div>

    <h2>Full Submission Data</h2>
    <pre>${esc(pretty)}</pre>

    <script>
      (function(){
        const localEl = document.getElementById("scheduled_for_local");
        const utcEl = document.getElementById("scheduled_for_utc");
        const tzEl = document.getElementById("scheduled_by_tz");
        const form = document.getElementById("adminStateForm");
        if (!localEl || !utcEl || !form) return;

        // Convert UTC ISO -> datetime-local string (viewer local timezone)
        function toLocalInputValue(utcIso){
          const d = new Date(utcIso);
          if (Number.isNaN(d.getTime())) return "";
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth()+1).padStart(2,"0");
          const dd = String(d.getDate()).padStart(2,"0");
          const hh = String(d.getHours()).padStart(2,"0");
          const mi = String(d.getMinutes()).padStart(2,"0");
          return yyyy + "-" + mm + "-" + dd + "T" + hh + ":" + mi;
        }

        // On load: if we have stored UTC, show it localized to this viewer
        const storedUtc = localEl.getAttribute("data-utc") || "";
        if (storedUtc) {
          localEl.value = toLocalInputValue(storedUtc);
          utcEl.value = storedUtc; // keep canonical
        }

        // On submit: convert viewer-local datetime-local -> canonical UTC ISO
        form.addEventListener("submit", function(){
          const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "";
          if (tzEl) tzEl.value = tz;

          const v = localEl.value || "";
          if (!v) {
            utcEl.value = "";
            return;
          }
          // v is interpreted as local time in the viewer's environment
          const d = new Date(v);
          if (Number.isNaN(d.getTime())) {
            utcEl.value = "";
            return;
          }
          utcEl.value = d.toISOString();
        });
      })();
    </script>
  `;

  return page("Planck Admin", body);
};
