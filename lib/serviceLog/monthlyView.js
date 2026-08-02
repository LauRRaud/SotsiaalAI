/**
 * TEENUSPÄEVIK-V1 E4 — KUUVAADE JA RÜTM.
 *
 * Kuu lõpp on see hetk, mille pärast kogu moodul olemas on: „aruandlusele
 * kulub rohkem aega kui päris tööle". Siin koondatakse juba sisestatud kirjed
 * nii, et neist saaks esitise ilma uue sisestuseta.
 *
 * KOLM REEGLIT, mis kõik on arve tagajärjega:
 *
 * 1. ÜHIKUID EI LIIDETA. „12" ei tähenda midagi, kui ta on 8 tundi pluss
 *    4 korda. Iga summa kannab oma ühikut ja eri ühikud jäävad eri ridadeks.
 *
 * 2. TÜHISTATUD KIRJE EI OLE ARUANDES. Ta jääb andmebaasi (jälg), aga esitisse
 *    ta ei kuulu — muidu esitaks osutaja arve töö eest, mille ta ise tühistas.
 *
 * 3. MUSTAND ON NÄHTAV, AGA ERALDI. Kuuvaade peab ütlema „sul on 3 kinnitamata
 *    kirjet", mitte neid vaikselt summasse lisama ega vaikselt ära jätma.
 *    Esitamata mustand on kõige tavalisem põhjus, miks kuu maht on vale.
 *
 * Puhas moodul: sisse kirjed, välja koond. Ilma DB-ta testitav.
 */

import { ENTRY_STATUS } from "./constants.js";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `YYYY-MM` → `{ year, month }` (month on 1..12). */
export function parseMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Kliendi võti. Platvormi kasutaja ja väline nimi on ERI rajad ja neid ei tohi
 * kokku sulatada: sama nimega väline klient ei ole sama inimene, kes platvormi
 * konto omanik.
 */
export function clientKey(entry) {
  if (entry?.clientUserId) return `user:${entry.clientUserId}`;
  if (entry?.clientDisplayName) return `name:${entry.clientDisplayName}`;
  return "unknown";
}

/**
 * Kuu koond kliendi ja teenuse kaupa.
 *
 * @param entries kirjed (juba selle kuu omad VÕI filtreeritakse siin `month` järgi)
 */
export function buildMonthlySummary(entries = [], { month = null } = {}) {
  const window = parseMonth(month);

  const clients = new Map();
  const totalsByUnit = new Map();
  let draftCount = 0;
  let voidCount = 0;
  let finalCount = 0;

  for (const entry of entries) {
    const date = toDate(entry?.date);
    if (window) {
      if (!date) continue;
      if (date.getUTCFullYear() !== window.year || date.getUTCMonth() + 1 !== window.month) continue;
    }

    if (entry.status === ENTRY_STATUS.VOID) {
      // Jälg jääb, aruandesse ta ei kuulu.
      voidCount += 1;
      continue;
    }

    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const isDraft = entry.status === ENTRY_STATUS.DRAFT;
    if (isDraft) draftCount += 1;
    else finalCount += 1;

    const key = clientKey(entry);
    if (!clients.has(key)) {
      clients.set(key, {
        key,
        clientUserId: entry.clientUserId || null,
        clientDisplayName: entry.clientDisplayName || null,
        clientExternalRef: entry.clientExternalRef || null,
        services: new Map(),
        entryCount: 0,
        draftCount: 0
      });
    }
    const client = clients.get(key);
    client.entryCount += 1;
    if (isDraft) client.draftCount += 1;

    /* Ühik on osa võtmest: sama teenus tunnis ja korras on kaks eri rida.
       Nende liitmine annaks numbri, mis näeb õige välja ja ei ole seda. */
    const serviceKey = `${entry.serviceId || "none"}|${entry.unit}`;
    if (!client.services.has(serviceKey)) {
      client.services.set(serviceKey, {
        serviceId: entry.serviceId || null,
        unit: entry.unit,
        final: 0,
        draft: 0,
        entryCount: 0
      });
    }
    const service = client.services.get(serviceKey);
    service.entryCount += 1;
    if (isDraft) service.draft += quantity;
    else service.final += quantity;

    const unitTotal = totalsByUnit.get(entry.unit) || { unit: entry.unit, final: 0, draft: 0 };
    if (isDraft) unitTotal.draft += quantity;
    else unitTotal.final += quantity;
    totalsByUnit.set(entry.unit, unitTotal);
  }

  return {
    month: month || null,
    clients: [...clients.values()]
      .map((client) => ({
        ...client,
        services: [...client.services.values()].map((service) => ({
          ...service,
          final: round2(service.final),
          draft: round2(service.draft),
          total: round2(service.final + service.draft)
        }))
      }))
      .sort((a, b) =>
        String(a.clientDisplayName || a.clientUserId || "").localeCompare(
          String(b.clientDisplayName || b.clientUserId || "")
        )
      ),
    totalsByUnit: [...totalsByUnit.values()].map((total) => ({
      ...total,
      final: round2(total.final),
      draft: round2(total.draft),
      total: round2(total.final + total.draft)
    })),
    entryCounts: { final: finalCount, draft: draftCount, voided: voidCount },
    /* ÜKS number, mille osutaja peab kuu lõpus nägema: mitu kirjet on veel
       kinnitamata. Esitamata mustand on kõige tavalisem põhjus, miks kuu maht
       on vale. */
    unconfirmed: draftCount
  };
}

/**
 * TÄHTAEG. Riigi Teataja KOV-korrad ütlevad tüüpiliselt: aruanne järgmise kuu
 * 10. kuupäevaks. Meeldetuletus tuleb 5-ndal ja ta on ÜKS.
 *
 * „Üks leebe meeldetuletus" on tootenõue, mitte tehniline detail: platvormi
 * edu mõõdik on aruandlusele kuluva aja LANGUS, ja iga lisameeldetuletus
 * liigub vastupidises suunas.
 */
export const REPORT_DUE_DAY = 10;
export const REPORT_REMINDER_DAY = 5;

export function reportDeadlineFor(month) {
  const parsed = parseMonth(month);
  if (!parsed) return null;
  // Järgmise kuu 10. kuupäev.
  return new Date(Date.UTC(parsed.year, parsed.month, REPORT_DUE_DAY));
}

export function reportReminderFor(month) {
  const parsed = parseMonth(month);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month, REPORT_REMINDER_DAY));
}

/**
 * Kas SELLE kuu meeldetuletus tuleks praegu saata.
 *
 * Tagastab ka `dueAt` ja `overdue`, et kutsuja ei peaks kuupäeva-loogikat
 * kordama — kordamine on täpselt see koht, kus tähtaeg hakkab kahes kohas
 * erinema.
 */
export function evaluateReportRhythm(month, { now = new Date(), unconfirmed = 0, remindedAt = null } = {}) {
  const dueAt = reportDeadlineFor(month);
  const remindAt = reportReminderFor(month);
  if (!dueAt || !remindAt) return null;

  const already = Boolean(toDate(remindedAt));
  const reached = now.getTime() >= remindAt.getTime();
  const overdue = now.getTime() > dueAt.getTime();

  return {
    month,
    dueAt,
    remindAt,
    overdue,
    unconfirmed,
    /* Meeldetuletus on ÜKS: `remindedAt` olemasolu sulgeb ta lõplikult, ka
       siis, kui aruanne on endiselt esitamata. Teine meeldetuletus oleks
       nügimine, mitte teenus. */
    shouldRemind: reached && !already
  };
}

/**
 * KVALITEEDIJUHISE AASTASED RÜTMID.
 *
 * NB TÄHTIS SÕNASTUSPIIR (parandatud 30.07.2026): tagasisideküsitlus ja
 * kliendi vahehindamine tulevad SKA **kvaliteedijuhisest**, MITTE seadusest.
 * Seadusest tuleneb kohustus märgata abivajaduse muutumist ja sellele
 * reageerida — mitte kalendripõhine aastane vahehindamine.
 *
 * Mõju tootele: neid meeldetuletusi EI TOHI kuvada kui seadusest tulenevat
 * nõuet. Vale vastavusväide töövahendis on tõsisem viga kui puuduv
 * meeldetuletus, sest töövahendit usutakse. Seepärast kannab iga rütm
 * `source`-välja, mille UI peab välja kuvama.
 */
export const ANNUAL_RHYTHMS = Object.freeze([
  Object.freeze({
    key: "feedback_survey",
    source: "quality_guide",
    intervalMonths: 12
  }),
  Object.freeze({
    key: "interim_assessment",
    source: "quality_guide",
    intervalMonths: 12
  })
]);

export function evaluateAnnualRhythms({ now = new Date(), lastDoneAt = {} } = {}) {
  return ANNUAL_RHYTHMS.map((rhythm) => {
    const last = toDate(lastDoneAt?.[rhythm.key]);
    const dueAt = last
      ? new Date(Date.UTC(last.getUTCFullYear() + 1, last.getUTCMonth(), last.getUTCDate()))
      : null;
    return {
      ...rhythm,
      lastDoneAt: last ? last.toISOString() : null,
      dueAt: dueAt ? dueAt.toISOString() : null,
      /* Ilma varasema kirjeta ei väida me, et miski on „üle tähtaja" — me ei
         tea, kas seda on kunagi tehtud. Ta on lihtsalt tegemata. */
      due: dueAt ? now.getTime() >= dueAt.getTime() : false,
      neverDone: !last
    };
  });
}
