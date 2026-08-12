import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { createClientSponsorship, listClientSponsorshipPage } from "@/lib/org/sponsorship";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Pöörduja sponsorlus — RUUMIST SÕLTUMATU rada (otsus O-E0-1).
 *
 * Sama värav mis kohtadel (`BILLING_MANAGER`), sest see on rahaotsus. Aga
 * TULEMUS on täiesti teine: siit ei teki liikmesust ega kohta, ainult tellimus,
 * mille maksja on organisatsioon.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const requestUrl = new URL(request.url);
    const page = await listClientSponsorshipPage(auth.organizationId, {
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

export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const body = await readJsonBody(request);
    const { sponsorship, rawToken } = await createClientSponsorship(auth.organizationId, {
      actorUserId: auth.userId,
      email: body?.email,
      unitPriceCents: body?.unitPriceCents,
      priceReason: body?.priceReason
    });

    return orgJson(
      {
        ok: true,
        sponsorship: {
          id: sponsorship.id,
          email: sponsorship.email,
          unitPriceCents: sponsorship.unitPriceCents,
          expiresAt: sponsorship.expiresAt,
          status: sponsorship.status
        },
        // Toore lingi ainus kuva. DB-s on ainult räsi.
        sponsorshipToken: rawToken
      },
      201
    );
  } catch (error) {
    return orgErrorResponse(error, "org.errors.sponsorship_create_failed", "org");
  }
}
