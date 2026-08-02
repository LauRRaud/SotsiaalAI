/**
 * TEENUSPÄEVIK-V1 — marsruutide ühine värav.
 *
 * MIKS ÜKS KOHT: rollireegel oli varem kopeeritud kaheksasse marsruuti. Kaheksa
 * koopiat tähendab, et üks neist jääb muutmisel maha — ja just see üks on siis
 * see, mille kaudu keegi sisse saab.
 *
 * ROLL LOETAKSE PLATVORMI ROLLIVAATEST, mitte toorest sessioonist.
 * `resolveSessionRoleState` arvestab admini rollivahetajat (S/P/T nupp,
 * `sotsiaalai_admin_view_role` küpsis) — ilma selleta ei saanud omanik oma
 * admin-kontolt teenuseosutaja funktsiooni üldse proovida.
 *
 * MIKS SEE ON OHUTU, kuigi varem oli siin „admin EI OLE erand":
 * see keeld tähendas ja tähendab endiselt „admin ei kirjuta KELLEGI TEISE arve
 * alusdokumente". Skoop ei tule rollist, vaid `requireWritableProfile`-ist, mis
 * seob kirjed `ownerId: userId`-ga. Rollivaates admin näeb ja kirjutab AINULT
 * OMA teenuseprofiili kirjeid — täpselt nagu iga teine osutaja. Võõra osutaja
 * kirje annab talle 404 nagu kõigile.
 *
 * Piir, mis EI muutu: platvormi admin ilma rollivaateta on `SOCIAL_WORKER` ja
 * tema jaoks on see pind endiselt suletud.
 */

import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import { errorJson, localeFromRequest } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { isServiceLogEnabled } from "./flags.js";

const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Küpsiseallikas PÄRINGU PÄISEST, mitte `req.cookies`-ist ega
 * `next/headers`-ist.
 *
 * Kaks põhjust, mõlemad mõõdetud:
 *   1. `req.cookies` sõltub sellest, kas käsitleja saab `NextRequest`-i või
 *      tavalise `Request`-i — brauserikontroll näitas, et rollivahetus
 *      salvestus (200), aga API andis ikka 403, sest värav ei näinud küpsist;
 *   2. `next/headers` ei lahene testiloaderis, seega väravat ei saaks enam
 *      ilma päris serverita testida — ja just seda testi läheb siin kõige
 *      rohkem vaja.
 * `Cookie` päis on mõlemas keskkonnas olemas ja tähendab sama asja.
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
 * @returns {{ response: Response } | { userId: string, locale: string, roleState: object }}
 */
export async function guardServiceLogRequest(req, { scope, limit = 60 } = {}) {
  const locale = localeFromRequest(req);

  /* VÄRAV ON ESIMENE, ENNE AUTENTIMIST JA ROLLI. Kui ta oleks pärast, annaks
     suletud pind anonüümsele 401 ja valele rollile 403 — mõlemad ütlevad „see
     asi on olemas, ainult sina ei pääse ligi". Suletud värav peab olema
     eristamatu olematust marsruudist. */
  if (!isServiceLogEnabled()) {
    return { response: errorJson("service_log.errors.not_found", 404, locale) };
  }

  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401, locale) };

  const roleState = resolveSessionRoleState(session, cookieSourceFromRequest(req));
  if (roleState.effectiveRole !== "SERVICE_PROVIDER") {
    return { response: errorJson("api.common.forbidden", 403, locale) };
  }

  if (scope) {
    const limited = enforceChatRateLimit(req, {
      scope,
      userId,
      limit,
      windowMs: RATE_LIMIT_WINDOW_MS
    });
    if (limited) return { response: limited };
  }

  return { userId, locale, roleState };
}
