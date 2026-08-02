import { OrganizationCapability } from "@/lib/org/constants";
import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { badRequest } from "@/lib/org/errors";
import {
  convertProfileToOrganization,
  listProfileEditors,
  requireEditableOrganizationProfile,
  updateOrganizationProfile
} from "@/lib/org/serviceProfile";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Organisatsiooni teenuseprofiil ja tema toimetajad (E8). */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertCapability(auth.context, OrganizationCapability.SERVICE_PROFILE_EDITOR);
    const [profile, editors] = await Promise.all([
      requireEditableOrganizationProfile(auth.context),
      listProfileEditors(auth.organizationId)
    ]);
    return orgJson({ ok: true, profile, editors });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.profile_not_found", "org");
  }
}

/**
 * Solo→org üleminek. Nõuab KAHTE kinnitust ühes tehingus: profiili omaniku oma
 * (`ownerConfirmed`) ja organisatsiooni omaniku oma (`ORG_OWNER` capability).
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    const body = await readJsonBody(request);
    const profile = await convertProfileToOrganization(auth.context, {
      profileId: String(body?.profileId || "").trim(),
      ownerConfirmed: body?.ownerConfirmed === true
    });
    return orgJson({ ok: true, profile }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.profile_convert_failed", "org");
  }
}

/** Toimetamine optimistliku lukuga — kaks toimetajat ei kirjuta teineteist üle. */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    const body = await readJsonBody(request);
    if (!body?.expectedUpdatedAt) throw badRequest("org.errors.profile_version_required");

    const allowed = {};
    for (const field of [
      "organizationName",
      "shortDescription",
      "longDescription",
      "serviceArea",
      "county",
      "address",
      "phone",
      "email",
      "website",
      "primaryContactName",
      "accessibilityInfo"
    ]) {
      if (body[field] !== undefined) allowed[field] = body[field];
    }
    if (!Object.keys(allowed).length) throw badRequest();

    const profile = await updateOrganizationProfile(auth.context, {
      profileId: String(body?.profileId || "").trim(),
      expectedUpdatedAt: body.expectedUpdatedAt,
      data: allowed
    });
    return orgJson({ ok: true, profile });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.profile_update_failed", "org");
  }
}
