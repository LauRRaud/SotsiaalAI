import { hasCapability } from "@/lib/org/accessContext";
import { OrganizationCapability, OrganizationStatus } from "@/lib/org/constants";
import { changeOrganizationStatus } from "@/lib/org/organizations";
import { forbidden } from "@/lib/org/errors";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni olekusiire.
 *
 * KAKS ERI VÄRAVAT, sest tegemist on kahe eri asjaga:
 *   - `ACTIVE` ja `SUSPENDED` = identiteedikontrolli otsus → AINULT platvormi
 *     admin (arenduskava §7.1, §10 aktiveerimisvärav). Organisatsioon ei saa
 *     iseennast kontrollituks kuulutada;
 *   - `PENDING_VERIFICATION` ja `ARCHIVED` = organisatsiooni enda otsus →
 *     `ORG_OWNER`.
 *
 * Teenusekiht kontrollib sama asja uuesti; siin on värav selleks, et vale
 * kutsuja saaks 403, mitte 409.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const toStatus = String(body?.toStatus || "").trim();
  const isPlatformAdmin = Boolean(auth.roleState?.isAdmin);

  try {
    const adminOnly = toStatus === OrganizationStatus.ACTIVE || toStatus === OrganizationStatus.SUSPENDED;
    if (adminOnly) {
      if (!isPlatformAdmin) throw forbidden("org.errors.verification_requires_admin");
    } else if (!hasCapability(auth.context, OrganizationCapability.ORG_OWNER) && !isPlatformAdmin) {
      throw forbidden("org.errors.missing_capability", { capability: OrganizationCapability.ORG_OWNER });
    }

    const organization = await changeOrganizationStatus(auth.organizationId, {
      actorUserId: auth.userId,
      isPlatformAdmin,
      toStatus,
      reason: body?.reason,
      verificationNote: body?.verificationNote
    });
    return orgJson({ ok: true, organization });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.status_change_failed", "org");
  }
}
