import { assertWritable } from "@/lib/org/accessContext";
import { badRequest } from "@/lib/org/errors";
import {
  closeSupportShare,
  correctSupportShare,
  listOwnSupportSharePage,
  notifySupportShareRecipient,
  openSupportShare,
  recallSupportShare,
  sendSupportShare
} from "@/lib/org/supportShare";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Toeavalduste rada. KÕIK toimingud on OMANIKU või SAAJA omad — siin ei ole
 * ühtegi capability-väravat, sest toeavaldus ei ole haldusobjekt.
 *
 * Juht ei saa avaldust küsida, tellida ega meelde tuletada. Ta saab ainult
 * lugeda seda, mille keegi on talle ise saatnud.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    // Omaniku enda saadetud avaldused — tema TOHIB näha lähteviidet.
    const requestUrl = new URL(request.url);
    const sentPage = await listOwnSupportSharePage(auth.userId, {
      organizationId: auth.organizationId,
      cursor: requestUrl.searchParams.get("cursor"),
      take: requestUrl.searchParams.get("take"),
      status: requestUrl.searchParams.get("status")
    });
    return orgJson({ ok: true, sentPage });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    const body = await readJsonBody(request);
    const action = String(body?.action || "send").trim();
    const membershipId = auth.context.membership?.id;

    if (action === "send") {
      const { share, recipientUserId } = await sendSupportShare({
        ownerUserId: auth.userId,
        organizationId: auth.organizationId,
        recipientMembershipId: String(body?.recipientMembershipId || "").trim(),
        snapshot: body?.snapshot,
        userConfirmed: body?.userConfirmed === true,
        sourceRecordId: body?.sourceRecordId || null,
        sourceDraftId: body?.sourceDraftId || null
      });
      /* Teavitus PÄRAST tehingut ja parim-pingutusena: teavituse tõrge ei tohi
         keerata tagasi avalduse saatmist. */
      await notifySupportShareRecipient({
        shareId: share.id,
        recipientUserId,
        organizationId: auth.organizationId
      });
      return orgJson({ ok: true, shareId: share.id }, 201);
    }

    if (action === "recall") {
      const share = await recallSupportShare(String(body?.shareId || "").trim(), {
        ownerUserId: auth.userId
      });
      return orgJson({ ok: true, status: share?.status || null });
    }

    if (action === "open") {
      const share = await openSupportShare(
        String(body?.shareId || "").trim(),
        { recipientMembershipId: membershipId }
      );
      return orgJson({ ok: true, share });
    }

    if (action === "correct") {
      const share = await correctSupportShare(String(body?.shareId || "").trim(), {
        ownerUserId: auth.userId,
        snapshot: body?.snapshot,
        userConfirmed: body?.userConfirmed === true
      });
      return orgJson({ ok: true, shareId: share.id }, 201);
    }

    if (action === "close") {
      const share = await closeSupportShare(String(body?.shareId || "").trim(), {
        recipientMembershipId: membershipId,
        actorUserId: auth.userId
      });
      return orgJson({ ok: true, share });
    }

    throw badRequest("org.errors.unknown_action");
  } catch (error) {
    return orgErrorResponse(error, "org.errors.support_share_failed", "org");
  }
}
