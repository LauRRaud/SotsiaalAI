import { createActivity, listActivities, seedDefaultActivities } from "@/lib/homeCare/activities";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Asutuse toimingute kataloog. Loevad hooldajad; arhiveeritud toiminguid näeb ainult kataloogi muutja. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const includeArchived = new URL(request.url).searchParams.get("arhiiv") === "1";
    return orgJson({ ok: true, ...(await listActivities(auth.context, { includeArchived })) });
  });
}

/** Uus toiming või (`{ seed: true }`) algne loend määruse rühmadest. Ainult kogu asutuse hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      if (body?.seed === true) return orgJson({ ok: true, ...(await seedDefaultActivities(auth.context)) }, 201);
      return orgJson({ ok: true, ...(await createActivity(auth.context, body)) }, 201);
    }
  );
}
