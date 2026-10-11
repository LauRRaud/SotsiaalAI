import { answerDecisionNotice } from "@/lib/homeCare/decisionNotices";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Otsustaja vastus teatele, hooldusjuhi märgituna. Vastus pannakse üks kord. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const noticeId = await readParam(context, "noticeId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await answerDecisionNotice(auth.context, clientId, noticeId, body)) });
    }
  );
}
