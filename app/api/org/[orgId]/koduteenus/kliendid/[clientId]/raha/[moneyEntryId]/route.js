import { retractMoneyEntry } from "@/lib/homeCare/money";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Eksliku rea tühistamine: autor samal päeval või hooldusjuht. Rida jääb alles tühistatuna. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "money_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const moneyEntryId = await readParam(context, "moneyEntryId");
      return orgJson({ ok: true, ...(await retractMoneyEntry(auth.context, clientId, moneyEntryId)) });
    }
  );
}
