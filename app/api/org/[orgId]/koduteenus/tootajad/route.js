import { addWorkerRecord, getWorkerCards } from "@/lib/homeCare/workerRecords";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Töötajate kaardid: iga hooldaja taustakontrolli ja koolituste read. Ainult kogu asutuse hooldusjuht. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getWorkerCards(auth.context)) })
  );
}

/** Uus rida töötajale (`membershipId`, `kind`, `doneOn`, soovi korral `validUntil`, koolitusel `title`). */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await addWorkerRecord(auth.context, body)) }, 201);
    }
  );
}
