/* A4 E1 — majandustegevuse registri (MTR) allikaklient.

   MTR EI OLE API. Avalik otsing on Symfony-vorm, mis nõuab sessiooniküpsist ja
   CSRF-tokenit, ja masinloetav väljund tuleb "Väljavõte CSV formaadis" nupu tagant,
   mis ekspordib JOOKSVA otsingu tulemuse. Seega on iga päring kolmesammuline:

     1. GET  /tegevusluba?m=97                → küpsis + CSRF-token
     2. POST /taotluse_tulemus/filter/action  → otsing registrikoodi järgi
     3. GET  /taotluse_tulemus/csv/action     → sama sessiooni tulemus CSV-na

   Kogu moodul on FAIL-SAFE: ta ei viska erindit ja iga ootamatus annab
   `UNCONFIRMED`, mitte tühja või osalist tulemust. See on A4 tähtsaim riiv —
   tühi tulemus tähendaks kutsujale "luba puudub", mis on avalik väide kolmanda
   isiku kohta.

   KOLM ASJA, MIDA SIIN KUNAGI EI TEHTA:
   - ei asendata registri vastust otsitud väärtusega (filter võib olla rakendumata);
   - ei tõlgendata poolikut või vigast rida (parem "ei tea" kui vale luba);
   - ei visata ära tegevuskoha ridu (luba käib teenuse JA koha külge, vt E5).

   Vt `a4-mtr-tegevusloa-kontroll-ulesanne.md`. */

const DEFAULT_BASE_URL = "https://mtr.ttja.ee";
/* MÕÕDETUD 05.08: kogu kolmesammuline ahel võttis päris registri vastu
   ~15 s, seega 8 s ühe päringu kohta oli liiga tihe ja andis TIMEOUT-i
   ka siis, kui register töötas. */
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_USER_AGENT = "SotsiaalAI/1.0 (+https://sotsiaal.ai)";

const LICENCE_PATH = "/tegevusluba?m=97";
const LICENCE_FILTER_ACTION = "/taotluse_tulemus/filter/action";
const LICENCE_CSV_ACTION = "/taotluse_tulemus/csv/action";
const LICENCE_FILTER_KEY = "taotluse_tulemus_filters";

const ENTITY_PATH = "/juriidiline_isik?m=96";
const ENTITY_FILTER_ACTION = "/juriidiline_isik/filter/action";
const ENTITY_CSV_ACTION = "/juriidiline_isik/csv/action";
const ENTITY_FILTER_KEY = "juriidiline_isik_filters";

/* Veerud, milleta tulemust ei saa tõlgendada. Puuduv veerg = SCHEMA_CHANGED. */
const REQUIRED_LICENCE_COLUMNS = Object.freeze([
  "number",
  "ettevõtja nimi",
  "registrikood",
  "kehtivuse algus",
  "kehtiv",
  "tegevusala"
]);

/* Väljundtulbad tellitakse päringus NIMELISELT (väärtused loetud registri
   vormilt 05.08.2026), et parser ei sõltuks MTR-i vaikeseadistusest.
   `tegevusala_liigid` on neist tähtsaim: tema kaudu tuleb erihoolekandeloa
   TÄPNE alateenus, ilma milleta jääks kaetus jämedaks.

   MÕÕDETUD 05.08 päris päringuga: `valjund_valjad[]` ASENDAB vaiketulbad,
   mitte ei lisandu neile — ainult lisatulpade saatmine andis 64-baidise CSV
   kolme veeru ja NULL reaga. Seepärast tuleb baastulbad kaasa saata. */
const BASE_OUTPUT_FIELDS = Object.freeze([
  "number",
  "juriidiline_isik",
  "juriidiline_isik_kood",
  "kehtiv_alates",
  "kehtiv_kuni",
  "taotluse_tulemuse_staatus",
  "tegevusala",
  "lisainfo"
]);

/* `tegevuskohtade_kohtade_arvu_summa` on tellitav, aga MÕÕDETUD 05.08: ta ei
   tule vastusesse oma veeruna — mahupiir jääb „Lisainfo" sisse. Seepärast ei
   telli me teda ega oota tema päist (muidu oleks alarm igavesti püsti). */
const ORDERED_OUTPUT_FIELDS = Object.freeze([
  "tegevusala_liigid",
  "tegevuskoha_aadressid",
  "tegevusloa_valjaandja"
]);

/* Peidetud väljad, milleta otsing ei rakendu. `tulemus_id[]` on kaks korda —
   vormil on ta kaks eraldi peidetud sisendit (4 ja 1). */
const HIDDEN_FILTER_FIELDS = Object.freeze([
  ["[tulemus_id][]", ["4", "1"]],
  ["[seotud_e_resident]", [""]]
]);

/* Tellitud tulpade oodatavad päisenimed. Nende puudumine EI ole fataalne —
   loa identiteet tuleb ikka kohustuslikest veergudest — aga ta tuleb tagasi
   `missingOrderedColumns` all, sest siis langeb kaetus jämedale tasemele ja
   admin peab sellest teada saama. */
const ORDERED_COLUMN_HEADERS = Object.freeze([
  "tegevusala liik",
  "tegevuskoha aadress",
  "tegevusloa väljaandja"
]);

/* Tuntud, aga mittekohustuslikud veerud. Kõik muu tuleb tagasi
   `unknownColumns` all — see on E6 alarmi sisend, mitte viga. */
const OPTIONAL_LICENCE_COLUMNS = Object.freeze([
  "jrk",
  "kehtivuse lõpp",
  "lisainfo",
  "arhiveerimise aeg",
  "ettevõtja aadress",
  "ametlik aadress",
  ...ORDERED_COLUMN_HEADERS
]);

/* Aadressiveeru nimi sõltub sellest, kumb variant telliti ("eraldi ridadel"
   vs "eraldi tulpades"). Meie tellime esimese; ülejäänud on varuks, kui
   korje seadistus kunagi muutub. */
const ADDRESS_COLUMN_CANDIDATES = Object.freeze([
  "tegevuskoha aadress",
  "tegevuskohtade aadressid (eraldi ridadel)",
  "tegevuskohtade aadressid"
]);

const ACTIVITY_TYPE_COLUMN = "tegevusala liik";
const MAX_PERSONS_COLUMN = "maksimaalne isikute arv";

export const MTR_RESULT = Object.freeze({
  OK: "OK",
  UNCONFIRMED: "UNCONFIRMED"
});

export const MTR_REASON = Object.freeze({
  DISABLED: "DISABLED",
  INVALID_REGISTRY_CODE: "INVALID_REGISTRY_CODE",
  SESSION_FAILED: "SESSION_FAILED",
  REQUEST_FAILED: "REQUEST_FAILED",
  TIMEOUT: "TIMEOUT",
  SCHEMA_CHANGED: "SCHEMA_CHANGED",
  ENCODING_FAILED: "ENCODING_FAILED",
  PARSE_FAILED: "PARSE_FAILED",
  MALFORMED_ROW: "MALFORMED_ROW",
  RESULT_MISMATCH: "RESULT_MISMATCH",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR"
});

function baseUrl(options = {}) {
  return String(options.baseUrl || process.env.MTR_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function isDisabled(options = {}) {
  if (options.enabled === false) return true;
  return String(process.env.MTR_DISABLED || "").trim() === "1";
}

function nowIso(options = {}) {
  try {
    return options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function unconfirmed(reason, extra = {}) {
  return {
    status: MTR_RESULT.UNCONFIRMED,
    reason,
    licences: [],
    unknownColumns: [],
    missingOrderedColumns: [],
    checkedAt: null,
    ...extra
  };
}

function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, Math.max(500, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return { signal: controller.signal, dispose: () => clearTimeout(timeout) };
}

/* Eesti registrikood on 8 numbrit, viimane neist kontrollnumber (moodul-11).
   Mittevastavus EI blokeeri päringut — ta on ANOMAALIA, mitte otsus: vale
   algoritm ei tohi ausat osutajat välja lülitada. Formaadiviga blokeerib,
   sest sellega ei saa päringut teha. */
export function normalizeRegistryCode(value) {
  const raw = String(value ?? "").trim();
  /* Tühikud eemaldatakse (inimene kleebib "1702 7241"), aga muu prügi MITTE:
     "1702724A1" ei tohi vaikselt muutuda kehtivaks koodiks "17027241". */
  if (!raw || !/^[\d\s]+$/u.test(raw)) return null;
  const digits = raw.replace(/\s+/gu, "");
  if (digits.length !== 8) return null;
  return digits;
}

export function registryCodeChecksumValid(value) {
  const code = normalizeRegistryCode(value);
  if (!code) return false;
  const digits = code.split("").map(Number);
  const check = digits[7];
  const weigh = (offset) =>
    digits.slice(0, 7).reduce((sum, digit, index) => sum + digit * (((index + offset) % 9) + 1), 0);
  let remainder = weigh(0) % 11;
  if (remainder === 10) remainder = weigh(2) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === check;
}

function parseEstonianDate(value) {
  const match = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(String(value ?? ""));
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  /* 31.02.2026 vormub kuupäevaks, aga mitte selleks, milleks ta kirjutati. */
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseLicensedMaxPersons(value) {
  const match = /maksimaalne\s+isikute\s+arv\s*:?\s*(\d+)/iu.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
}

/* Minimaalne RFC4180-laadne lugeja: jutumärgid, poolitatud jutumärk, CRLF.
   Eraldaja tuvastatakse päisereast — Eesti riigisüsteemid annavad tavaliselt
   semikooloni, aga seda ei eeldata. Sulgemata jutumärk on VIGA, mitte
   tõlgendamise koht. */
export function parseDelimitedText(text) {
  const clean = String(text ?? "").replace(/^﻿/, "");
  if (!clean.trim()) return { delimiter: null, rows: [], unterminatedQuote: false };
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return {
    delimiter,
    unterminatedQuote: quoted,
    rows: rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ""))
  };
}

function headerKey(value) {
  return String(value ?? "").replace(/^﻿/, "").trim().toLocaleLowerCase("et");
}

/* MÕÕDETUD 05.08: MTR-i CSV päis ütleb `charset=utf-8`, aga bait-sisu on
   **windows-1257**. Seepärast ei usu me päist, vaid proovime kodeeringuid
   järjest ja võtame esimese, mis ei tooda asendusmärke. Vigane tekst annaks
   vigased veerunimed ja sealt edasi vale tulemuse. */
/* AINULT kaks kandidaati. `iso-8859-13` dekodeeriks iga baidijada ilma
   asendusmärgita ja muudaks selle valve kasutuks — mojibake läheks vaikselt
   läbi. Kaks kandidaati jätavad valve alles: mõlemas määramata bait annab
   asendusmärgi ja tulemus on `UNCONFIRMED`. */
const CSV_ENCODINGS = Object.freeze(["utf-8", "windows-1257"]);

async function decodeBody(response, options = {}) {
  const forced = options.encoding || process.env.MTR_CSV_ENCODING || null;
  const candidates = forced ? [forced] : CSV_ENCODINGS;
  try {
    const buffer = await response.arrayBuffer();
    for (const encoding of candidates) {
      try {
        const text = new TextDecoder(encoding).decode(buffer);
        if (!text.includes("�")) return { ok: true, text, encoding };
      } catch {
        /* Tundmatu kodeering — proovime järgmist. */
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function collectCookies(response, jar = []) {
  const headers = response?.headers;
  if (!headers) return jar;
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const single = raw.length ? raw : [headers.get?.("set-cookie")].filter(Boolean);
  for (const entry of single) {
    const pair = String(entry).split(";")[0];
    if (!pair.includes("=")) continue;
    const name = pair.split("=")[0];
    const next = jar.filter((cookie) => cookie.split("=")[0] !== name);
    next.push(pair);
    jar = next;
  }
  return jar;
}

function extractCsrfToken(html, filterKey) {
  const pattern = new RegExp(
    `name="${filterKey}\\[_csrf_token\\]"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="${filterKey}\\[_csrf_token\\]"`,
    "i"
  );
  const match = pattern.exec(String(html ?? ""));
  return match ? match[1] || match[2] || null : null;
}

async function request(url, init, options) {
  const timeout = createTimeoutSignal(options.timeoutMs);
  try {
    return {
      ok: true,
      response: await fetch(url, {
        ...init,
        headers: {
          "User-Agent": String(options.userAgent || process.env.MTR_USER_AGENT || DEFAULT_USER_AGENT),
          ...(init?.headers || {})
        },
        cache: "no-store",
        redirect: "follow",
        signal: timeout.signal
      })
    };
  } catch (error) {
    return { ok: false, timedOut: error?.name === "AbortError" };
  } finally {
    timeout.dispose();
  }
}

/* Üks otsing = sessioon + filter + CSV. Kutsuja saab tagasi kas CSV teksti või
   põhjuse, MITTE erindi. */
async function runSearch({ path, filterAction, csvAction, filterKey, fields, hidden = [] }, options = {}) {
  const root = baseUrl(options);

  const bootstrap = await request(`${root}${path}`, { method: "GET" }, options);
  if (!bootstrap.ok) return { ok: false, reason: bootstrap.timedOut ? MTR_REASON.TIMEOUT : MTR_REASON.REQUEST_FAILED };
  if (!bootstrap.response.ok) return { ok: false, reason: MTR_REASON.SESSION_FAILED };

  const jar = collectCookies(bootstrap.response);
  let html = "";
  try {
    html = await bootstrap.response.text();
  } catch {
    return { ok: false, reason: MTR_REASON.SESSION_FAILED };
  }
  const csrfToken = extractCsrfToken(html, filterKey);
  if (!csrfToken) return { ok: false, reason: MTR_REASON.SESSION_FAILED };

  const body = new URLSearchParams();
  body.set(`${filterKey}[_csrf_token]`, csrfToken);
  for (const [name, values] of hidden) {
    for (const entry of values) body.append(`${filterKey}${name}`, entry);
  }
  for (const [name, value] of Object.entries(fields)) {
    /* Väljundtulbad tellitakse massiivina — `set` kirjutaks nad üksteise peale. */
    for (const entry of Array.isArray(value) ? value : [value]) body.append(`${filterKey}${name}`, entry);
  }

  const filtered = await request(
    `${root}${filterAction}`,
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.join("; ") }
    },
    options
  );
  if (!filtered.ok) return { ok: false, reason: filtered.timedOut ? MTR_REASON.TIMEOUT : MTR_REASON.REQUEST_FAILED };
  if (!filtered.response.ok) return { ok: false, reason: MTR_REASON.REQUEST_FAILED };

  const afterFilter = collectCookies(filtered.response, jar);
  const csv = await request(
    `${root}${csvAction}`,
    { method: "GET", headers: { Cookie: afterFilter.join("; ") } },
    options
  );
  if (!csv.ok) return { ok: false, reason: csv.timedOut ? MTR_REASON.TIMEOUT : MTR_REASON.REQUEST_FAILED };
  if (!csv.response.ok) return { ok: false, reason: MTR_REASON.REQUEST_FAILED };

  const decoded = await decodeBody(csv.response, options);
  if (!decoded.ok) return { ok: false, reason: MTR_REASON.ENCODING_FAILED };
  return { ok: true, text: decoded.text };
}

/* Päis → veerukaart. Tagastab ka selle, mida me ei tundnud. */
function readHeader(rows, requiredColumns, optionalColumns) {
  const header = rows[0].map(headerKey);
  const missing = requiredColumns.filter((column) => !header.includes(column));
  const unknownColumns = header.filter(
    (column) => column && !requiredColumns.includes(column) && !optionalColumns.includes(column)
  );
  return { header, missing, unknownColumns };
}

async function fetchLicencesInternal(rawRegistryCode, options) {
  const attemptedAt = nowIso(options);
  const registryCode = normalizeRegistryCode(rawRegistryCode);
  if (!registryCode) {
    return unconfirmed(MTR_REASON.INVALID_REGISTRY_CODE, { registryCode: null, attemptedAt });
  }
  if (isDisabled(options)) return unconfirmed(MTR_REASON.DISABLED, { registryCode, attemptedAt });

  const search = await runSearch(
    {
      path: LICENCE_PATH,
      filterAction: LICENCE_FILTER_ACTION,
      csvAction: LICENCE_CSV_ACTION,
      filterKey: LICENCE_FILTER_KEY,
      hidden: HIDDEN_FILTER_FIELDS,
      fields: {
        "[ettevotte_kood][text]": registryCode,
        "[kehtiv]": "kehtiv",
        "[detailotsing]": "0",
        /* Baastulbad PEAVAD kaasas olema — tellimus asendab vaikeseade. */
        "[valjund_valjad][]": [...BASE_OUTPUT_FIELDS, ...ORDERED_OUTPUT_FIELDS]
      }
    },
    options
  );
  if (!search.ok) return unconfirmed(search.reason, { registryCode, attemptedAt });

  const { rows, unterminatedQuote } = parseDelimitedText(search.text);
  if (unterminatedQuote) return unconfirmed(MTR_REASON.PARSE_FAILED, { registryCode, attemptedAt });
  if (!rows.length) return unconfirmed(MTR_REASON.PARSE_FAILED, { registryCode, attemptedAt });

  const { header, missing, unknownColumns } = readHeader(rows, REQUIRED_LICENCE_COLUMNS, OPTIONAL_LICENCE_COLUMNS);
  if (missing.length) {
    return unconfirmed(MTR_REASON.SCHEMA_CHANGED, { registryCode, attemptedAt, missingColumns: missing });
  }
  const addressColumn = ADDRESS_COLUMN_CANDIDATES.find((column) => header.includes(column)) || null;
  const missingOrderedColumns = ORDERED_COLUMN_HEADERS.filter((column) => !header.includes(column));
  const at = (row, column) => String(row[header.indexOf(column)] ?? "").trim();

  const grouped = new Map();
  let lastLicence = null;
  for (const rawRow of rows.slice(1)) {
    /* Jätkurida lõpeb aadressiveeruga ja on seetõttu PÄISEST LÜHEM. Täidame
       puuduvad lahtrid tühjadega ja otsustame alles siis, kas tegemist on
       jätkureaga või päriselt vigase reaga — vastasel juhul lükkaks
       veergude-arvu kontroll õige rea vigasena tagasi. */
    const row = rawRow.length < header.length ? [...rawRow, ...Array(header.length - rawRow.length).fill("")] : rawRow;
    if (row.length > header.length) {
      return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });
    }

    const number = at(row, "number");
    const organizationName = at(row, "ettevõtja nimi");
    const activity = at(row, "tegevusala");
    const rowRegistryCode = normalizeRegistryCode(at(row, "registrikood"));
    const validFromRaw = at(row, "kehtivuse algus");
    const validUntilRaw = header.includes("kehtivuse lõpp") ? at(row, "kehtivuse lõpp") : "";
    const validRaw = at(row, "kehtiv");
    const rowAddress = addressColumn ? at(row, addressColumn) : "";

    /* JÄTKUREA MUSTER (mõõdetud 05.08): kui luba on mitmes tegevuskohas, tuleb
       iga järgmine koht OMA reana, kus KÕIK identiteedi veerud on tühjad ja
       täidetud on ainult aadress. See ei ole vigane rida — see on eelmise loa
       teine koht, ja just seda infot E5 vajab. */
    const isContinuation = !number && !organizationName && !activity && !rowRegistryCode && Boolean(rowAddress);
    if (isContinuation) {
      const previous = lastLicence;
      if (!previous) return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });
      if (!previous.locations.some((entry) => entry.address === rowAddress)) {
        previous.locations.push({ address: rowAddress, licensedMaxPersons: previous.licensedMaxPersons });
      }
      continue;
    }

    /* Lühem rida, mis EI OLE jätkurida, tähendab, et me ei tea, mis väärtus
       mis veerus on. */
    if (rawRow.length !== header.length || !number || !organizationName || !activity) {
      return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });
    }
    /* IDENTITEET: registri vastust EI asendata otsitud koodiga. Kui filter ei
       rakendunud või eksport kannab võõraid ridu, on ainus aus vastus "ei tea". */
    if (!rowRegistryCode || rowRegistryCode !== registryCode) {
      return unconfirmed(MTR_REASON.RESULT_MISMATCH, { registryCode, attemptedAt });
    }

    const validFrom = parseEstonianDate(validFromRaw);
    if (!validFrom) return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });

    const indefinite = validUntilRaw === "" || /^tähtajatu$/iu.test(validUntilRaw);
    const validUntil = indefinite ? null : parseEstonianDate(validUntilRaw);
    if (!indefinite && !validUntil) {
      return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });
    }

    if (!/^(jah|ei)$/iu.test(validRaw)) {
      return unconfirmed(MTR_REASON.MALFORMED_ROW, { registryCode, attemptedAt });
    }

    const note = header.includes("lisainfo") ? at(row, "lisainfo") : "";
    const address = rowAddress;
    /* Tellitud tulp on täpsem kui Lisainfost välja loetud number. */
    const maxPersonsCell = header.includes(MAX_PERSONS_COLUMN) ? at(row, MAX_PERSONS_COLUMN) : "";
    const licensedMaxPersons = /^\d+$/u.test(maxPersonsCell)
      ? Number(maxPersonsCell)
      : parseLicensedMaxPersons(note);
    /* Erihoolekandeloa TÄPNE alateenus. Tühi väärtus on lubatud (enamikul
       tegevusaladest liiki ei ole) ja tähendab ainult, et täpsust ei tea. */
    const activityType = header.includes(ACTIVITY_TYPE_COLUMN) ? at(row, ACTIVITY_TYPE_COLUMN) : "";
    const key = `${number}|${activity}|${activityType}|${validFrom}|${validUntil ?? ""}`;
    const existing = grouped.get(key);
    const location = address ? { address, licensedMaxPersons } : null;

    if (existing) {
      /* Sama luba, uus tegevuskoha rida — seda EI tohi ära visata, sest E5
         seob märgise teenuse JA koha külge. */
      if (location && !existing.locations.some((entry) => entry.address === location.address)) {
        existing.locations.push(location);
      }
      lastLicence = existing;
      continue;
    }

    const created = {
      number,
      organizationName,
      registryCode: rowRegistryCode,
      activity,
      activityType: activityType || null,
      validFrom,
      validUntil,
      indefinite,
      valid: /^jah$/iu.test(validRaw),
      licensedMaxPersons,
      note: note || null,
      locations: location ? [location] : []
    };
    grouped.set(key, created);
    lastLicence = created;
  }

  return {
    status: MTR_RESULT.OK,
    reason: null,
    registryCode,
    checksumValid: registryCodeChecksumValid(registryCode),
    licences: [...grouped.values()],
    unknownColumns,
    missingOrderedColumns,
    addressColumn,
    attemptedAt,
    /* checkedAt tekib alles siis, kui vastus on päriselt tõlgendatud. */
    checkedAt: nowIso(options)
  };
}

/**
 * Ühe registrikoodi kehtivad tegevusload.
 * Tagastab ALATI objekti; `UNCONFIRMED` tähendab "me ei tea", mitte "luba puudub".
 */
export async function fetchLicencesByRegistryCode(rawRegistryCode, options = {}) {
  try {
    return await fetchLicencesInternal(rawRegistryCode, options);
  } catch {
    /* Viimane kaitsekiht: välise süsteemi ootamatus ei jõua kutsujani erindina. */
    return unconfirmed(MTR_REASON.UNEXPECTED_ERROR, {
      registryCode: normalizeRegistryCode(rawRegistryCode),
      attemptedAt: nowIso()
    });
  }
}

async function resolveEntityInternal(rawRegistryCode, options) {
  const attemptedAt = nowIso(options);
  const registryCode = normalizeRegistryCode(rawRegistryCode);
  const fail = (reason) => ({
    status: MTR_RESULT.UNCONFIRMED,
    reason,
    registryCode,
    found: false,
    name: null,
    attemptedAt
  });

  if (!registryCode) return fail(MTR_REASON.INVALID_REGISTRY_CODE);
  if (isDisabled(options)) return fail(MTR_REASON.DISABLED);

  const search = await runSearch(
    {
      path: ENTITY_PATH,
      filterAction: ENTITY_FILTER_ACTION,
      csvAction: ENTITY_CSV_ACTION,
      filterKey: ENTITY_FILTER_KEY,
      /* Sama muster mis lubadel: väljundtulbad tuleb nimeliselt tellida, muidu
         tuleb CSV, milles registrikoodi veergu ei ole — ja ilma selleta ei saa
         identiteedivärav oma tööd teha. */
      fields: {
        "[registrikood][text]": registryCode,
        "[valjund_valjad][]": ["nimi", "registrikood"]
      }
    },
    options
  );
  if (!search.ok) return fail(search.reason);

  const { rows, unterminatedQuote } = parseDelimitedText(search.text);
  if (unterminatedQuote || !rows.length) return fail(MTR_REASON.PARSE_FAILED);

  const header = rows[0].map(headerKey);
  const nameIndex = header.findIndex((column) => column === "nimi" || column === "ettevõtja nimi");
  const codeIndex = header.indexOf("registrikood");
  /* Registrikoodi veerg on identiteedivärava juures KOHUSTUSLIK — ilma selleta
     ei saa kontrollida, kellest rida räägib. */
  if (nameIndex < 0 || codeIndex < 0) return fail(MTR_REASON.SCHEMA_CHANGED);

  const dataRows = rows.slice(1);
  if (!dataRows.length) {
    /* Tühi tulemus on siin PÄRIS vastus: sellist registrikoodi ei ole. */
    return {
      status: MTR_RESULT.OK,
      reason: null,
      registryCode,
      found: false,
      name: null,
      attemptedAt,
      checkedAt: nowIso(options)
    };
  }

  const match = dataRows.find((row) => normalizeRegistryCode(row[codeIndex]) === registryCode);
  /* Ridu on, aga ükski ei ole meie oma → filter ei rakendunud. Mitte "leitud". */
  if (!match) return fail(MTR_REASON.RESULT_MISMATCH);

  const name = String(match[nameIndex] ?? "").trim();
  if (!name) return fail(MTR_REASON.MALFORMED_ROW);

  return {
    status: MTR_RESULT.OK,
    reason: null,
    registryCode,
    found: true,
    name,
    attemptedAt,
    checkedAt: nowIso(options)
  };
}

/**
 * Kas registrikood vastab MTR-is olemasolevale juriidilisele isikule.
 * See on A4 identiteedivärav: ilma lahendatud koodita EI TOHI kunagi tekkida
 * avalikku väidet "sellel teenusel puudub tegevusluba" — me ei tea siis, kelle
 * kohta me küsisime.
 */
export async function resolveEntityByRegistryCode(rawRegistryCode, options = {}) {
  try {
    return await resolveEntityInternal(rawRegistryCode, options);
  } catch {
    return {
      status: MTR_RESULT.UNCONFIRMED,
      reason: MTR_REASON.UNEXPECTED_ERROR,
      registryCode: normalizeRegistryCode(rawRegistryCode),
      found: false,
      name: null,
      attemptedAt: nowIso()
    };
  }
}
