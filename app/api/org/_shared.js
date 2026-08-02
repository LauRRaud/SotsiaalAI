import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import { safeError } from "@/lib/privacy/safeError";

import { resolveOrgAccessContext } from "@/lib/org/accessContext";
import { isOrgError } from "@/lib/org/errors";
import { assertOrgWorkspaceEnabled } from "@/lib/org/flags";

/**
 * T25 ORG-FOUNDATION-V1 — org-route'ide ühine väravaring.
 *
 * KOLM VÄRAVAT, alati SELLES järjekorras:
 *   1. globaalne feature-gate — väljas olles 404, mitte 403 (§10: „route failib
 *      suletult", UI ei tohi funktsiooni olemasolu reeta);
 *   2. autentimine;
 *   3. organisatsioonikontekst `resolveOrgAccessContext`-ist, kus liikmesus on
 *      päringu FILTER, mitte järelkontroll.
 *
 * Capability-kontroll on route'i enda asi (`assertCapability`), sest see sõltub
 * toimingust — aga ilma selle failita ei jõua ükski päring nii kaugele.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Pragma: "no-cache",
  Expires: "0"
};

export function orgJson(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

/**
 * Veavastus. 5xx korral EI edastata kunagi algset sõnumit — see võib sisaldada
 * andmebaasi detaile. 4xx korral edastame `messageKey`, sest see on tõlkevõti,
 * mitte sisu.
 */
export function orgErrorResponse(error, fallbackKey = "org.errors.request_failed", logLabel = "org") {
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(`[${logLabel}] request failed`, safeError(error));
  if (status >= 500) return orgJson({ ok: false, message: fallbackKey, messageKey: fallbackKey }, 500);

  const key = isOrgError(error) ? error.messageKey : fallbackKey;
  /* `messageKey` on see, mida `resolveApiMessage` tõlgib; `message` jääb kõrvale,
     sest ülejäänud koodibaas loeb ajalooliselt seda välja. Mõlemad kannavad
     TÕLKEVÕTIT, mitte teksti — veateade ei tohi kunagi kanda serveri sisu. */
  const payload = { ok: false, message: key, messageKey: key };
  if (error?.details) payload.details = error.details;
  return orgJson(payload, status);
}

/** Autenditud kasutaja ILMA organisatsioonikontekstita (nt `/api/org` loend). */
export async function requireOrgUser(request) {
  try {
    assertOrgWorkspaceEnabled();
  } catch (error) {
    return { ok: false, response: orgErrorResponse(error, "org.errors.not_found") };
  }

  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) {
    return { ok: false, response: orgJson({ ok: false, message: "api.common.unauthorized" }, 401) };
  }

  const roleState = resolveSessionRoleState(session, request.cookies);
  return {
    ok: true,
    session,
    userId,
    userEmail: String(session?.user?.email || "").trim().toLowerCase(),
    roleState
  };
}

export async function readParam(context, key) {
  const params = await context?.params;
  return String(params?.[key] || "").trim();
}

/**
 * Autenditud kasutaja KOOS organisatsioonikontekstiga.
 *
 * `orgId` tuleb URL-ist, aga see on ainult päringu SIHT — `resolveOrgAccessContext`
 * tõendab liikmesuse iga kord uuesti ja viskab 404, kui kasutaja ei ole liige
 * (arenduskava §6). Võõras ja olematu organisatsioon on eristamatud.
 */
export async function requireOrgContext(request, context, { key = "orgId" } = {}) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth;

  const organizationId = await readParam(context, key);
  try {
    const orgContext = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
    return { ...auth, ok: true, organizationId, context: orgContext };
  } catch (error) {
    return { ok: false, response: orgErrorResponse(error, "org.errors.not_found") };
  }
}

export async function readJsonBody(request) {
  return request.json().catch(() => ({}));
}
