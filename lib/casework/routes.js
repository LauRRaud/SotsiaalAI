/**
 * JUHTUM-V1 (CASEWORK-P7) — marsruutide ühine värav ja veakaardistus.
 *
 * MIKS ÜKS KOHT: rollireegel ja väravakontroll kordub üheteistkümnes
 * operatsioonis. Üksteist koopiat tähendab, et üks neist jääb muutmisel maha —
 * ja just see üks on siis see, mille kaudu keegi sisse saab. Sama õppetund, mis
 * Teenuspäeviku `guardServiceLogRequest`-i kirja pani.
 */

import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { errorJson, localeFromRequest } from "@/lib/documents/server";

import { CaseWorkError } from "./errors.js";
import { isCaseWorkEnabled } from "./flags.js";

const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Rollid, kellel juhtum üldse olla saab.
 *
 * MÕLEMAD, mitte ainult `SOCIAL_WORKER`: õiguslik alus on
 * `WORKER_DATA_PROCESSING` raamleping ja `isWorkerEligible` katab nimeliselt
 * mõlemat rolli. Kui lubaksime siin ainult ühe, oleks tootepiir kitsam kui
 * õiguslik alus — ja teenuseosutaja juhtumitöö jääks tööriistata.
 */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

/**
 * Küpsiseallikas PÄRINGU PÄISEST — sama põhjendus mis Teenuspäevikul:
 * `req.cookies` sõltub käsitleja tüübist ja `next/headers` ei lahene
 * testiloaderis, seega väravat ei saaks ilma päris serverita testida.
 */
function cookieSourceFromRequest(req) {
  const header = req?.headers?.get?.("cookie") || "";
  const jar = new Map();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    jar.set(name, decodeURIComponent(part.slice(index + 1).trim()));
  }
  return { get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) };
}

/**
 * @returns {{ response: Response } | { userId: string, locale: string }}
 */
export async function guardCaseWorkRequest(req, { scope, limit = 60 } = {}) {
  const locale = localeFromRequest(req);

  /* VÄRAV ON ESIMENE, ENNE AUTENTIMIST JA ROLLI. Kui ta oleks pärast, annaks
     suletud pind anonüümsele 401 ja valele rollile 403 — mõlemad ütlevad „see
     asi on olemas, ainult sina ei pääse ligi". Väljas värav peab olema
     eristamatu olematust marsruudist (leping L19). */
  if (!isCaseWorkEnabled()) {
    return { response: errorJson("casework.errors.not_found", 404, locale) };
  }

  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401, locale) };

  const roleState = resolveSessionRoleState(session, cookieSourceFromRequest(req));
  if (!WORKER_ROLES.has(roleState.effectiveRole)) {
    return { response: errorJson("api.common.forbidden", 403, locale) };
  }

  if (scope) {
    const limited = enforceChatRateLimit(req, { scope, userId, limit, windowMs: RATE_LIMIT_WINDOW_MS });
    if (limited) return { response: limited };
  }

  return { userId, locale, roleState };
}

/**
 * Teenuskihi viga → HTTP-vastus.
 *
 * TUNDMATU VIGA ANNAB 500 ILMA SÕNUMITA. Teenuskihi vead on tõlkevõtmed ja
 * nende edastamine on ohutu; ootamatu erind võib kanda päringu või kirje sisu,
 * ja see ei tohi kliendini jõuda.
 */
export function caseWorkErrorResponse(error, locale) {
  if (error instanceof CaseWorkError) return errorJson(error.messageKey, error.status, locale);
  console.error("[casework] unexpected error", error?.message || error);
  return errorJson("casework.errors.unexpected", 500, locale);
}
