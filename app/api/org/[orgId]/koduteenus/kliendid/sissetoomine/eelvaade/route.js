import { previewClientImport } from "@/lib/homeCare/clientImport";

import { homeCareRoute, orgJson, readJsonBody } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Klientide nimekirja eelvaade: mis igast tabeli reast saaks. Midagi ei
 * salvestata. POST, sest tabelis on nimed, aadressid ja telefonid, mis ei tohi
 * sattuda aadressi ega logidesse.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "client_import_preview", rateLimit: 20, fallbackKey: "home_care.errors.import_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, preview: await previewClientImport(auth.context, body) });
    }
  );
}
