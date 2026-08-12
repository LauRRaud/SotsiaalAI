// SK-V1 — marsruutide jagatud kiht.
//
// Siin ühendatakse domeenikiht (`request.js`, `desk.js`) päris sessiooniga.
// Domeenikiht ise ei tea sessioonist midagi — nii saab teda testida ilma
// andmebaasi ja autentimiseta.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { UrgentRequestError } from "@/lib/urgent/request";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export function urgentJson(data, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function urgentError(messageKey, status = 400, extra = {}) {
  return urgentJson({ ok: false, message: messageKey, ...extra }, status);
}

export async function requireUrgentUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return { ok: false, status: 401, message: "api.common.unauthorized" };
    return {
      ok: true,
      userId: session.user.id,
      userRole: session.user.role,
      isAdmin: session.user.isAdmin === true
    };
  } catch {
    return { ok: false, status: 401, message: "api.common.unauthorized" };
  }
}

export async function readRequestId(paramsLike) {
  const params = await paramsLike;
  return String(params?.requestId || "").trim();
}

const STATUS_BY_CODE = new Map([
  ["urgent_request.not_found", 404],
  ["urgent_request.forbidden", 403],
  ["urgent_request.handover_target_not_found", 404],
  // Piirkond ei ole avatud. ÜKS kood väljapoole: pöördujale ei kirjeldata,
  // MIKS naabervalla laud kinni on — see ei ole tema info.
  ["urgent_request.desk_not_available", 409],
  ["urgent_request.not_sent", 409],
  ["urgent_request.not_taken", 409],
  ["urgent_request.not_actionable", 409],
  ["urgent_request.not_recallable", 409],
  ["urgent_request.already_converted", 409],
  ["urgent_request.no_handover", 409],
  ["urgent_request.handover_already_accepted", 409],
  ["urgent_request.handover_target_inactive", 409],
  // SOL-URG-08: siht on olemas ja lahti, aga ei kanna vastuvõtulubadust.
  ["urgent_request.handover_target_not_ready", 409],
  ["urgent_request.handover_target_same", 409],
  // Eluoht ei ole „viga" — ta on kavandatud tulemus. Kood on eraldi ja keha
  // kannab `emergency: true`, et klient ei saaks teda tavaveaks pidada.
  ["urgent_request.emergency_route", 409],
  /* SOL-URG-13: dubleeriv laua täisloend on eemaldatud. 410, sest rada OLI ja
     teda enam ei ole — vana klient peab saama teada, mitte saama tühja vastust. */
  ["urgent_request.desk_list_removed", 410]
]);

export function statusForUrgentError(error) {
  if (!(error instanceof UrgentRequestError)) {
    return { status: 500, message: "api.common.server_error" };
  }
  return { status: STATUS_BY_CODE.get(error.code) || 400, message: error.code };
}

export async function handleUrgentRoute(work) {
  try {
    return await work();
  } catch (error) {
    const mapped = statusForUrgentError(error);
    const extra = mapped.message === "urgent_request.emergency_route" ? { emergency: true } : {};
    return urgentError(mapped.message, mapped.status, extra);
  }
}
