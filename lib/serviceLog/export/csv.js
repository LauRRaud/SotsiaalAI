/**
 * TEENUSPÄEVIK-V1 E6 — CSV-väljund.
 *
 * Vorming on mallist LAHUS: mall annab dokumendistruktuuri, see moodul teeb
 * temast faili. Nii ei pea uus KOV-i vorm puutuma vormindust ja uus vorming
 * (PDF, DOCX) ei pea puutuma malle.
 *
 * KOLM ASJA, MIS ON TEADLIKUD:
 *
 * 1. CSV-SÜSTI KAITSE. Excelis on lahter, mis algab `=`, `+`, `-` või `@`,
 *    VALEM — mitte tekst. Kliendi nimeks pandud `=cmd|...` käivituks aruande
 *    avaja masinal. Eksport läheb KOV-i raamatupidajale, seega see ei ole
 *    teoreetiline: prefiksime sellised väärtused ülakomaga, nagu OWASP soovitab.
 *    Väärtus jääb loetavaks, valemiks ta ei muutu.
 *
 * 2. SEMIKOOLON JA BOM. Eesti Exceli lokaadis on loendieraldaja semikoolon ja
 *    ilma BOM-ita muutuvad täpitähed prügiks. Koma-CSV oleks „standardsem" ja
 *    avaneks siinsel kasutajal katki — eraldaja on seadistatav, vaikeväärtus
 *    järgib päris kasutajat.
 *
 * 3. TÜHI VÄÄRTUS ON TÜHI, MITTE "null". Aruandes on `null` sõnana müra, mida
 *    lugeja peab tõlgendama.
 */

/* JUHTIVAD TÜHIKUD MÖÖDUSID VAREM KAITSEST: `"  =SUM(A1)"` jõudis Excelisse
   VALEMINA, sest muster nõudis riskantset märki esimeselt positsioonilt.
   Repos on juba tugevam variant (`lib/wellbeing/aggregateExport.js` `csvCell`,
   muster `/^[ \t]*[=+\-@]/`) — võtame temalt ja laiendame kõigile
   tühimärkidele. Kaks eri tugevusega kaitset samas koodibaasis on halvim
   variant: nõrgemat usutakse, kuni ta läbi laseb. */
const RISKY_PREFIX = /^[\s ]*[=+\-@]/;

export const CSV_BOM = "﻿";

/**
 * @param value suvaline väärtus
 * @param delimiter eraldaja, mille suhtes jutumärgistada
 */
export function escapeCsvValue(value, delimiter = ";") {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (text === "") return "";

  // CSV-süsti kaitse — vt mooduli päis.
  if (RISKY_PREFIX.test(text)) text = `'${text}`;

  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r");
  if (!needsQuotes) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(columns, rows, { delimiter = ";" } = {}) {
  const lines = [columns.map((column) => escapeCsvValue(column, delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column], delimiter)).join(delimiter));
  }
  return lines.join("\r\n");
}

/**
 * Dokumendistruktuur → CSV-tekst.
 *
 * Päis ja jalus lähevad faili KAASA. Ilma nendeta on tabel numbrid ilma
 * kontekstita: kes esitas, kellele, mis perioodi eest — ja just neid küsib
 * raamatupidaja esimesena.
 */
export function documentToCsv(document, { delimiter = ";", withBom = true } = {}) {
  if (!document) return "";
  const parts = [];

  for (const [key, value] of document.header || []) {
    parts.push([escapeCsvValue(key, delimiter), escapeCsvValue(value, delimiter)].join(delimiter));
  }
  if (document.header?.length) parts.push("");

  if (document.columns) {
    parts.push(rowsToCsv(document.columns, document.rows || [], { delimiter }));
  }

  /* Mall C ei ole tabel: tema sektsioonid kirjutatakse võti-väärtus ridadena,
     et ka tema oleks CSV-na loetav ilma eraldi vormingut ootamata. */
  if (document.sections) {
    for (const section of document.sections) {
      /* ETTEPANEKU VÄÄRTUS EI TOHI KADUDA MÄRKUSE TAHA. Varem võttis `||`
         esimese tõese välja ja märkusega ettepanekul jäi CONTINUE /
         CHANGE_VOLUME / END välja — just see, mida KOV otsusena loeb. */
      if (section.value !== undefined && section.value !== null && section.value !== "") {
        parts.push(
          [escapeCsvValue(`${section.key}:value`, delimiter), escapeCsvValue(section.value, delimiter)].join(
            delimiter
          )
        );
      }
      if (section.totals?.length) {
        parts.push(
          [
            escapeCsvValue(`${section.key}:totals`, delimiter),
            escapeCsvValue(section.totals.map((row) => `${row.quantity} ${row.unit}`).join(", "), delimiter)
          ].join(delimiter)
        );
      }
      if (section.activities?.length) {
        parts.push(
          [
            escapeCsvValue(`${section.key}:activities`, delimiter),
            escapeCsvValue(section.activities.map((row) => `${row.name} ×${row.count}`).join(", "), delimiter)
          ].join(delimiter)
        );
      }
      if (section.text) {
        parts.push([escapeCsvValue(section.key, delimiter), escapeCsvValue(section.text, delimiter)].join(delimiter));
      }
    }
  }

  /* JALUS LÄHEB FAILI KAASA. Varem kadus ta CSV-s ära: kliendi ja teenuse
     kaupa summad, kirjete arv ja koostaja on täpselt need read, mida KOV-i
     raamatupidaja esimesena otsib. */
  if (document.footer?.byClientAndService?.length) {
    parts.push("");
    parts.push(
      ["client", "referralNumber", "service", "unit", "quantity"]
        .map((column) => escapeCsvValue(column, delimiter))
        .join(delimiter)
    );
    for (const row of document.footer.byClientAndService) {
      parts.push(
        [row.client, row.referralNumber, row.service, row.unit, row.quantity]
          .map((value) => escapeCsvValue(value, delimiter))
          .join(delimiter)
      );
    }
  }

  if (document.footer?.totals?.length) {
    parts.push("");
    for (const total of document.footer.totals) {
      parts.push(
        [escapeCsvValue(`total:${total.unit}`, delimiter), escapeCsvValue(total.quantity, delimiter)].join(
          delimiter
        )
      );
    }
  }

  if (document.footer?.totalClients !== undefined) {
    parts.push(
      [escapeCsvValue("totalClients", delimiter), escapeCsvValue(document.footer.totalClients, delimiter)].join(
        delimiter
      )
    );
  }

  for (const [key, value] of [
    ["entryCount", document.footer?.entryCount],
    ["preparedBy", document.footer?.preparedBy],
    ["preparedAt", document.footer?.preparedAt]
  ]) {
    if (value === undefined || value === null || value === "") continue;
    parts.push([escapeCsvValue(key, delimiter), escapeCsvValue(value, delimiter)].join(delimiter));
  }

  /* HOIATUSED LÄHEVAD FAILI KAASA. Kui mustandid jäid välja, peab seda nägema
     ka see, kes faili hiljem avab — mitte ainult see, kes ta eksportis. */
  for (const warning of document.warnings || []) {
    parts.push(
      [escapeCsvValue(`warning:${warning.code}`, delimiter), escapeCsvValue(warning.count ?? "", delimiter)].join(
        delimiter
      )
    );
  }

  const body = parts.join("\r\n");
  return withBom ? CSV_BOM + body : body;
}
