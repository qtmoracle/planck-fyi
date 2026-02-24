var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-FCNWG7/functionsWorker-0.2126577121079698.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Planck Admin"' }
  });
}
__name(unauthorized, "unauthorized");
__name2(unauthorized, "unauthorized");
function checkAuth(req, user, pass) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  const raw = h.slice(6).trim();
  let decoded = "";
  try {
    decoded = atob(raw);
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return u === user && p === pass;
}
__name(checkAuth, "checkAuth");
__name2(checkAuth, "checkAuth");
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(esc, "esc");
__name2(esc, "esc");
function page(title, body) {
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
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
__name(page, "page");
__name2(page, "page");
var onRequestGet = /* @__PURE__ */ __name2(async (ctx) => {
  const { request, env, params } = ctx;
  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized();
  if (!checkAuth(request, ADMIN_USER, ADMIN_PASS)) return unauthorized();
  const id = String(params?.id || "").trim();
  if (!id) return page("Planck Admin", `<p class="muted">Missing id.</p>`);
  const bucket = env.INTAKE_BUCKET;
  if (!bucket) return page("Planck Admin", `<p class="muted">missing INTAKE_BUCKET binding</p>`);
  const key = `planck/intake_packets/INTAKE_PACKET_v0.01/${id}.json`;
  const obj = await bucket.get(key);
  if (!obj) {
    return page("Planck Admin", `<p class="muted">Not found.</p><p><a href="/admin">\u2190 Back</a></p>`);
  }
  const txt = await obj.text();
  let pretty = txt;
  try {
    pretty = JSON.stringify(JSON.parse(txt), null, 2);
  } catch {
  }
  const packet = JSON.parse(txt);
  const photos = packet?.photos?.items || [];
  const photoPreviews = photos.map((photo) => {
    const photoUrl = `https://your-cf-r2-url/${photo.key}`;
    return `<img src="${photoUrl}" alt="photo" />`;
  }).join("");
  const body = `
    <div class="row">
      <h1>Intake Packet</h1>
      <div class="meta">${esc(key)}</div>
    </div>
    <p><a href="/admin">\u2190 Back to list</a></p>
    <h2>Photos:</h2>
    <div class="photos">
      ${photoPreviews || "<p>No photos available.</p>"}
    </div>
    <h2>Full Submission Data:</h2>
    <pre>${esc(pretty)}</pre>
  `;
  return page("Planck Admin", body);
}, "onRequestGet");
var onRequestPost = /* @__PURE__ */ __name2(async (ctx) => {
  try {
    const { request, env } = ctx;
    const bucket = env.INTAKE_BUCKET;
    if (!bucket) return json({ ok: false, error: "missing_r2_binding" }, 500);
    const RESEND_API_KEY = String(env.RESEND_API_KEY || "");
    const RESEND_FROM = String(env.RESEND_FROM || "");
    const RESEND_TO = String(env.RESEND_TO || "");
    const emailEnabled = Boolean(RESEND_API_KEY && RESEND_FROM && RESEND_TO);
    const packet = await request.json().catch(() => null);
    if (!packet) return json({ ok: false, error: "invalid_json" }, 400);
    if (packet.v !== "0.01" || packet.kind !== "planck.intake") {
      return json({ ok: false, error: "invalid_packet_header" }, 400);
    }
    const id = String(packet.id || "").trim();
    if (!id || id.length < 8) return json({ ok: false, error: "invalid_id" }, 400);
    const c = packet?.data?.contact;
    const a = packet?.data?.asset;
    const r = packet?.data?.request;
    const n = packet?.data?.notes;
    const ack = packet?.data?.ack;
    if (!c?.name || !c?.email || !c?.method) return json({ ok: false, error: "missing_contact" }, 400);
    if (!a?.class || !a?.details) return json({ ok: false, error: "missing_asset" }, 400);
    if (!r?.tier || !r?.service_area) return json({ ok: false, error: "missing_request" }, 400);
    if (!n?.condition) return json({ ok: false, error: "missing_condition_notes" }, 400);
    if (ack?.approval_gated !== true || ack?.base_rate_for_partials !== true || ack?.photo_required !== true) {
      return json({ ok: false, error: "missing_ack" }, 400);
    }
    const items = Array.isArray(packet?.photos?.items) ? packet.photos.items : [];
    const exterior = items.filter((x) => x?.category === "exterior");
    const interior = items.filter((x) => x?.category === "interior");
    if (exterior.length < 2) return json({ ok: false, error: "missing_photos_exterior" }, 400);
    if (interior.length < 2) return json({ ok: false, error: "missing_photos_interior" }, 400);
    const packetKey = `planck/intake_packets/INTAKE_PACKET_v0.01/${id}.json`;
    await bucket.put(packetKey, JSON.stringify(packet, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" }
    });
    const subject = `Planck Intake \u2014 ${a.details} \u2014 ${r.service_area}`;
    const text = buildEmailText(packet, packetKey);
    if (emailEnabled) {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [RESEND_TO],
          subject,
          text
        })
      });
      if (!resp.ok) return json({ ok: false, error: "email_send_failed" }, 500);
    }
    return json({ ok: true, received: true, id, email_sent: emailEnabled }, 200);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
}, "onRequestPost");
function buildEmailText(packet, packetKey) {
  const c = packet.data.contact;
  const a = packet.data.asset;
  const r = packet.data.request;
  const n = packet.data.notes;
  const p = Array.isArray(packet.photos?.items) ? packet.photos.items : [];
  const photoLines = p.map((x) => `- [${x.category}] ${x.key}`).join("\n");
  return [
    "PLANCK \u2014 INTAKE RECEIVED (REVIEW PENDING)",
    "",
    `Packet: ${packetKey}`,
    "",
    "CONTACT",
    `Name: ${c.name}`,
    `Method: ${c.method}`,
    `Email: ${c.email}`,
    `Phone: ${c.phone || ""}`,
    "",
    "ASSET",
    `Class: ${a.class}`,
    `Details: ${a.details}`,
    "",
    "REQUEST",
    `Tier: ${r.tier}`,
    `Service area: ${r.service_area}`,
    `Preferred days: ${r.preferred_days || ""}`,
    `Preferred window: ${r.preferred_window || ""}`,
    "",
    "CONDITION",
    `${n.condition}`,
    "",
    "ACCESS",
    `${n.access || ""}`,
    "",
    "PHOTOS (R2 KEYS)",
    photoLines || "(none)"
  ].join("\n");
}
__name(buildEmailText, "buildEmailText");
__name2(buildEmailText, "buildEmailText");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json, "json");
__name2(json, "json");
var onRequestPut = /* @__PURE__ */ __name2(async (ctx) => {
  try {
    const { request, env } = ctx;
    const bucket = env.INTAKE_BUCKET;
    if (!bucket) return json2({ ok: false, error: "missing_r2_binding" }, 500);
    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "";
    const mime = url.searchParams.get("mime") || request.headers.get("content-type") || "application/octet-stream";
    const bytesParam = Number(url.searchParams.get("bytes") || 0);
    if (!key || key.length < 10) return json2({ ok: false, error: "invalid_key" }, 400);
    if (!mime.startsWith("image/")) return json2({ ok: false, error: "invalid_mime" }, 400);
    const body = request.body;
    if (!body) return json2({ ok: false, error: "missing_body" }, 400);
    if (Number.isFinite(bytesParam) && bytesParam > 2e7) {
      return json2({ ok: false, error: "too_large" }, 413);
    }
    await bucket.put(key, body, {
      httpMetadata: { contentType: mime }
    });
    return json2({ ok: true, key }, 200);
  } catch {
    return json2({ ok: false, error: "server_error" }, 500);
  }
}, "onRequestPut");
function json2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json2, "json2");
__name2(json2, "json");
var onRequestPost2 = /* @__PURE__ */ __name2(async (ctx) => {
  try {
    const { request, env } = ctx;
    const bucket = env.INTAKE_BUCKET;
    if (!bucket) return json3({ ok: false, error: "missing_r2_binding" }, 500);
    const body = await request.json().catch(() => null);
    const intake_id = String(body?.intake_id || "").trim();
    const category = String(body?.category || "").trim();
    const filename = String(body?.filename || "").trim();
    const mime = String(body?.mime || "").trim();
    const bytes = Number(body?.bytes || 0);
    if (!intake_id || intake_id.length < 8) return json3({ ok: false, error: "invalid_intake_id" }, 400);
    if (category !== "exterior" && category !== "interior") return json3({ ok: false, error: "invalid_category" }, 400);
    if (!filename || filename.length > 160) return json3({ ok: false, error: "invalid_filename" }, 400);
    if (!mime.startsWith("image/")) return json3({ ok: false, error: "invalid_mime" }, 400);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 2e7) return json3({ ok: false, error: "invalid_size" }, 400);
    const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 120);
    const key = `planck/intake/${intake_id}/${category}/${Date.now()}_${safeName}`;
    const uploadUrl = `/api/upload?key=${encodeURIComponent(key)}&mime=${encodeURIComponent(mime)}&bytes=${encodeURIComponent(
      String(bytes)
    )}`;
    return json3({ ok: true, key, uploadUrl }, 200);
  } catch {
    return json3({ ok: false, error: "server_error" }, 500);
  }
}, "onRequestPost");
function json3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json3, "json3");
__name2(json3, "json");
function unauthorized2() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Planck Admin"' }
  });
}
__name(unauthorized2, "unauthorized2");
__name2(unauthorized2, "unauthorized");
function checkAuth2(req, user, pass) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  const raw = h.slice(6).trim();
  let decoded = "";
  try {
    decoded = atob(raw);
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return u === user && p === pass;
}
__name(checkAuth2, "checkAuth2");
__name2(checkAuth2, "checkAuth");
function esc2(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(esc2, "esc2");
__name2(esc2, "esc");
function page2(title, body) {
  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc2(title)}</title>
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
</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
__name(page2, "page2");
__name2(page2, "page");
var onRequestGet2 = /* @__PURE__ */ __name2(async (ctx) => {
  const { request, env } = ctx;
  const ADMIN_USER = String(env.ADMIN_USER || "");
  const ADMIN_PASS = String(env.ADMIN_PASS || "");
  if (!ADMIN_USER || !ADMIN_PASS) return unauthorized2();
  if (!checkAuth2(request, ADMIN_USER, ADMIN_PASS)) return unauthorized2();
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";
  const serviceType = searchParams.get("service_type") || "";
  const serviceArea = searchParams.get("service_area") || "";
  const bucket = env.INTAKE_BUCKET;
  if (!bucket) return page2("Planck Admin", `<p class="muted">missing INTAKE_BUCKET binding</p>`);
  const prefix = "planck/intake_packets/INTAKE_PACKET_v0.01/";
  const list = await bucket.list({ prefix, limit: 50 });
  const objs = list.objects.filter((obj) => {
    if (!obj.uploaded) return true;
    const uploadedDate = obj.uploaded;
    return (!fromDate || uploadedDate >= new Date(fromDate)) && (!toDate || uploadedDate <= new Date(toDate));
  }).filter((obj) => {
    if (!serviceType && !serviceArea) return true;
    return obj.key.includes(serviceType) && obj.key.includes(serviceArea);
  }).sort((a, b) => (b.uploaded?.getTime() || 0) - (a.uploaded?.getTime() || 0));
  const rows = [];
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
        photos: packet?.photos?.items || []
      };
    } catch {
    }
    const date = summary.ts ? esc2(summary.ts) : obj.uploaded ? esc2(obj.uploaded.toISOString()) : "";
    rows.push(`
      <tr>
        <td class="small">${date}</td>
        <td>${esc2(summary.name || "\u2014")}</td>
        <td>${esc2(summary.asset || "\u2014")}</td>
        <td><span class="pill">${esc2(summary.tier || "\u2014")}</span></td>
        <td>${esc2(summary.area || "\u2014")}</td>
        <td><a href="/admin/intake/${encodeURIComponent(id)}">Open</a></td>
        <td>
          ${summary.photos.map((photo) => `<img src="https://your-cf-r2-url/${photo.key}" width="40" />`).join("")}
        </td>
      </tr>
    `);
  }
  const body = `
    <div class="top">
      <h1>Planck Admin \u2014 Intake Submissions</h1>
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
  return page2("Planck Admin", body);
}, "onRequestGet");
var routes = [
  {
    routePath: "/admin/intake/:id",
    mountPath: "/admin/intake",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/submit",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/upload",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/upload-url",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/admin",
    mountPath: "/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-WZpBR4/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-WZpBR4/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.2126577121079698.js.map
