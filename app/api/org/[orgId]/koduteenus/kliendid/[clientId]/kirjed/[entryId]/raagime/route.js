import { requestTalk, withdrawTalk } from "@/lib/homeCare/talkRequests";

import { homeCareRoute, orgJson, readParam } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPTIONS = { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" };

/** „Soovin sellest rääkida": erijuhtumi autor annab hooldusjuhile teada, et soovib juhtumist rääkida. Keha ei ole: soov ei kanna teksti. */
export async function POST(request, context) {
  return homeCareRoute(request, context, OPTIONS, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const entryId = await readParam(context, "entryId");
    return orgJson({ ok: true, ...(await requestTalk(auth.context, clientId, entryId)) }, 201);
  });
}

/** Esitaja võtab oma lahtise soovi tagasi. Rida jääb alles. */
export async function DELETE(request, context) {
  return homeCareRoute(request, context, OPTIONS, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const entryId = await readParam(context, "entryId");
    return orgJson({ ok: true, ...(await withdrawTalk(auth.context, clientId, entryId)) });
  });
}
