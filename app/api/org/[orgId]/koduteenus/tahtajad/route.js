import { getDeadlines } from "@/lib/homeCare/deadlines";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Tähtajad hooldusjuhile: lõppevad otsused, otsuseta kliendid, ülevaatamist ootavad kavad, kavata kliendid. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, deadlines: await getDeadlines(auth.context) })
  );
}
