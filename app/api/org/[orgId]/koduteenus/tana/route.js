import { getMyDay } from "@/lib/homeCare/slots";

import { homeCareRoute, orgJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldaja tänane päev: talle määratud tänased käigud kellaaja järjekorras. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getMyDay(auth.context)) })
  );
}
