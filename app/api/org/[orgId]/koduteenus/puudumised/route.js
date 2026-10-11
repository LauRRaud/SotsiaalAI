import { createAbsence, getAbsences } from "@/lib/homeCare/absences";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Töötajate puudumised hooldusjuhile: käimasolevad, tulevased ja viimase nädala lõppenud. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getAbsences(auth.context)) })
  );
}

/** Uus puudumine: töötaja, päevad ja liik (plaaniline või ootamatu). Põhjust ei küsita. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await createAbsence(auth.context, body)) }, 201);
    }
  );
}
