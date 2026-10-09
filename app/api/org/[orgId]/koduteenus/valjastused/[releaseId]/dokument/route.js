import { getChronologyRelease } from "@/lib/homeCare/chronology";
import { CHRONOLOGY_DOCUMENT_HEADERS, renderChronologyHtml } from "@/lib/homeCare/chronologyDocument";

import { homeCareRoute, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Väljastatud kronoloogia prinditava dokumendina (HTML, mille brauser salvestab
 * PDF-ina). Sama värav mis teistel koduteenuse marsruutidel; dokumendi avab
 * hooldusjuht, kelle skoobis klient on, ja avamine jätab jälje.
 *
 * Vastus on HTML rakenduse päritolust, seepärast on päistes range sisuturbe
 * poliitika (skripte ei lubata) ja vahemällu seda ei jäeta.
 */
export async function GET(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "chronology_document", rateLimit: 60, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const releaseId = await readParam(context, "releaseId");
      const document = await getChronologyRelease(auth.context, releaseId);
      return new Response(renderChronologyHtml(document), { status: 200, headers: CHRONOLOGY_DOCUMENT_HEADERS });
    }
  );
}
