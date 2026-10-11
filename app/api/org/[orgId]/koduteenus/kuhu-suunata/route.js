import { getReferralContacts, saveReferralContacts } from "@/lib/homeCare/referralContacts";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Asutuse loend „kuhu suunata": loeb iga koduteenuse liige. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) =>
    orgJson({ ok: true, ...(await getReferralContacts(auth.context)) })
  );
}

/** Kogu loend korraga (`contacts`). Ainult kogu asutuse hooldusjuht; eelmised read lõpevad. */
export async function PUT(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await saveReferralContacts(auth.context, body)) });
    }
  );
}
