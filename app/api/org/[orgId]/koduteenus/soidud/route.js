import { addTrip, getTripLog } from "@/lib/homeCare/trips";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Sõidupäevik: töötaja oma selle kuu sõidud; kogu asutuse hooldusjuhile lisaks kõigi töötajate read ja kokkuvõte. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const month = new URL(request.url).searchParams.get("kuu") || undefined;
    return orgJson({ ok: true, ...(await getTripLog(auth.context, { month })) });
  });
}

/** Uus sõit (`day`, `vehicle`, `plate`, `startOdometer`, `endOdometer`, `purpose`). Sõidu paneb kirja see, kes sõitis. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await addTrip(auth.context, body)) }, 201);
    }
  );
}
