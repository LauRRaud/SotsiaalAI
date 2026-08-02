/**
 * TEENUSPÄEVIK E5 — kuunarratiivi AI-MUSTAND (REPORT_DRAFT).
 *
 * Leping 8.4: „kuunarratiivi mustand = olemasolev dokumendigeneraator sisendiga
 * (perioodi kirjed+märkmed+suunamise eesmärgid); tarbib DOCUMENT_GENERATE
 * kvooti nagu ikka; väljund on MUSTAND kuni inimese kinnituseni."
 *
 * MUDEL EI NÄE ANDMEBAASI. Ta näeb AINULT seda teksti, mille see moodul
 * koostab deterministlikust koondist (`buildNarrativeSeed`). Kaks tagajärge,
 * mõlemad tahtlikud:
 *
 *   1. iga lause, mille mudel kirjutab, on jälgitav kirjeni — koond on
 *      inimesele loetav ja kõrvutatav;
 *   2. mudelile ei jõua midagi, mida koond ei kanna — ei teiste klientide
 *      andmeid, ei kirjete ID-sid, ei osutaja muid kliente.
 *
 * PÄRITOLU EI SULA KOKKU. Märkmed lähevad mudelile KOOS päritolumärgisega ja
 * juhis keelab neid segada: „ta ütles, et ei saa hakkama" ja „mulle tundus, et
 * ta ei saa hakkama" ei ole sama lause. Kui mustand need ühte sulataks, oleks
 * kogu päritolumärgistus mõttetu töö.
 *
 * VÄLJUND ON MUSTAND. Siin ei salvestata midagi: tekst läheb UI-sse, inimene
 * toimetab ja alles tema `PUT` teeb temast narratiivi. Ilma selleta tekiks
 * aruanne, mille all on inimese nimi ja mille sisu ta ei ole lugenud.
 */

import { PROVENANCE } from "./constants.js";

/** Mustandi märgis. Sama mõte, mis SavedAnalysisel: masina tekst on märgistatud. */
export const NARRATIVE_DRAFT_PROVENANCE = PROVENANCE.AI_MUSTAND;

/**
 * Kui pikk tohib koond olla. Ilma piirita saadaks aktiivne kuu mudelile sadu
 * märkmeid ja maksaks kasutaja kvoodist rohkem, kui aruanne väärt on.
 */
export const MAX_SEED_NOTES = 60;

/* Sildid tulevad platvormi ÜHEST päritolusõnastikust (`lib/workspaces/provenance.js`).
   Siin on nad eesti keeles, sest neid loeb mudel, mitte kasutajaliides — UI
   omad tulevad i18n-ist.

   KATE PEAB OLEMA TÄIELIK ja seda kontrollib test. Esimene versioon viitas
   olematule konstandile (`KLIENDI_UTLUS`; õige on `KLIENDI_OELDUD`) — võti
   muutus vaikselt `undefined`-iks ja mudelile läks sildi asemel toores väärtus
   „kliendi_utlus". Produktsiooni-jooks näitas seda; ükski test ei püüdnud,
   sest ükski test ei vaadanud mudelile minevat teksti. */
export const PROVENANCE_LABEL = Object.freeze({
  [PROVENANCE.KLIENDI_OELDUD]: "kliendi öeldud",
  [PROVENANCE.KLIENDI_KINNITATUD]: "kliendi kinnitatud",
  [PROVENANCE.DOKUMENDIST]: "dokumendist",
  [PROVENANCE.TEISE_SPETSIALISTI_INFO]: "teise spetsialisti info",
  [PROVENANCE.TOOTAJA_TAHELEPANEK]: "töötaja tähelepanek",
  [PROVENANCE.TOOTAJA_TOLGENDUS]: "töötaja tõlgendus",
  [PROVENANCE.AI_MUSTAND]: "AI-mustand",
  [PROVENANCE.AMETLIKULT_KONTROLLITUD]: "ametlikult kontrollitud"
});

function provenanceLabel(value) {
  return PROVENANCE_LABEL[value] || String(value || "").toLowerCase() || "märkimata";
}

/**
 * Koond → tekst, mida mudel näeb.
 *
 * KLIENDI NIME SIIN EI OLE. Narratiiv käib ühe kliendi kohta ja kontekst on
 * teada niigi; nime saatmine mudelile lisaks isikuandmeid ilma, et see teksti
 * paremaks teeks. Inimene kirjutab nime ise sinna, kuhu ta kuulub.
 */
export function buildNarrativeSourceText(seed, { month = null } = {}) {
  if (!seed) return "";
  const lines = [];

  lines.push(`Periood: ${month || `${seed.periodFrom || "?"}…${seed.periodTo || "?"}`}`);
  lines.push(`Teenuskirjeid: ${seed.entryCount}`);
  if (seed.hasUnconfirmed) {
    lines.push(`Kinnitamata kirjeid: ${seed.draftCount} (numbrid võivad veel muutuda)`);
  }

  if (seed.totals?.length) {
    lines.push("", "Mahud:");
    for (const total of seed.totals) {
      lines.push(`- ${total.unit}: ${total.total} (${total.visits} korda)`);
    }
  }

  if (seed.activities?.length) {
    lines.push("", "Tegevused sageduse järgi:");
    for (const activity of seed.activities) lines.push(`- ${activity.name}: ${activity.count}`);
  }

  if (seed.goalsText) {
    lines.push("", "Suunamise eesmärgid:", seed.goalsText);
  }

  const notes = Array.isArray(seed.notes) ? seed.notes.slice(0, MAX_SEED_NOTES) : [];
  if (notes.length) {
    lines.push("", "Märkmed (kuupäev · päritolu · sisu):");
    for (const note of notes) {
      const draftMark = note.isDraft ? " [kinnitamata kirje]" : "";
      lines.push(`- ${note.date || "?"} · ${provenanceLabel(note.provenance)}${draftMark} · ${note.note}`);
    }
    if (seed.notes.length > notes.length) {
      /* Väljajätt on NÄHTAV nii mudelile kui hiljem inimesele: vaikne kärpimine
         annaks tervikliku välimusega poole loo. */
      lines.push(`- (veel ${seed.notes.length - notes.length} märget jäi mahupiiri tõttu välja)`);
    }
  }

  return lines.join("\n");
}

/**
 * Juhis mudelile. Eesti keeles, sest väljund on eestikeelne aruanne ja juhise
 * keel kaldub väljundi keelt kaasa tõmbama.
 */
export function buildNarrativeInstruction() {
  return [
    "Kirjuta sotsiaalteenuse kuu sisuline aruanne allpool antud koondi põhjal.",
    "Struktuur: eesmärgid · perioodi tegevused · edenemine eesmärkide suhtes · takistused · ettepanek.",
    "Ettepanek on üks kolmest: jätka samas mahus, muuda mahtu või lõpeta teenus — koos põhjendusega.",
    "ÄRA leiuta fakte, kuupäevi ega inimesi. Kasuta ainult koondis olevat.",
    "HOIA FAKT JA TÕLGENDUS LAHUS: kliendi ütlus, töötaja tähelepanek ja dokument ei ole sama asi.",
    "Kui koondis ei ole millegi kohta infot, kirjuta see välja puuduva infona, ära oleta.",
    "Kirjuta selges eesti keeles, ilma ametnikuvõõrsõnadeta."
  ].join(" ");
}

/**
 * Mustandi ümbris. `provenance` ja `isDraft` käivad tekstiga KAASA, sest just
 * neid on hiljem kõige lihtsam ära kaotada — ja siis oleks masina kirjutatud
 * lõik aruandes eristamatu inimese omast.
 */
export function wrapNarrativeDraft(content, { month = null, generatedAt = null } = {}) {
  return {
    content: String(content || "").trim(),
    provenance: NARRATIVE_DRAFT_PROVENANCE,
    isDraft: true,
    month,
    generatedAt
  };
}
