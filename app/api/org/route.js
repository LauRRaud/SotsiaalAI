import { safeError } from "@/lib/privacy/safeError";

import { createOrganization, listUserOrganizations } from "@/lib/org/organizations";
import { listPendingInvitesForEmail } from "@/lib/org/inviteService";
import { assertOrgCreationEnabled } from "@/lib/org/flags";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgUser } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * `/api/org` — kasutaja organisatsioonid ja talle saadetud ootel kutsed.
 *
 * See on tööruumivahetaja andmeallikas. Ta EI loetle organisatsioone, kuhu
 * kasutaja ei kuulu, ega ütle, kas mingi organisatsioon üldse eksisteerib.
 */
export async function GET(request) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth.response;

  try {
    const [organizations, pendingInvites] = await Promise.all([
      listUserOrganizations(auth.userId),
      listPendingInvitesForEmail(auth.userEmail)
    ]);
    return orgJson({ ok: true, organizations, pendingInvites });
  } catch (error) {
    console.error("[org] list failed", safeError(error));
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

/** Organisatsiooni loomine. Oma feature-gate (`ORG_CREATION_ENABLED`) taga. */
export async function POST(request) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth.response;

  try {
    assertOrgCreationEnabled();
  } catch (error) {
    return orgErrorResponse(error, "org.errors.not_found", "org");
  }

  const body = await readJsonBody(request);
  try {
    const { organization } = await createOrganization({
      userId: auth.userId,
      productRole: auth.roleState?.effectiveRole,
      displayName: body?.displayName,
      legalKind: body?.legalKind,
      legalName: body?.legalName,
      registryCode: body?.registryCode,
      municipalityId: body?.municipalityId
    });
    return orgJson({ ok: true, organization }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.create_failed", "org");
  }
}
