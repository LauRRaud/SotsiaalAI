import { listTeamCandidates } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Liikmete valik meeskonna koostamiseks. Ainult hooldusjuht; ainult nimed. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await listTeamCandidates(auth.context)) })
  );
}
