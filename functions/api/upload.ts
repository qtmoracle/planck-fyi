export const onRequestPut: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore - bind this in Cloudflare as INTAKE_BUCKET
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return json({ ok: false, error: "missing_r2_binding" }, 500);

    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "";
    const mime = url.searchParams.get("mime") || request.headers.get("content-type") || "application/octet-stream";
    const bytesParam = Number(url.searchParams.get("bytes") || 0);

    if (!key || key.length < 10) return json({ ok: false, error: "invalid_key" }, 400);
    if (!mime.startsWith("image/")) return json({ ok: false, error: "invalid_mime" }, 400);

    const body = request.body;
    if (!body) return json({ ok: false, error: "missing_body" }, 400);

    // Optional size guard (best-effort)
    if (Number.isFinite(bytesParam) && bytesParam > 20_000_000) {
      return json({ ok: false, error: "too_large" }, 413);
    }

    // Write to R2
    await bucket.put(key, body, {
      httpMetadata: { contentType: mime },
    });

    return json({ ok: true, key }, 200);
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
