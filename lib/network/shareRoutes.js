// COLLAB-P4 — marsruutide jagatud kiht.
//
// Siin ühendatakse domeenikiht (`share.js`) päris sessiooni, päris
// raamlepinguga ja päris ruumiga. Domeenikiht ise ei tea neist midagi — ta
// võtab pordid, et teda saaks testida ilma andmebaasita.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkerFrameworkAcceptanceStatus } from "@/lib/frameworkAcceptances/server";
import { NetworkShareError } from "@/lib/network/share";
import { createRoomForNetworkShare } from "@/lib/network/shareRoom";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export function shareJson(data, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function shareError(messageKey, status = 400) {
  return shareJson({ ok: false, message: messageKey }, status);
}

export async function requireShareUser() {
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

// Võrgustikujagamist saab koostada ainult see, kes teeb sotsiaaltööd või osutab
// teenust — mitte iga kasutaja.
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

export function isNetworkWorker(auth) {
  return Boolean(auth?.isAdmin) || WORKER_ROLES.has(String(auth?.userRole || ""));
}

export async function readShareId(paramsLike) {
  const params = await paramsLike;
  return String(params?.shareId || "").trim();
}

/**
 * O-CO-6 port päris kujul: kas sellel inimesel on kehtiv allkirjastatud
 * raamleping (`WORKER_DATA_PROCESSING`)?
 *
 * Seda kasutatakse AINULT välise kliendi rajal. Kontoga kliendi puhul ei küsita
 * seda kordagi — muidu blokeeriks värav ka seal, kus ta ei kohaldu.
 */
export async function hasFrameworkAcceptance(userId) {
  if (!userId) return false;
  const status = await getCurrentWorkerFrameworkAcceptanceStatus(userId);
  return Boolean(status?.accepted);
}

/**
 * Ruumi avamise port `sendNetworkShare`-i jaoks.
 *
 * `db` TULEB KUTSUJALT, mitte moodulist (SOL-NET-02/-03): saatmine avab
 * tehingu ja ruum peab sündima SELLE sees. Vana kuju kasutas alati globaalset
 * klienti, seega ruum commit'is end ise ka siis, kui jagamise enda kirjutus
 * hiljem kukkus või võistluse kaotas — alles jäi orb ruum liikmetega.
 */
export function createRoomPort() {
  return ({ share, db }) => createRoomForNetworkShare({ share, db: db || prisma });
}

const STATUS_BY_CODE = new Map([
  ["network_share.not_found", 404],
  ["network_share.source_not_found", 404],
  ["network_share.forbidden", 403],
  ["network_share.source_forbidden", 403],
  ["network_share.client_must_confirm_themselves", 403],
  ["network_share.client_is_external", 403],
  ["network_share.worker_framework_agreement_required", 403],
  ["network_share.recipient_framework_agreement_required", 403],
  ["network_share.framework_check_unavailable", 503],
  ["network_share.client_confirmation_required", 409],
  ["network_share.not_awaiting_client", 409],
  ["network_share.not_draft", 409],
  ["network_share.not_editable", 409],
  ["network_share.not_sent", 409],
  ["network_share.not_recallable", 409],
  /* SOL-NET-01/-02 võistluste vastused. Kõik kolm on 409: klient ei teinud
     midagi valesti, vaid keegi teine jõudis ette. 409 ütleb „proovi uuesti
     värske vaatega", 400 ütleks „sinu päring on katki". */
  ["network_share.content_changed", 409],
  ["network_share.concurrent_change", 409],
  ["network_share.confirmation_stale", 409]
]);

export function statusForShareError(error) {
  if (!(error instanceof NetworkShareError)) {
    return { status: 500, message: "api.common.server_error" };
  }
  // Vaikimisi 400: ülejäänud koodid on sisendivead (puuduv väli, vale otsus,
  // minevikku jääv lõppkuupäev).
  return { status: STATUS_BY_CODE.get(error.code) || 400, message: error.code };
}

export async function handleShareRoute(work) {
  try {
    return await work();
  } catch (error) {
    const mapped = statusForShareError(error);
    return shareError(mapped.message, mapped.status);
  }
}

/**
 * Töötaja täisvaade. Sisaldab kliendi identiteeti ja kinnituse tõendiväärtust —
 * seda kuju EI TOHI kunagi saajale saata (saajal on `recipientProjection`).
 */
export function workerProjection(share) {
  if (!share) return null;
  return {
    id: share.id,
    sourcePreInquiryId: share.sourcePreInquiryId,
    clientUserId: share.clientUserId,
    clientDisplayName: share.clientDisplayName,
    clientExternalRef: share.clientExternalRef,
    clientIsExternal: !share.clientUserId,
    recipientUserId: share.recipientUserId,
    summaryText: share.summaryText,
    purpose: share.purpose,
    sharingBoundary: share.sharingBoundary,
    participationEndsOn: share.participationEndsOn,
    /* Räsi käib vaatega kaasa, et otsustaja saaks ta kinnitusega tagasi saata
       (`expectedContentHash`). Ta ei ole sisu — ta on TÕEND selle kohta,
       millist sisu vaadati. */
    contentHash: share.contentHash,
    confirmedContentHash: share.confirmedContentHash,
    status: share.status,
    clientConfirmedAt: share.clientConfirmedAt,
    clientDeclinedAt: share.clientDeclinedAt,
    clientDecisionNote: share.clientDecisionNote,
    clientConfirmationMethod: share.clientConfirmationMethod,
    clientConfirmationAttestedById: share.clientConfirmationAttestedById,
    sentAt: share.sentAt,
    openedAt: share.openedAt,
    recalledAt: share.recalledAt,
    roomId: share.roomId
  };
}
