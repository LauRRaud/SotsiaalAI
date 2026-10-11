/**
 * ÄRIREGISTRI NIMEKONTROLL — kõigepealt register ise, siis meie koopia.
 *
 * Koopia (`lib/businessRegisterNames.js`) on registri seis faili tegemise päeval. Vahepeal tekib
 * uusi asutusi, nimesid muudetakse ja asutusi suletakse (omanik 11.10.2026). Ainult koopiaga oli
 * uus ja ümber nimetatud asutus kuni faili värskendamiseni liiga rangelt kinni ja suletud asutus
 * liiga leebelt lahti.
 *
 * Seepärast küsitakse REGISTRIKOODI kohta värske seis äriregistri avalikust teenusest
 * (https://ariregister.rik.ee/est/api/autocomplete; avalikkusele avatud, lepingut ei nõua):
 *
 *   register vastas, asutus on registrisse kantud   nimi võrreldakse registri praeguse nimega;
 *   register vastas, asutust ei ole või ta ei ole
 *     registrisse kantud (suletud, likvideerimisel)  `code_not_listed`;
 *   register ei vastanud                            vastus tuleb koopiast;
 *   ei vastanud ja koopiat ei saa lugeda            `unavailable`: „ei tea" ei ole kunagi „sobib".
 *
 * MIS REGISTRISSE LÄHEB: ainult registrikood. Nimi ei lähe kunagi: registrikoodita profiili nimi
 * võib olla inimese nimi, ja kontroll „kas see on registrisse kantud asutuse nimi" käib seepärast
 * ainult koopia vastu.
 *
 * INIMESE NIMI: füüsilisest isikust ettevõtja nime ei näidata ega hoita tekstina ka siis, kui
 * register selle annab. Vahemällu jääb paari (kood, nimi) räsi nagu koopias; näidata tohib ainult
 * nende õiguslike vormide nime, mis on allpool loetletud.
 *
 * Väljalülitamine: keskkonnamuutuja `BUSINESS_REGISTER_LIVE=off` jätab alles ainult koopia
 * (nii jooksevad ühiktestid, et ükski test võrku ei läheks).
 */
import { normalizeRegistryCode } from "./businessRegisterContacts.js";
import {
  RegisterNameResult,
  loadRegisterNamesOrNull,
  registerEntryCheck,
  registerNameCheck,
  registerNamePairHash
} from "./businessRegisterNames.js";

export const REGISTER_LIVE_URL = "https://ariregister.rik.ee/est/api/autocomplete";
export const REGISTER_LIVE_TIMEOUT_MS = 3000;
/* Vastus koodi kohta kehtib nii kaua: vormi kirjutamine ei tee iga pausi peale uut päringut. */
const ANSWER_TTL_MS = 10 * 60 * 1000;
/* Kui register ei vasta, ei küsita seda nii kaua üldse: muidu ootaks iga päring ajalõpu ära. */
const PAUSE_AFTER_FAILURE_MS = 30 * 1000;
const CACHE_MAX = 500;

/* Teenuse `legal_form` numbrid, mille nimi ei ole inimese nimi (mõõdetud 11.10.2026 päris
   vastustest): 1 AS, 2 TÜ, 4 UÜ, 5 OÜ, 6 tulundusühistu, 7 MTÜ, 8 SA, 10 filiaal, 12 SE,
   20 riigiasutus, 21 avalik-õiguslik isik, 22 kohaliku omavalitsuse asutus, 23 korteriühistu,
   24 maaparandusühistu, 25 erakond, 26 ametiühing. Füüsilisest isikust ettevõtja on 3; tema ja
   iga tundmatu vormi nime kohta jääb ainult räsi. */
export const PLAIN_NAME_LIVE_FORMS = Object.freeze(new Set([
  "1", "2", "4", "5", "6", "7", "8", "10", "12", "20", "21", "22", "23", "24", "25", "26"
]));

export const LiveRegisterStatus = Object.freeze({
  /* Register vastas ja kood on olemas; `registered` ütleb, kas asutus on registrisse kantud. */
  FOUND: "found",
  /* Register vastas: sellise koodiga asutust ei ole. */
  NOT_FOUND: "not_found",
  /* Register ei vastanud (ajalõpp, võrguviga, vigane vastus) või otsepäring on välja lülitatud. */
  UNAVAILABLE: "unavailable"
});

export const RegisterNameSource = Object.freeze({ LIVE: "live", COPY: "copy" });

const NOT_FOUND = Object.freeze({ status: LiveRegisterStatus.NOT_FOUND });
const UNAVAILABLE = Object.freeze({ status: LiveRegisterStatus.UNAVAILABLE });

const answers = new Map();
let pausedUntil = 0;

function remember(code, answer, now) {
  answers.delete(code);
  answers.set(code, { answer, until: now + ANSWER_TTL_MS });
  if (answers.size > CACHE_MAX) answers.delete(answers.keys().next().value);
}

/**
 * Registrikoodi värske seis äriregistrist.
 *
 * Tagastab `{ status: "found", registered, entry: { name, hash } }`, `{ status: "not_found" }` või
 * `{ status: "unavailable" }`. `entry` on samal kujul nagu koopia kirje (`registerEntryCheck`):
 * juriidilise isiku nimi tekstina või füüsilisest isikust ettevõtja paari räsi.
 *
 * Päringusse läheb ainult kood. Vigase kujuga koodi ei küsita üldse.
 */
export async function fetchRegisterEntry(registryCode, { fetchImpl = globalThis.fetch, timeoutMs = REGISTER_LIVE_TIMEOUT_MS, now = Date.now } = {}) {
  const code = normalizeRegistryCode(registryCode);
  if (!code) return NOT_FOUND;
  if (process.env.BUSINESS_REGISTER_LIVE === "off" || typeof fetchImpl !== "function") return UNAVAILABLE;
  const moment = now();
  const cached = answers.get(code);
  if (cached && cached.until > moment) return cached.answer;
  if (pausedUntil > moment) return UNAVAILABLE;
  try {
    const response = await fetchImpl(`${REGISTER_LIVE_URL}?q=${code}`, {
      headers: { Accept: "application/json", "User-Agent": "sotsiaal.pro teenuseprofiili nimekontroll" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store"
    });
    if (!response?.ok) throw new Error("BUSINESS_REGISTER_LIVE_STATUS");
    const body = await response.json();
    if (body?.status !== "OK" || !Array.isArray(body.data)) throw new Error("BUSINESS_REGISTER_LIVE_SHAPE");
    /* Teenus otsib ka nimede seest: loeb ainult rida, mille kood on täpselt küsitud kood. */
    const row = body.data.find((item) => String(item?.reg_code ?? "") === code);
    let answer = NOT_FOUND;
    if (row) {
      const name = typeof row.name === "string" ? row.name.replace(/\s+/gu, " ").trim() : "";
      if (!name) throw new Error("BUSINESS_REGISTER_LIVE_SHAPE");
      answer = {
        status: LiveRegisterStatus.FOUND,
        registered: row.status === "R",
        entry: PLAIN_NAME_LIVE_FORMS.has(String(row.legal_form ?? ""))
          ? { name, hash: null }
          : { name: null, hash: registerNamePairHash(code, name) }
      };
    }
    remember(code, answer, moment);
    return answer;
  } catch (error) {
    pausedUntil = moment + PAUSE_AFTER_FAILURE_MS;
    /* Üks rida pausi kohta, ilma koodi ja nimeta: logist on näha, kui tihti register ei vasta. */
    console.warn("[business-register-live] register did not answer, using the copy", error?.name || "Error");
    return UNAVAILABLE;
  }
}

/**
 * Kas profiili nimi vastab äriregistrile.
 *
 * Registrikoodiga: `match`, `mismatch` või `code_not_listed`, registrist endast või (kui register
 * ei vasta) koopiast. Registrikoodita: `code_required` või `free`, alati koopiast. `unavailable`,
 * kui kumbagi ei saa küsida. `source` ütleb, kust vastus tuli (`live` või `copy`).
 *
 * `fetchEntry` ja `file` on testi jaoks.
 */
export async function checkRegisterName(input = {}, { file, fetchEntry = fetchRegisterEntry } = {}) {
  const code = String(input?.registryCode ?? "").trim();
  if (code) {
    const live = await fetchEntry(code);
    if (live?.status === LiveRegisterStatus.FOUND && live.registered) {
      return { ...registerEntryCheck(live.entry, input), source: RegisterNameSource.LIVE };
    }
    if (live?.status === LiveRegisterStatus.FOUND || live?.status === LiveRegisterStatus.NOT_FOUND) {
      return { result: RegisterNameResult.CODE_NOT_LISTED, registerName: null, source: RegisterNameSource.LIVE };
    }
  }
  const names = await loadRegisterNamesOrNull(file ? { file } : undefined);
  return { ...registerNameCheck(names, input), source: RegisterNameSource.COPY };
}

/** Ainult testile: unusta registri vastused ja paus. */
export function resetLiveRegisterCache() {
  answers.clear();
  pausedUntil = 0;
}
