export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore - bind this in Cloudflare as INTAKE_BUCKET
    const bucket: R2Bucket = env.INTAKE_BUCKET;

    // If binding is missing, fail loudly.
    if (!bucket) return json({ ok: false, error: "missing_r2_binding" }, 500);

    const body = await request.json().catch(() => null);
    const intake_id = String(body?.intake_id || "").trim();
    const category = String(body?.category || "").trim(); // "exterior" | "interior"
    const filename = String(body?.filename || "").trim();
    const mime = String(body?.mime || "").trim();
    const bytes = Number(body?.bytes || 0);

    if (!intake_id || intake_id.length < 8) return json({ ok: false, error: "invalid_intake_id" }, 400);
    if (category !== "exterior" && category !== "interior") return json({ ok: false, error: "invalid_category" }, 400);
    if (!filename || filename.length > 160) return json({ ok: false, error: "invalid_filename" }, 400);
    if (!mime.startsWith("image/")) return json({ ok: false, error: "invalid_mime" }, 400);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 20_000_000) return json({ ok: false, error: "invalid_size" }, 400);

    const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 120);

    // Use timestamp prefix to prevent collisions
    const key = `planck/intake/${intake_id}/${category}/${Date.now()}_${safeName}`;

    // Same-origin upload URL (handled by /api/upload PUT)
    const uploadUrl = `/api/upload?key=${encodeURIComponent(key)}&mime=${encodeURIComponent(mime)}&bytes=${encodeURIComponent(
      String(bytes)
    )}`;

    return json({ ok: true, key, uploadUrl }, 200);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
