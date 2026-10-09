import { getDayPlan } from "@/lib/homeCare/dayPlan";
import { handleObstacle, withdrawObstacle } from "@/lib/homeCare/obstacles";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Hooldusjuht märgib teate vaadatuks; `markAbsent: true` märgib teate „ei saa täna
 * töötada" juurest töötajale selleks päevaks puudumise. Vastus on selle päeva plaan.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const obstacleId = await readParam(context, "obstacleId");
      const body = await readJsonBody(request);
      const { day } = await handleObstacle(auth.context, obstacleId, body);
      return orgJson({ ok: true, ...(await getDayPlan(auth.context, { day })) });
    }
  );
}

/** Hooldaja võtab oma lahtise teate tagasi („takistus on möödas"). */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "obstacle_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const obstacleId = await readParam(context, "obstacleId");
      return orgJson({ ok: true, ...(await withdrawObstacle(auth.context, obstacleId)) });
    }
  );
}
