import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { localeFromRequest } from "@/lib/documents/server";
import { serverT } from "@/lib/i18n/serverMessages";
import { PAPER_SHEET_HEADERS, normalizePaperSheetParts, renderPaperSheetHtml } from "@/lib/journey/paperSheet";
import { getJourneyDetailForUser } from "@/lib/journey/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

/**
 * Teekonna paberleht: prinditav HTML-dokument (brauseri „Prindi" teeb sellest
 * paberi või PDF-i). Ainult Teekonna omanik; võõras ja olematu Teekond on 404.
 *
 * Leht avaneb uuel vahelehel tavalise lingina, seepärast on veavastus lihtne
 * tekst, mitte JSON. Dokumenti ei salvestata: iga avamine teeb selle Teekonna
 * praegusest seisust ja aadressis valitud osadest (`?osad=`).
 */
export async function GET(request, context) {
  const locale = localeFromRequest(request) || "et";
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return new Response(serverT(locale, "api.common.unauthorized", null, "Palun logi sisse."), { status: 401, headers: PLAIN_HEADERS });
  }

  try {
    const params = await context?.params;
    const journey = await getJourneyDetailForUser(userId, params?.id);
    const parts = normalizePaperSheetParts(new URL(request.url).searchParams.get("osad"));
    return new Response(renderPaperSheetHtml({ journey, parts, locale }), { status: 200, headers: PAPER_SHEET_HEADERS });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] paper sheet failed", safeError(error));
    const key = status === 404 ? "journeys.errors.not_found" : "journeys.errors.load_failed";
    return new Response(serverT(locale, key, null, "Teekonna laadimine ei õnnestunud."), { status, headers: PLAIN_HEADERS });
  }
}
