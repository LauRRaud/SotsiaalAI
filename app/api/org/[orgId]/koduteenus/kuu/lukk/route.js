import { lockMonth, reopenMonth } from "@/lib/homeCare/monthLock";

import { homeCareRoute, orgJson, readJsonBody } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lukustab kuu (`month`, `seen`): arvude hetktõmmis. Ainult kogu asutuse hooldusjuht. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await lockMonth(auth.context, body)) }, 201);
    }
  );
}

/** Avab lukustatud kuu uuesti (`month`, `reason`). Lukk jääb ajalukku alles. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await reopenMonth(auth.context, body)) });
    }
  );
}
