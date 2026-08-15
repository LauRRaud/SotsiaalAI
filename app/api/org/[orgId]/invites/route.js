import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { CAPABILITY_TEMPLATES, OrganizationCapability } from "@/lib/org/constants";
import { createInvite, listInvitePage } from "@/lib/org/inviteService";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const requestUrl = new URL(request.url);
    const page = await listInvitePage(auth.organizationId, {
      includeClosed: requestUrl.searchParams.get("includeClosed") === "1",
      cursor: requestUrl.searchParams.get("cursor"),
      take: requestUrl.searchParams.get("take"),
      status: requestUrl.searchParams.get("status")
    });
    return orgJson({ ok: true, ...page });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

/**
 * Kutse loomine.
 *
 * TOORE TOKEN tagastatakse AINULT selles vastuses ja ainult kutsujale — DB-s on
 * ainult räsi. Viilus A ei ole e-posti saatmist: kutsuja saab lingi ja edastab
 * selle ise. See on teadlik piir, mitte poolik töö — e-kirja saatmine nõuab
 * eraldi otsust, MIS kirjas seisab (arenduskava §4: „e-kirjadesse ei panda
 * tundliku objekti sisu") ja see kuulub teavituste liitekohta.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const body = await readJsonBody(request);
    if (body?.capabilityTemplate === CAPABILITY_TEMPLATES.ORG_OWNER.key) {
      assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    }
    const { invite, rawToken } = await createInvite(auth.organizationId, {
      actorUserId: auth.userId,
      email: body?.email,
      seatRole: body?.seatRole,
      capabilityTemplate: body?.capabilityTemplate,
      primaryUnitId: body?.primaryUnitId || null,
      jobTitle: body?.jobTitle || null
    });

    return orgJson(
      {
        ok: true,
        invite: {
          id: invite.id,
          email: invite.email,
          seatRole: invite.seatRole,
          capabilityTemplate: invite.capabilityTemplate,
          expiresAt: invite.expiresAt,
          status: invite.status
        },
        inviteToken: rawToken
      },
      201
    );
  } catch (error) {
    return orgErrorResponse(error, "org.errors.invite_create_failed", "org");
  }
}
