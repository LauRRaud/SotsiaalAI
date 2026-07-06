import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin } from "@/lib/authz";
import {
  deleteHelpOffer,
  deleteHelpRequest,
  getHelpOfferById,
  getHelpRequestById,
  toHelpListingDetailView,
  updateHelpOffer,
  updateHelpRequest
} from "@/lib/help";
import { redactPersonalData } from "@/lib/privacy/piiFilter";

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
  if (kind === "request") return updateHelpRequest(id, payload);
  if (kind === "offer") return updateHelpOffer(id, payload);
  return null;
}

async function deleteRecord(kind, id) {
  if (kind === "request") return deleteHelpRequest(id);
  if (kind === "offer") return deleteHelpOffer(id);
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

  const params = await context.params;
  const kind = normalizeKind(params?.kind);
  const id = String(params?.id || "").trim();
  const locale = String(new URL(_request.url).searchParams.get("locale") || "et").trim();
  const record = await loadRecord(kind, id);
  if (!record) {
    return json({ ok: false, message: "HELP_LISTING_NOT_FOUND" }, 404);
  }

  return json({
    ok: true,
    listing: toHelpListingDetailView(record, { kind, locale }),
    isOwn: record.userId === auth.userId,
    canDelete: record.userId === auth.userId || auth.isAdmin
  });
}

export async function PATCH(request, context) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

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
    return json({ ok: false, message: mapped.message }, mapped.status);
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
    await deleteRecord(kind, id);
  } catch (error) {
    const mapped = mapHelpRouteError(error, "HELP_LISTING_DELETE_FAILED");
    return json({ ok: false, message: mapped.message }, mapped.status);
  }
  return json({
    ok: true,
    id
  });
}
