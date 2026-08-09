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
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
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
 * Tasuta lugemine, tasulised tööriistad (SOL-CW-01, omanik 09.08.2026).
 *
 * SAMA KÕVA REEGEL, MIS JUBA KEHTIB Tööheaolul ja refleksioonil
 * (`app/api/reflections/_shared.js`): oma kirjete lugemine (GET) ja kustutamine
 * (DELETE) ei sõltu tellimusest — „ligipääs oma andmetele ei aegu kunagi"
 * (SotsiaalAI.md). Uue sisu loomine ja muutmine (POST/PUT/PATCH) on tasuline
 * tööriist.
 *
 * DELETE ON TEADLIKULT TASUTA: `client-reference` DELETE kustutab KOLMANDA
 * ISIKU viite (leping L17) — see ei tohi kunagi maksemüüri taha jääda.
 *
 * Kaardil (`lib/workspaceDashboardCards.js`) tähendab see, et juhtumitöö
 * kaardid ei ole enam `requiresPaid`: pind on lugemiseks lahti ja server
 * ütleb tasulise toimingu juures 402. Enne rääkisid kaart ja server eri tõde.
 */
export function caseWorkRequiresSubscription(method) {
  const normalized = String(method || "").toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD" && normalized !== "DELETE";
}

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
 *
 * `deps` on ainult testi-õmblus (sama muster mis mujal `db` parameetriga):
 * `getServerSession` ja `requireSubscription` vajaksid muidu päris next-authi
 * ja päris andmebaasi, mistõttu väravat ennast ei saaks negatiivselt katta —
 * ja just värav on see koht, mille katmatus SOL-CW-01 tekitas.
 */
export async function guardCaseWorkRequest(req, { scope, limit = 60, deps = {} } = {}) {
  const locale = localeFromRequest(req);

  /* VÄRAV ON ESIMENE, ENNE AUTENTIMIST JA ROLLI. Kui ta oleks pärast, annaks
     suletud pind anonüümsele 401 ja valele rollile 403 — mõlemad ütlevad „see
     asi on olemas, ainult sina ei pääse ligi". Väljas värav peab olema
     eristamatu olematust marsruudist (leping L19). */
  if (!isCaseWorkEnabled()) {
    return { response: errorJson("casework.errors.not_found", 404, locale) };
  }

  /* Õmbluse vaikeväärtus lahendatakse ALLES SIIN, mitte funktsiooni alguses:
     `getServerSession(authConfig)` tekstiline asukoht on lepingutesti mõõdik
     selle kohta, et lipuvärav on autentimisest eespool. */
  const readSession = deps.getSession || (() => getServerSession(authConfig));
  const session = await Promise.resolve(readSession()).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { response: errorJson("api.common.unauthorized", 401, locale) };

  const roleState = resolveSessionRoleState(session, cookieSourceFromRequest(req));
  if (!WORKER_ROLES.has(roleState.effectiveRole)) {
    return { response: errorJson("api.common.forbidden", 403, locale) };
  }

  /* Tellimusvärav ON PÄRAST ROLLI, aga ENNE rate-limit'i ja tööd: tellimuseta
     töötaja ei tohi tasulist tööriista käivitada, kuid ta ei tohi ka saada
     „see asi on olemas" vihjet enne, kui roll on kontrollitud. */
  const checkSubscription = deps.requireSubscription || requireSubscription;
  const subscriptionGate = await checkSubscription(session, roleState.effectiveRole, {
    allowWithoutSubscription: !caseWorkRequiresSubscription(req?.method)
  });
  if (!subscriptionGate.ok) {
    return {
      response: errorJson("api.common.subscription_required", 402, locale, {
        redirect: subscriptionGate.redirect,
        requireSubscription: true
      })
    };
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
