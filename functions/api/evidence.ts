// functions/api/evidence.ts
// GET /api/evidence?key=<r2-key>
// Auth: x-tech-token header (same gate as all job endpoints)
//
// Proxies R2 image bytes to the browser so <img> thumbnails can be rendered
// on the execution surface without a public bucket or signed URLs.
// Only allows keys under planck/intake/ to prevent arbitrary R2 access.

import { checkTechAuth } from "./job/_lib";

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    const authError = checkTechAuth(request, env);
    if (authError) return authError;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return new Response("R2 binding missing", { status: 500 });

    const url = new URL(request.url);
    const key = decodeURIComponent(url.searchParams.get("key") || "");

    // Only allow intake image paths — block arbitrary key traversal
    if (!key || !key.startsWith("planck/intake/") || key.includes("..")) {
      return new Response("Invalid key", { status: 400 });
    }

    const obj = await bucket.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const contentType = obj.httpMetadata?.contentType || "image/jpeg";

    return new Response(obj.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Server error", { status: 500 });
  }
};
