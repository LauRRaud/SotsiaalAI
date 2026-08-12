import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { badRequest } from "@/lib/org/errors";
import {
  addSupportContact,
  endSupportContact,
  listSupportRecipients,
  setReportingLine
} from "@/lib/org/support";
import { listReceivedSupportSharePage } from "@/lib/org/supportShare";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * `/api/org/[orgId]/tugi` — KAKS ERI ASJA ühe route'i taga, teadlikult:
 *
 *   GET  — MINULE saadetud toeavaldused + kellele MINA saata saan.
 *          Need on MINU andmed ja nad ei vaja ühtegi capability't.
 *   POST — tugikontaktide ja juhiseoste HALDUS. Nõuab
 *          `SUPPORT_CONTACT_ADMIN`-it.
 *
 * Nii ei pea töötaja oma toeavalduste nägemiseks olema haldaja, ega haldaja
 * nägema kellegi avaldusi.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    const membershipId = auth.context.membership?.id;
    const requestUrl = new URL(request.url);
    const [receivedPage, recipients] = await Promise.all([
      listReceivedSupportSharePage(membershipId, {
        cursor: requestUrl.searchParams.get("cursor"),
        take: requestUrl.searchParams.get("take"),
        status: requestUrl.searchParams.get("status"),
        unopened: requestUrl.searchParams.get("unopened") === "1"
      }),
      listSupportRecipients(auth.organizationId, membershipId)
    ]);
    return orgJson({ ok: true, receivedPage, recipients });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.SUPPORT_CONTACT_ADMIN);
    const body = await readJsonBody(request);
    const action = String(body?.action || "").trim();

    if (action === "addContact") {
      const contact = await addSupportContact(auth.organizationId, {
        actorUserId: auth.userId,
        membershipId: String(body?.membershipId || "").trim(),
        contactType: body?.contactType,
        unitId: body?.unitId || null
      });
      return orgJson({ ok: true, contact }, 201);
    }
    if (action === "endContact") {
      const contact = await endSupportContact(auth.organizationId, String(body?.contactId || "").trim(), {
        actorUserId: auth.userId
      });
      return orgJson({ ok: true, contact });
    }
    if (action === "setReportingLine") {
      const line = await setReportingLine(auth.organizationId, {
        actorUserId: auth.userId,
        memberMembershipId: String(body?.memberMembershipId || "").trim(),
        managerMembershipId: String(body?.managerMembershipId || "").trim()
      });
      return orgJson({ ok: true, line }, 201);
    }
    throw badRequest("org.errors.unknown_action");
  } catch (error) {
    return orgErrorResponse(error, "org.errors.support_update_failed", "org");
  }
}
