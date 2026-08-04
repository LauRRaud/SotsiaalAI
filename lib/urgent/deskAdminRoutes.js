// SK-V1 E2 — admini marsruutide jagatud kiht.

import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { UrgentDeskError } from "@/lib/urgent/deskAdmin";

export { json as deskJson };

export async function requireDeskAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  return assertAdmin(session);
}

export async function readDeskId(paramsLike) {
  const params = await paramsLike;
  return String(params?.deskId || "").trim();
}

const STATUS_BY_CODE = new Map([
  ["urgent_desk.not_found", 404],
  ["urgent_desk.municipality_not_found", 404],
  ["urgent_desk.member_not_found", 404],
  ["urgent_desk.member_not_a_user", 404],
  ["urgent_desk.already_exists", 409],
  // Ei ole „viga" vaid seisund: laud ei ole veel valmis avanema. Keha kannab
  // põhjuste loendi, sest admin peab nägema, MIS on puudu.
  ["urgent_desk.not_ready", 409]
]);

export function statusForDeskError(error) {
  if (!(error instanceof UrgentDeskError)) {
    return { status: 500, message: "api.common.server_error" };
  }
  return { status: STATUS_BY_CODE.get(error.code) || 400, message: error.code };
}

export async function handleDeskRoute(request, work) {
  const locale = localeFromRequest(request);
  try {
    return await work();
  } catch (error) {
    const mapped = statusForDeskError(error);
    const extras = Array.isArray(error?.reasons) ? { reasons: error.reasons } : {};
    return errorJson(mapped.message, mapped.status, locale, extras);
  }
}

export function deskAuthError(authz, request) {
  return errorJson(authz.message, authz.status || 403, localeFromRequest(request));
}
