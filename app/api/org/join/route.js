import { acceptInvite, declineInvite, previewInvite } from "@/lib/org/inviteService";
import { badRequest } from "@/lib/org/errors";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kutse vastuvõtu rada. Staatiline segment `join` on `[orgId]`-st eespool ja
 * varjutab teda ainult organisatsiooni puhul, mille ID oleks sõna „join" —
 * cuid-id niimoodi ei alga.
 *
 * KAKS SAMMU, teadlikult: GET näitab eelvaadet ja EI MUUDA MIDAGI, POST teeb
 * teadliku nõustumise. Lingile klikkimine ei tohi kellestki liiget teha
 * (arenduskava §5.5).
 */

/** Eelvaade: organisatsioon, üksus, hinnastatav roll ja kavandatud õigused. */
export async function GET(request) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth.response;

  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) throw badRequest("org.errors.invite_token_required");
    const preview = await previewInvite(token, { acceptingEmail: auth.userEmail });
    return orgJson({ ok: true, preview });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.invite_invalid", "org");
  }
}

export async function POST(request) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const token = String(body?.token || "").trim();
  const action = String(body?.action || "accept").trim();

  try {
    if (!token) throw badRequest("org.errors.invite_token_required");

    if (action === "decline") {
      await declineInvite(token, { userId: auth.userId, userEmail: auth.userEmail });
      return orgJson({ ok: true, declined: true });
    }
    if (action !== "accept") throw badRequest("org.errors.unknown_action");

    const { organizationId } = await acceptInvite(token, {
      userId: auth.userId,
      userEmail: auth.userEmail
    });
    return orgJson({ ok: true, organizationId }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.invite_invalid", "org");
  }
}
