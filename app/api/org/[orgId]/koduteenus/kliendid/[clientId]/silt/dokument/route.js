import { CHRONOLOGY_DOCUMENT_HEADERS } from "@/lib/homeCare/chronologyDocument";
import { renderDoorTagHtml } from "@/lib/homeCare/doorTagDocument";
import { getDoorTag } from "@/lib/homeCare/doorTags";
import { notFound } from "@/lib/org/errors";

import { homeCareRoute, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Uksesilt prinditava dokumendina (HTML, mille brauser prindib või salvestab
 * PDF-ina). Ainult hooldusjuht. Vastus on HTML rakenduse päritolust, seepärast
 * kannab dokument ranget sisuturbe poliitikat ja vahemällu seda ei jäeta.
 */
export async function GET(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "door_tag_document", rateLimit: 60, fallbackKey: "home_care.errors.open_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const { client, tag } = await getDoorTag(auth.context, clientId);
      if (!tag) throw notFound("home_care.errors.door_tag_missing");
      const html = renderDoorTagHtml({ tag, clientName: client.displayName, organization: auth.context.organization });
      return new Response(html, { status: 200, headers: CHRONOLOGY_DOCUMENT_HEADERS });
    }
  );
}
