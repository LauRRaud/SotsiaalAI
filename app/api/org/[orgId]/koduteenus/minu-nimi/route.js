import { saveOwnName } from "@/lib/homeCare/ownName";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Inimene paneb kirja OMA nime (ees- ja perekonnanimi). Teise inimese nime siit muuta ei saa: rida leitakse sessiooni liikmesuse järgi. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "own_name_write", rateLimit: 10, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, name: await saveOwnName(auth.context, body) });
    }
  );
}
