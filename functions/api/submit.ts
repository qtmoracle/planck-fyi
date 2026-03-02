export const onRequestPost: PagesFunction = async (ctx) => {
  try {
    const { request, env } = ctx;

    // @ts-ignore
    const bucket: R2Bucket = env.INTAKE_BUCKET;
    if (!bucket) return json({ ok: false, error: "missing_r2_binding" }, 500);

    const RESEND_API_KEY = String(env.RESEND_API_KEY || "");
    const RESEND_FROM = String(env.RESEND_FROM || "");
    const RESEND_TO = String(env.RESEND_TO || "");

    const emailEnabled = Boolean(RESEND_API_KEY && RESEND_FROM && RESEND_TO);

    const packet = await request.json().catch(() => null);
    if (!packet) return json({ ok: false, error: "invalid_json" }, 400);

    // Minimal header checks
    if (packet.v !== "0.01" || packet.kind !== "planck.intake") {
      return json({ ok: false, error: "invalid_packet_header" }, 400);
    }

    const id = String(packet.id || "").trim();
    if (!id || id.length < 8) return json({ ok: false, error: "invalid_id" }, 400);

    // Required fields
    const c = packet?.data?.contact;
    const a = packet?.data?.asset;
    const r = packet?.data?.request;
    const n = packet?.data?.notes;
    const ack = packet?.data?.ack;

    if (!c?.name || !c?.email || !c?.method) return json({ ok: false, error: "missing_contact" }, 400);
    if (!a?.class || !a?.details) return json({ ok: false, error: "missing_asset" }, 400);

    // Phase 0 backward compatible:
    // accept tier label OR tier_id (prefer both, but do not require both)
    const hasTier = Boolean(r?.tier) || Boolean(r?.tier_id);
    if (!hasTier || !r?.service_area) {
      return json({ ok: false, error: "missing_request" }, 400);
    }

    // Optional light allowlist to keep junk out (still Phase 0)
    const tierId = String(r?.tier_id || "").trim();
    const allowedTierIds = new Set(["maintenance", "correction", "reset", "recommend", ""]);
    if (tierId && !allowedTierIds.has(tierId)) {
      return json({ ok: false, error: "invalid_tier_id" }, 400);
    }

    if (!n?.condition) return json({ ok: false, error: "missing_condition_notes" }, 400);

    if (ack?.approval_gated !== true || ack?.base_rate_for_partials !== true || ack?.photo_required !== true) {
      return json({ ok: false, error: "missing_ack" }, 400);
    }

    // Photo minimum checks (2 exterior + 2 interior)
    const items = Array.isArray(packet?.photos?.items) ? packet.photos.items : [];
    const exterior = items.filter((x: any) => x?.category === "exterior");
    const interior = items.filter((x: any) => x?.category === "interior");

    if (exterior.length < 2) return json({ ok: false, error: "missing_photos_exterior" }, 400);
    if (interior.length < 2) return json({ ok: false, error: "missing_photos_interior" }, 400);

    // Write canonical packet (system of record)
    const packetKey = `planck/intake_packets/INTAKE_PACKET_v0.01/${id}.json`;
    await bucket.put(packetKey, JSON.stringify(packet, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    // Email is notification (not record)
    const subject = `Planck Intake — ${a.details} — ${r.service_area}`;
    const text = buildEmailText(packet, packetKey);

    if (emailEnabled) {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [RESEND_TO],
          subject,
          text,
        }),
      });

      if (!resp.ok) return json({ ok: false, error: "email_send_failed" }, 500);
    }

    return json({ ok: true, received: true, id, email_sent: emailEnabled }, 200);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
};

function buildEmailText(packet: any, packetKey: string) {
  const c = packet.data.contact;
  const a = packet.data.asset;
  const r = packet.data.request;
  const n = packet.data.notes;
  const p = Array.isArray(packet.photos?.items) ? packet.photos.items : [];

  const photoLines = p.map((x: any) => `- [${x.category}] ${x.key}`).join("\n");

  return [
    "PLANCK — INTAKE RECEIVED (REVIEW PENDING)",
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
    `Tier: ${r.tier || ""}`,
    `Tier ID: ${r.tier_id || ""}`,
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
    photoLines || "(none)",
  ].join("\n");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
