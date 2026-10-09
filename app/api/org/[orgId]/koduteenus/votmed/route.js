import { getKeyRegister } from "@/lib/homeCare/keys";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Võtmeraamat hooldusjuhile: kõik asutuse käes olevad võtmed ja lõppenud teenusega klientide tagastamata võtmed. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getKeyRegister(auth.context)) })
  );
}
