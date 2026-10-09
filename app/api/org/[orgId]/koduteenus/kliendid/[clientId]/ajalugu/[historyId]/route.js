import { readHistory, removeHistory } from "@/lib/homeCare/importedHistory";

import { homeCareRoute, orgJson, readParam } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Imporditud ajaloo lõigud lehekülgede kaupa. Loeb igaüks, kes klienti näeb; avamine jätab jälje. */
export async function GET(request, context) {
  return homeCareRoute(
    request,
    context,
    { rateScope: "history_read", rateLimit: 120, fallbackKey: "home_care.errors.list_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const historyId = await readParam(context, "historyId");
      const after = new URL(request.url).searchParams.get("after") || "0";
      return orgJson({ ok: true, ...(await readHistory(auth.context, clientId, historyId, { after })) });
    }
  );
}

/** Imporditud ajaloo eemaldamine (vale klient või vale fail). Ainult hooldusjuht. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "history_remove", rateLimit: 20, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const historyId = await readParam(context, "historyId");
      return orgJson({ ok: true, ...(await removeHistory(auth.context, clientId, historyId)) });
    }
  );
}
