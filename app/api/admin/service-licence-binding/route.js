import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { BINDING_ERROR, bindServiceKey, bindingCandidates } from "@/lib/mtr/serviceBinding";
import { LICENSED_SERVICES, NON_LICENSED_SERVICES } from "@/lib/mtr/licensedServices";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* A4 — teenuse sidumine loakataloogiga. AINULT admin: seos määrab, mida
   avalik usaldusmärgis ütleb, ja vale seos annab vale märgise. */
async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) return { ok: false, status: 401, message: "api.common.unauthorized" };
  if (!isAdmin(session.user)) return { ok: false, status: 403, message: "api.common.forbidden" };
  return { ok: true, userId: String(session.user.id) };
}

function catalogue() {
  return [...LICENSED_SERVICES, ...NON_LICENSED_SERVICES].map((row) => ({
    serviceKey: row.key,
    label: row.label,
    legalBasis: row.legalBasis,
    legalNote: row.legalNote || null,
    activity: row.activity?.label || null,
    activityType: row.activityType || null,
    granularity: row.granularity || null,
    otherVerification: row.otherVerification || null
  }));
}

/** Kataloog + kandidaadid ühe teenuse kohta. Kandidaat on ETTEPANEK. */
export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireAdmin();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  const providerServiceId = new URL(request.url).searchParams.get("providerServiceId") || "";
  try {
    if (!providerServiceId) return json({ ok: true, catalogue: catalogue(), candidates: [] });

    const result = await bindingCandidates({ providerServiceId });
    if (!result.ok) return errorJson("service_provider_profile.errors.load_failed", 404, locale);
    return json({ ok: true, catalogue: catalogue(), service: result.service, candidates: result.candidates });
  } catch (error) {
    console.error("[mtr-binding] candidates failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireAdmin();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const body = await request.json().catch(() => ({}));
    const providerServiceId = String(body?.providerServiceId || "").trim();
    if (!providerServiceId) return errorJson("service_provider_profile.errors.save_failed", 400, locale);

    const result = await bindServiceKey({
      providerServiceId,
      /* `null` on lubatud väärtus: see lahutab teenuse kataloogist. */
      serviceKey: body?.serviceKey ?? null,
      actorUserId: auth.userId
    });

    if (!result.ok) {
      const status = result.error === BINDING_ERROR.SERVICE_NOT_FOUND ? 404 : 400;
      return json({ ok: false, error: result.error }, status);
    }

    return json({
      ok: true,
      changed: result.changed,
      providerServiceId: result.providerServiceId,
      previousServiceKey: result.previousServiceKey ?? null,
      serviceKey: result.serviceKey,
      /* Sidumise järel käivitub kohe kontroll — liides ei pea seda ise
         käivitama ega kasutaja järgmist korjet ootama. */
      check: result.check ? { completed: result.check.completed, succeeded: result.check.succeeded } : null
    });
  } catch (error) {
    console.error("[mtr-binding] bind failed", safeError(error));
    return errorJson("service_provider_profile.errors.save_failed", 500, locale);
  }
}
