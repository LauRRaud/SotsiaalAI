import { badRequest } from "@/lib/org/errors";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import {
  acceptClientSponsorship,
  declineClientSponsorship,
  previewClientSponsorship
} from "@/lib/org/sponsorship";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Pöörduja sponsorluse vastuvõtu rada — RUUMITA (otsus O-E0-1).
 *
 * Staatiline segment `sponsorlus` varjutab `[orgId]`-t ainult organisatsiooni
 * puhul, mille ID oleks sõna „sponsorlus" — cuid-id niimoodi ei alga.
 *
 * KAKS SAMMU nagu töötajakutselgi: GET näitab, kes maksab ja mille eest;
 * POST on teadlik nõustumine. Klikkimine ei tekita tellimust.
 */
export async function GET(request) {
  const auth = await requireOrgUser(request);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    const token = new URL(request.url).searchParams.get("token");
    if (!token) throw badRequest("org.errors.invite_token_required");
    const preview = await previewClientSponsorship(token, { acceptingEmail: auth.userEmail });
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
    assertOrgSeatsEnabled();
    if (!token) throw badRequest("org.errors.invite_token_required");

    if (action === "decline") {
      await declineClientSponsorship(token, { userId: auth.userId, userEmail: auth.userEmail });
      return orgJson({ ok: true, declined: true });
    }
    if (action !== "accept") throw badRequest("org.errors.unknown_action");

    /* Tulemus on TELLIMUS, mitte liikmesus: vastus ei sisalda `organizationId`-d
       viisil, mis viitaks org-tööruumile, sest pöörduja sinna ei pääse. */
    const { validUntil } = await acceptClientSponsorship(token, {
      userId: auth.userId,
      userEmail: auth.userEmail
    });
    return orgJson({ ok: true, validUntil }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.invite_invalid", "org");
  }
}
