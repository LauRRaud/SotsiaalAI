import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin } from "@/lib/authz";
import {
  consumeHelpRateLimit,
  deleteHelpOffer,
  deleteHelpRequest,
  getHelpOfferById,
  getHelpRequestById,
  loadHelpListingDetailForViewer,
  toHelpListingDetailView,
  transitionHelpOfferStatus,
  transitionHelpRequestStatus,
  updateHelpOffer,
  updateHelpRequest
} from "@/lib/help";
import { redactPersonalData } from "@/lib/privacy/piiFilter";
import { getRequestIpFromRequest } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function mapHelpRouteError(error, fallbackMessage = "HELP_LISTING_FAILED") {
  const code = String(error?.code || error?.message || "").trim();
  if (!code) {
    return {
      status: 500,
      message: fallbackMessage
    };
  }

  if (
    code === "P2025"
    || code.endsWith("_NOT_FOUND")
  ) {
    return {
      status: 404,
      message: code
    };
  }

  if (
    code.endsWith("_REQUIRED")
    || code.endsWith("_INVALID")
  ) {
    return {
      status: 400,
      message: code
    };
  }

  if (code === "HELP_LISTING_FIELD_TOO_LONG") {
    return {
      status: 413,
      message: code,
      field: error?.field || null,
      limit: Number(error?.limit) || null,
      actual: Number(error?.actual) || null
    };
  }

  if (code.endsWith("_CONFLICT")) {
    return {
      status: 409,
      message: code,
      current: error?.current || null
    };
  }

  if (code === "HELP_LISTING_FORBIDDEN") {
    return {
      status: 403,
      message: "api.common.forbidden"
    };
  }

  if (code === "HELP_LISTING_ACCEPTED_MATCH_INCONSISTENT") {
    return {
      status: 409,
      message: code
    };
  }

  return {
    status: 500,
    message: fallbackMessage
  };
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return null;
    return {
      userId: session.user.id,
      isAdmin: isAdmin(session.user)
    };
  } catch {
    return null;
  }
}

function normalizeKind(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "offer" ? "offer" : normalized === "request" ? "request" : "";
}

async function loadRecord(kind, id) {
  if (kind === "request") return getHelpRequestById(id);
  if (kind === "offer") return getHelpOfferById(id);
  return null;
}

async function updateRecord(kind, id, payload) {
  const statusAction = String(payload?.statusAction || "").trim();
  if (statusAction) {
    const allowedFields = new Set(["statusAction", "reason", "expectedUpdatedAt"]);
    if (Object.keys(payload).some((field) => !allowedFields.has(field))) {
      const error = new Error("HELP_LISTING_TRANSITION_PAYLOAD_INVALID");
      error.code = "HELP_LISTING_TRANSITION_PAYLOAD_INVALID";
      throw error;
    }
    const transitionInput = {
      action: statusAction,
      reason: payload?.reason,
      expectedUpdatedAt: payload?.expectedUpdatedAt
    };
    if (kind === "request") return transitionHelpRequestStatus(id, transitionInput);
    if (kind === "offer") return transitionHelpOfferStatus(id, transitionInput);
    return null;
  }
  if (kind === "request") return updateHelpRequest(id, payload);
  if (kind === "offer") return updateHelpOffer(id, payload);
  return null;
}

async function enforceHelpListingRateLimit(request, auth, operation) {
  try {
    const limiter = await consumeHelpRateLimit({
      operation,
      userId: auth.userId,
      ipAddress: getRequestIpFromRequest(request)
    });
    if (limiter.allowed) return null;
    return json({
      ok: false,
      message: "api.common.rate_limited",
      retryAfterSeconds: limiter.retryAfterSeconds
    }, 429);
  } catch {
    return json({ ok: false, message: "HELP_RATE_LIMIT_UNAVAILABLE" }, 503);
  }
}

function toConflictView(record, kind) {
  if (!record) return null;
  return {
    id: record.id,
    kind,
    updatedAt: record.updatedAt,
    status: record.status,
    title: record.title,
    description: record.description,
    primaryCategoryId: record.primaryCategoryId,
    municipalityId: record.municipalityId,
    mapSettings: record.mapEntry
      ? {
          mapVisible: record.mapEntry.mapVisible,
          mapMode: record.mapEntry.mapMode,
          contactMode: record.mapEntry.contactMode,
          status: record.mapEntry.status,
          serviceArea: record.mapEntry.serviceArea,
          deliveryModes: record.mapEntry.deliveryModes
        }
      : null
  };
}

async function deleteRecord(kind, id, options) {
  if (kind === "request") return deleteHelpRequest(id, options);
  if (kind === "offer") return deleteHelpOffer(id, options);
  return null;
}

const PUBLIC_LISTING_TEXT_FIELDS = [
  "title",
  "description",
  "structuredSummary",
  "roleLabel",
  "beneficiaryLabel",
  "providerScopeOrConditions",
  "availabilityOrStart",
  "compensationDetails",
  "conditions",
  "skillsOrBackground",
  "rawPlace"
];

function redactPublicListingPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const nextPayload = { ...payload };
  for (const field of PUBLIC_LISTING_TEXT_FIELDS) {
    if (typeof nextPayload[field] === "string") {
      nextPayload[field] = redactPersonalData(nextPayload[field]).redactedText;
    }
  }
  return nextPayload;
}

export async function GET(_request, context) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  const rateLimited = await enforceHelpListingRateLimit(_request, auth, "detail:get");
  if (rateLimited) return rateLimited;

  const params = await context.params;
  const locale = String(new URL(_request.url).searchParams.get("locale") || "et").trim();

  // Siduv nähtavusleping elab teenusekihis (loadHelpListingDetailForViewer):
  // omanik näeb oma kirjet igas staatuses omanikuprojektsiooniga; võõras (sh
  // ADMIN, sh anonüümne oleks) näeb ainult OPEN kirjet fail-closed avaliku
  // projektsiooniga; muu -> ühetaoline 404 (ei paljasta olemasolu ega staatust).
  const result = await loadHelpListingDetailForViewer({
    kind: params?.kind,
    id: params?.id,
    viewerId: auth.userId,
    locale
  });
  if (result.outcome !== "ok") {
    return json({ ok: false, message: "HELP_LISTING_NOT_FOUND" }, 404);
  }

  return json({
    ok: true,
    listing: result.listing,
    isOwn: result.isOwner,
    // ADMIN säilitab olemasoleva kustutamisõiguse AVALIKELE kirjetele
    // (DELETE-käsitleja jõustab selle eraldi). GET ei anna ADMIN-ile uut
    // ligipääsu mitteavaliku mustandi SISULE — see 404-b enne siia jõudmist.
    canDelete: result.isOwner || auth.isAdmin
  });
}

export async function PATCH(request, context) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }
  const rateLimited = await enforceHelpListingRateLimit(request, auth, "detail:patch");
  if (rateLimited) return rateLimited;

  const params = await context.params;
  const kind = normalizeKind(params?.kind);
  const id = String(params?.id || "").trim();
  const locale = String(new URL(request.url).searchParams.get("locale") || "et").trim();
  const existing = await loadRecord(kind, id);
  if (!existing) {
    return json({ ok: false, message: "HELP_LISTING_NOT_FOUND" }, 404);
  }
  if (existing.userId !== auth.userId) {
    return json({ ok: false, message: "api.common.forbidden" }, 403);
  }

  const payload = redactPublicListingPayload(await request.json().catch(() => ({})));
  let updated = null;
  try {
    updated = await updateRecord(kind, id, payload);
  } catch (error) {
    const mapped = mapHelpRouteError(error, "HELP_LISTING_UPDATE_FAILED");
    return json({
      ok: false,
      message: mapped.message,
      ...(mapped.field ? { field: mapped.field, limit: mapped.limit, actual: mapped.actual } : {}),
      ...(mapped.current ? { current: toConflictView(mapped.current, kind) } : {})
    }, mapped.status);
  }

  return json({
    ok: true,
    listing: toHelpListingDetailView(updated, { kind, locale }),
    isOwn: true
  });
}

export async function DELETE(_request, context) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }
  const rateLimited = await enforceHelpListingRateLimit(_request, auth, "detail:delete");
  if (rateLimited) return rateLimited;

  const params = await context.params;
  const kind = normalizeKind(params?.kind);
  const id = String(params?.id || "").trim();
  const existing = await loadRecord(kind, id);
  if (!existing) {
    return json({ ok: false, message: "HELP_LISTING_NOT_FOUND" }, 404);
  }
  if (existing.userId !== auth.userId && !auth.isAdmin) {
    return json({ ok: false, message: "api.common.forbidden" }, 403);
  }

  try {
    const result = await deleteRecord(kind, id, {
      actorUserId: auth.userId,
      isAdmin: auth.isAdmin,
      ipAddress: getRequestIpFromRequest(_request)
    });
    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    const mapped = mapHelpRouteError(error, "HELP_LISTING_DELETE_FAILED");
    return json({ ok: false, message: mapped.message }, mapped.status);
  }
}
