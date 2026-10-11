import { runOpenAIPrivacyFilter } from "./openaiPrivacyFilter.js";

/**
 * KOHALIK ISIKUANDMETE TUVASTAJA.
 *
 * Mõõdetud 11.10.2026 (25 tavalist lauset): vana telefonireegel „7 või 8 numbrit, vahel tühik
 * või kriips" pidas telefoninumbriks kuupäeva 2026-10-11, summa 12 345 678, arve- ja
 * viitenumbri, registrikoodi, IBAN-i keskosa ja sõna sees olevad numbrid; aadressireegel oli
 * tõstutundetu ja varjas koos tänavaga kuni neli eelnevat sõna. 13 lauset 25-st said vale
 * hoiatuse. Iga vale hoiatus õpetab inimest hoiatust lugemata kinni vajutama, seega on täpsus
 * siin sama tähtis kui leidmine.
 *
 * Reeglid on tahtlikult kitsad:
 *   - telefon: Eesti number (7 või 8 numbrit, algab 3–8-ga), valikuline riigikood, vahel
 *     ainult tühik; ei ole osa pikemast numbrist, kuupäevast, sõnast ega summast;
 *   - isikukood: 11 numbrit, kehtiv kuu ja päev ning õige kontrollnumber;
 *   - aadress: suure tähega tänavanimi, tänava liik ja majanumber;
 *   - e-post: iga aadress.
 * Asutuse üldist telefoni, aadressi ja postkasti ei saa inimese omast eristada: need
 * märgatakse endiselt ja inimene otsustab ise.
 */
/* Kandidaat: valikuline +372 / 00372 / 372, siis 7 või 8 numbrit, mille vahel võib olla
   üks tühik (ka sisetühik). Ei alga tähe, numbri ega numbri külge kuuluva märgi järel ega
   jätku numbriga. */
const PHONE_CANDIDATE = /(?<![\p{L}\p{N}_@/.,+-])(?:(?:\+|00)?372[ \u00a0\u202f-]?)?\d(?:[ \u00a0\u202f]?\d){6,7}(?![ \u00a0\u202f]?\d)(?![\p{L}_@-])/gu;
/* Sõnad, mille järel tulev number ei ole telefon. */
const NOT_PHONE_LABEL = /(?:registri(?:kood|number|nr)|reg\.?\s*(?:kood|nr)|viitenumber|viitenr|arve(?:\s+(?:nr|number))?|lepingu(?:\s+(?:nr|number))?|toimiku(?:\s+(?:nr|number))?|otsuse(?:\s+(?:nr|number))?|käskkirja(?:\s+(?:nr|number))?|määruse(?:\s+(?:nr|number))?|tellimuse(?:\s+(?:nr|number))?|kood)[\s.:#]*$/iu;
/* Ühik kohe numbri järel: see on summa või kogus. */
const UNIT_AFTER = /^[ \u00a0\u202f]?(?:€|eur|sent|kroon|tk(?![\p{L}])|%)/iu;
/* Tuhandete kaupa rühmitatud ümmargune arv (5 000 000, 45 000 000). */
const ROUND_AMOUNT = /^\d{1,2}[ \u00a0\u202f]\d{3}[ \u00a0\u202f]000$/u;

function isPhoneNumber(source, match) {
  const text = String(match[0]);
  const start = Number(match.index);
  const digits = text.replace(/\D/gu, "");
  const withCountry = digits.length > 8;
  const local = withCountry ? digits.replace(/^(?:00)?372/u, "") : digits;
  if (local.length < 7 || local.length > 8 || !/^[3-8]/u.test(local)) return false;
  /* Riigikoodiga number on telefon ka siis, kui ümbrus midagi muud vihjab. */
  if (withCountry) return true;
  if (ROUND_AMOUNT.test(text)) return false;
  if (NOT_PHONE_LABEL.test(source.slice(Math.max(0, start - 40), start))) return false;
  return !UNIT_AFTER.test(source.slice(start + text.length, start + text.length + 8));
}

/* Eesti isikukood: sugu ja sajand, sünnikuupäev, järjekorranumber ja kontrollnumber. Suvaline
   11-kohaline number (viitenumber, tellimuse number) kontrollnumbrit üldjuhul ei läbi. */
export function isEstonianPersonalCode(value) {
  const code = String(value || "");
  if (!/^[1-6]\d{10}$/u.test(code)) return false;
  const month = Number(code.slice(3, 5));
  const day = Number(code.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const digits = [...code].map(Number);
  const weighted = (weights) => weights.reduce((total, weight, index) => total + weight * digits[index], 0);
  let check = weighted([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]) % 11;
  if (check === 10) {
    check = weighted([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]) % 11;
    if (check === 10) check = 0;
  }
  return check === digits[10];
}

const PERSONAL_DATA_PATTERNS = Object.freeze([
  {
    type: "email",
    label: "e-posti aadress",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu
  },
  {
    type: "phone",
    label: "telefoninumber",
    pattern: PHONE_CANDIDATE,
    accept: isPhoneNumber
  },
  {
    type: "estonian_personal_code",
    label: "isikukood",
    pattern: /(?<![\p{L}\p{N}])[1-6]\d{10}(?![\p{L}\p{N}])/gu,
    accept: (_source, match) => isEstonianPersonalCode(match[0])
  },
  {
    type: "address",
    label: "aadress",
    /* Tõstutundlik: tänavanime iga sõna algab suure tähega. Tõstutundetu reegel võttis kaasa
       ka tänavale eelnevad tavasõnad („Vallavalitsus asub aadressil Tartu mnt 5"). */
    pattern: /(?<![\p{L}\p{N}])\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}[\p{L}.'-]*){0,3}\s+(?:tn|tänav|tee|mnt|maantee|pst|puiestee|põik|plats|väljak)\.?\s+\d+[a-zA-Z]?(?:[-/]\d+)?(?![\p{L}\p{N}])/gu
  }
]);

function findLocalPersonalDataSpans(value = "") {
  const source = String(value || "");
  if (!source.trim()) return [];

  const spans = [];
  for (const rule of PERSONAL_DATA_PATTERNS) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const text = String(match?.[0] || "");
      const start = Number(match?.index);
      if (!text || !Number.isFinite(start)) continue;
      if (rule.accept && !rule.accept(source, match)) continue;
      spans.push({
        type: rule.type,
        label: rule.label,
        text,
        start,
        end: start + text.length,
        provider: "local_regex"
      });
    }
  }

  return spans;
}

function mergeSpans(spans = []) {
  return spans
    .filter((span) => Number.isFinite(span?.start) && Number.isFinite(span?.end) && span.end > span.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((accepted, span) => {
      const overlaps = accepted.some((item) => span.start < item.end && span.end > item.start);
      if (!overlaps) accepted.push(span);
      return accepted;
    }, []);
}

export function detectPersonalData(...values) {
  const source = values
    .map((value) => String(value || ""))
    .join("\n")
    .trim();
  if (!source) {
    return {
      hasPersonalData: false,
      categories: [],
      findings: []
    };
  }

  const spans = findPersonalDataSpans(source);
  const grouped = new Map();
  for (const span of spans) {
    const key = span.type;
    const current = grouped.get(key) || {
      type: span.type,
      label: span.label,
      count: 0,
      provider: span.provider || "local_regex"
    };
    current.count += 1;
    if (current.provider !== span.provider && span.provider === "openai_privacy_filter") {
      current.provider = span.provider;
    }
    grouped.set(key, current);
  }
  const findings = [...grouped.values()];

  return {
    hasPersonalData: findings.length > 0,
    categories: findings.map((finding) => finding.type),
    findings
  };
}

function findPersonalDataSpans(value = "") {
  const source = String(value || "");
  if (!source.trim()) return [];

  const openAIResult = runOpenAIPrivacyFilter(source);
  return mergeSpans([
    ...(Array.isArray(openAIResult?.spans) ? openAIResult.spans : []),
    ...findLocalPersonalDataSpans(source)
  ]);
}

export function redactPersonalData(value = "") {
  const source = String(value || "");
  const spans = findPersonalDataSpans(source);
  if (!spans.length) {
    return {
      redactedText: source,
      spans
    };
  }

  let cursor = 0;
  const parts = [];
  for (const span of spans) {
    parts.push(source.slice(cursor, span.start));
    parts.push(`[${span.label}]`);
    cursor = span.end;
  }
  parts.push(source.slice(cursor));

  return {
    redactedText: parts.join(""),
    spans
  };
}

export function buildPersonalDataWarning(result) {
  const findings = Array.isArray(result?.findings) ? result.findings : [];
  if (!findings.length) return "";
  /* Eestikeelne vaikelause. Lehele minevas vastuses tõlgib selle lehe keelde
     `localizePrivacyPayload` (`privacyTexts.js`, võti `privacy_guard.warning`). */
  const labels = findings.map((finding) => finding.label).join(", ");
  return `Tekstis võib olla isikuandmeid: ${labels}. Saada ainult see, mida on päriselt vaja.`;
}
