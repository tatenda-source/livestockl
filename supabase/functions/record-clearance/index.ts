// record-clearance
//
// Logs a regulatory clearance event for a livestock item (digitizing the
// physical "policewoman clears the cattle" gate observed at real auctions)
// and, when approved, advances the ownership-transition state machine.
//
// Conventions (project-enforced, do NOT regress):
//   - Malformed JSON → 400 (not 500). Cf. commit 567fcee.
//   - No `stack` / inner-exception text leaked in error responses.
//   - CORS: explicit ALLOWED_ORIGIN allowlist, no wildcard fallback.
//   - Idempotency: (livestock_id, idempotency_key) uniqueness — if a caller
//     resubmits with the same key, return the prior row instead of inserting.
//   - Service-role client used only for the write (clearance_events has
//     service-role-only INSERT per the new RLS). Reads + auth use the
//     caller's JWT via anon-key client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

// ─── CORS (mirrors initiate-payment / poll-payment exactly) ────────────────

const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGIN") || "";
const allowedOrigins = allowedOriginsEnv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function pickAllowedOrigin(req: Request): string | null {
  if (allowedOrigins.length === 0) return null;
  const origin = req.headers.get("origin");
  if (!origin) return allowedOrigins[0];
  return allowedOrigins.includes(origin) ? origin : null;
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = pickAllowedOrigin(req);
  return {
    "Access-Control-Allow-Origin": origin ?? "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function isOriginAllowed(req: Request): boolean {
  return pickAllowedOrigin(req) !== null;
}

let _currentReq: Request | null = null;
function jsonResponse(data: Record<string, unknown>, status = 200) {
  const cors = _currentReq ? buildCorsHeaders(_currentReq) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ─── Validation helpers ────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["pending", "approved", "blocked"]);

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function isNonEmptyString(v: unknown, max = 500): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

// ─── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  _currentReq = req;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!isOriginAllowed(req)) {
    // Deliberate: no CORS headers on rejection (matches initiate-payment).
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const log = createLogger("record-clearance", req);

  try {
    // ── Parse body. Malformed JSON must be 400, not 500. ─────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    // ── Validate input ────────────────────────────────────────────────────
    const {
      livestock_id,
      bid_id,
      status,
      officer_name,
      officer_badge,
      district,
      notes,
      idempotency_key,
    } = body;

    if (!isUuid(livestock_id)) {
      return jsonResponse({ error: "Invalid or missing livestock_id" }, 400);
    }
    if (bid_id !== null && bid_id !== undefined && !isUuid(bid_id)) {
      return jsonResponse({ error: "Invalid bid_id" }, 400);
    }
    if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
      return jsonResponse({ error: "Invalid status (must be pending|approved|blocked)" }, 400);
    }
    if (!isNonEmptyString(officer_name, 200)) {
      return jsonResponse({ error: "Invalid or missing officer_name" }, 400);
    }
    if (officer_badge !== undefined && officer_badge !== null && !isNonEmptyString(officer_badge, 100)) {
      return jsonResponse({ error: "Invalid officer_badge" }, 400);
    }
    if (district !== undefined && district !== null && !isNonEmptyString(district, 120)) {
      return jsonResponse({ error: "Invalid district" }, 400);
    }
    if (notes !== undefined && notes !== null && !isNonEmptyString(notes, 2000)) {
      return jsonResponse({ error: "Invalid notes" }, 400);
    }
    if (idempotency_key !== undefined && idempotency_key !== null && !isUuid(idempotency_key)) {
      return jsonResponse({ error: "Invalid idempotency_key" }, 400);
    }

    // ── Auth: verify the caller owns a JWT ───────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !callerUser) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ── Service-role client for privileged reads/writes ──────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch listing to determine seller_id
    const { data: listing, error: listingErr } = await svc
      .from("livestock_items")
      .select("id, seller_id")
      .eq("id", livestock_id)
      .maybeSingle();

    if (listingErr || !listing) {
      return jsonResponse({ error: "Livestock not found" }, 404);
    }

    // Authorization: caller must be seller, OR winning bidder on the referenced bid.
    let authorized = callerUser.id === listing.seller_id;

    if (!authorized && bid_id) {
      const { data: bidRow } = await svc
        .from("bids")
        .select("id, user_id, livestock_id, is_winner")
        .eq("id", bid_id)
        .maybeSingle();

      if (
        bidRow &&
        bidRow.livestock_id === livestock_id &&
        bidRow.user_id === callerUser.id &&
        bidRow.is_winner === true
      ) {
        authorized = true;
      }
    }

    if (!authorized) {
      return jsonResponse({ error: "Forbidden: not seller or winning bidder" }, 403);
    }

    // ── Idempotency: short-circuit if key already used on this livestock ─
    if (idempotency_key) {
      const { data: existing } = await svc
        .from("clearance_events")
        .select("id, status")
        .eq("livestock_id", livestock_id)
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existing) {
        log.info("Idempotent replay — returning existing clearance", {
          livestockId: livestock_id,
          clearanceId: existing.id,
        });
        return jsonResponse({
          clearance_id: existing.id,
          transition_id: null,
          status: existing.status,
          idempotent: true,
        });
      }
    }

    // ── Insert clearance_events row ──────────────────────────────────────
    const insertPayload: Record<string, unknown> = {
      livestock_id,
      bid_id: bid_id ?? null,
      status,
      officer_name,
      officer_badge: officer_badge ?? null,
      district: district ?? null,
      notes: notes ?? null,
      metadata: {
        recorded_by: callerUser.id,
        caller_role: callerUser.id === listing.seller_id ? "seller" : "winning_bidder",
      },
    };
    if (idempotency_key) insertPayload.idempotency_key = idempotency_key;

    const { data: clearance, error: insertErr } = await svc
      .from("clearance_events")
      .insert(insertPayload)
      .select("id, status")
      .single();

    if (insertErr || !clearance) {
      log.error("Failed to insert clearance_events", {
        livestockId: livestock_id,
        error: insertErr?.message,
      });
      return jsonResponse({ error: "Failed to record clearance" }, 500);
    }

    // ── Ownership-transition hop ─────────────────────────────────────────
    // Approved → "cleared" (forward). Pending/blocked → log "auctioned" (no forward move).
    const transitionState = status === "approved" ? "cleared" : "auctioned";
    const transitionEvent = status === "approved"
      ? "clearance_approved"
      : status === "blocked"
        ? "clearance_blocked"
        : "clearance_pending";

    let transitionId: string | null = null;
    try {
      const { data: rpcData, error: rpcErr } = await (svc.rpc as any)(
        "record_ownership_transition",
        {
          p_livestock_id: livestock_id,
          p_state: transitionState,
          p_event: transitionEvent,
          p_bid_id: bid_id ?? null,
          p_clearance_id: clearance.id,
        },
      );

      if (rpcErr) {
        log.warn("record_ownership_transition RPC failed", {
          livestockId: livestock_id,
          clearanceId: clearance.id,
          error: rpcErr.message,
        });
      } else if (typeof rpcData === "string") {
        transitionId = rpcData;
      } else if (rpcData && typeof rpcData === "object" && "id" in rpcData) {
        transitionId = (rpcData as { id: string }).id;
      }
    } catch (rpcThrow) {
      log.warn("record_ownership_transition RPC threw", {
        livestockId: livestock_id,
        error: (rpcThrow as Error).message,
      });
    }

    log.info("Clearance recorded", {
      livestockId: livestock_id,
      clearanceId: clearance.id,
      status: clearance.status,
      transitionId,
    });

    return jsonResponse({
      clearance_id: clearance.id,
      transition_id: transitionId,
      status: clearance.status,
    }, 201);
  } catch (err) {
    // Deliberately do NOT surface err.message / err.stack to the client.
    // Log server-side; return a generic message.
    log.error("record-clearance unhandled error", {
      error: (err as Error).message,
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
