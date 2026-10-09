import { reportObstacle } from "@/lib/homeCare/obstacles";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hooldaja teatab takistusest (`kind` viiest valikust). Ainult tänase päeva kohta; põhjust lähemalt ei küsita. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "obstacle_write", rateLimit: 30, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await reportObstacle(auth.context, body)) }, 201);
    }
  );
}
