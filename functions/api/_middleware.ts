// functions/api/_middleware.ts
// CORS + preflight handler for /api/*
// Needed because operator surface (5173) calls Pages Functions (8788) with x-tech-token.

function corsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";

  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");

  // allow the tech token header + standard headers
  h.set("Access-Control-Allow-Headers", "x-tech-token, content-type, accept");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  h.set("Access-Control-Max-Age", "86400");

  // Only needed if you ever use cookies/credentials (you currently don't)
  // h.set("Access-Control-Allow-Credentials", "true");

  return h;
}

export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx;

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // Pass-through, but attach CORS headers to all API responses
  const res = await ctx.next();
  const h = new Headers(res.headers);

  const cors = corsHeaders(request);
  cors.forEach((v, k) => h.set(k, v));

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};
