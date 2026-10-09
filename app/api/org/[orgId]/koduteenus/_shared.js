import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { assertWritable } from "@/lib/org/accessContext";

import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../_shared";

/**
 * KODUTEENUS K1 — marsruutide ühine ümbris.
 *
 * Värav on organisatsiooni oma (`requireOrgContext`: lipp, sessioon, liikmesus
 * päringu filtrina). Koduteenuse lipp ja moodul kontrollitakse teenuskihis
 * (`assertHomeCareContext`), et sama reegel kehtiks ka väljaspool marsruuti.
 * Marsruudis ei ole äriloogikat ega andmebaasipäringuid.
 */
export async function homeCareRoute(request, context, options, handler) {
  const {
    write = false,
    rateScope = null,
    rateLimit = 120,
    rateWindowMs = 60_000,
    fallbackKey = "home_care.errors.request_failed"
  } = options;
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  if (rateScope) {
    const limited = enforceChatRateLimit(request, {
      scope: `home_care_${rateScope}`,
      userId: auth.userId,
      limit: rateLimit,
      windowMs: rateWindowMs
    });
    if (limited) return limited;
  }

  try {
    if (write) assertWritable(auth.context);
    return await handler(auth);
  } catch (error) {
    return orgErrorResponse(error, fallbackKey, "home_care");
  }
}

export { orgJson, readJsonBody, readParam };
