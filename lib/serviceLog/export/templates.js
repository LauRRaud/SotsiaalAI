/**
 * TEENUSPÄEVIK-V1 E6 — EKSPORDI MALLIMOOTOR.
 *
 * See moodul lunastab DoD punktid 2 ja 3: „kuu lõpus sünnib TERVIKLIK esitis
 * kahe klõpsuga" ja „mitut KOV-i teenindav osutaja ekspordib igaühele TEMA
 * kujul ÜHEST sisestusest".
 *
 * ARHITEKTUUR: iga mall on PUHAS FUNKTSIOON, mis võtab sama aatomi (kirjed +
 * suunamine + narratiiv) ja annab normaliseeritud DOKUMENDISTRUKTUURI. Vorming
 * (CSV, PDF, DOCX) on eraldi kiht. Seepärast ei ole uus KOV-i vorm uus KOOD,
 * vaid uus MALL — see on kogu lepingu „värav muutub sisuks, mitte ehituseks"
 * põhimõtte tehniline kandja.
 *
 * NELI REEGLIT, MIS KEHTIVAD KÕIGIS MALLIDES:
 *
 * 1. TÜHISTATUD KIRJE EI OLE ÜHESKI EKSPORDIS. Ta jääb andmebaasi jäljena, aga
 *    esitisse ta ei kuulu.
 *
 * 2. MUSTANDID EI LÄHE ARVE ALUSDOKUMENTI. Eksport sisaldab vaikimisi AINULT
 *    kinnitatud kirjeid. Kinnitamata töö esitamine tähendaks arvet töö eest,
 *    mida osutaja ise ei ole veel kinnitanud. Kutsuja saab mustandid
 *    sõnaselgelt kaasa võtta (`includeDrafts`) — aga siis on nad reas
 *    MÄRGITUD, mitte peidetud.
 *
 * 3. ÜHIKUID EI LIIDETA. Summad on ühiku kaupa; „12" ei tähenda midagi, kui ta
 *    on 8 tundi pluss 4 korda.
 *
 * 4. TUNDLIK SISU EI LÄHE VAIKIMISI KAASA. Mall A on MAHUARUANNE — temas ei ole
 *    märkmeid. Sisu läheb ainult sinna, kus ta on nõutud (mall B tähelepanekud,
 *    mall C narratiiv), sest minimeerimine on lepingu 8.9 nõue.
 */

import { ENTRY_STATUS } from "../constants.js";
import { deriveTravelMinutes } from "../entryDerivation.js";

export const TEMPLATE = Object.freeze({
  A_TIMESHEET: "A_TIMESHEET",
  B_CARE_DIARY: "B_CARE_DIARY",
  C_NARRATIVE: "C_NARRATIVE",
  D_STATISTICS: "D_STATISTICS"
});

export const TEMPLATES = Object.freeze(Object.values(TEMPLATE));

export function isTemplate(value) {
  return typeof value === "string" && TEMPLATES.includes(value);
}

/** Mall A kaks varianti SAMADEST andmetest (leping ptk 6a). */
export const TIMESHEET_VARIANT = Object.freeze({
  DAILY: "DAILY",
  MONTHLY: "MONTHLY"
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function isoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function isoTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(11, 16);
}

function clientLabel(entry) {
  return entry?.clientDisplayName || entry?.clientUserId || "";
}

/**
 * Ühine eelfilter. KÕIK mallid käivad siit läbi — nii ei saa ükski neist
 * kogemata tühistatud või kinnitamata tööd esitada.
 */
export function selectExportableEntries(entries = [], { includeDrafts = false } = {}) {
  return entries.filter((entry) => {
    if (!entry) return false;
    if (entry.status === ENTRY_STATUS.VOID) return false;
    if (!includeDrafts && entry.status === ENTRY_STATUS.DRAFT) return false;
    return true;
  });
}

function sumsByClientAndService(entries) {
  const totals = new Map();
  for (const entry of entries) {
    const key = `${clientLabel(entry)}|${entry.serviceName || entry.serviceId || ""}|${entry.unit}`;
    const row = totals.get(key) || {
      client: clientLabel(entry),
      service: entry.serviceName || entry.serviceId || "",
      unit: entry.unit,
      quantity: 0,
      entries: 0
    };
    row.quantity += Number(entry.quantity) || 0;
    row.entries += 1;
    totals.set(key, row);
  }
  return [...totals.values()].map((row) => ({ ...row, quantity: round2(row.quantity) }));
}

function totalsByUnit(entries) {
  const totals = new Map();
  for (const entry of entries) {
    const row = totals.get(entry.unit) || { unit: entry.unit, quantity: 0 };
    row.quantity += Number(entry.quantity) || 0;
    totals.set(entry.unit, row);
  }
  return [...totals.values()].map((row) => ({ ...row, quantity: round2(row.quantity) }));
}

/**
 * MALL A — tööajaarvestus / mahuaruanne. Universaalne, arve LISA.
 *
 * Kaks varianti samadest andmetest: `DAILY` kirjutab iga kirje lahti,
 * `MONTHLY` annab kliendi ja teenuse kaupa summad. KOV-id nõuavad üht või
 * teist ja see on SEADISTUS, mitte uus mall.
 *
 * MÄRKMEID SIIN EI OLE. See on mahuaruanne — tundliku sisu lisamine muudaks
 * arve lisa dokumendiks, mida ei tohi raamatupidamisele saata.
 */
export function buildTimesheet({
  provider = {},
  recipient = {},
  period = {},
  entries = [],
  variant = TIMESHEET_VARIANT.DAILY,
  includeDrafts = false,
  includeClientConfirmation = false,
  includeTravelTime = false
} = {}) {
  const rows = selectExportableEntries(entries, { includeDrafts });

  const header = [
    ["provider", provider.name || ""],
    ["registryCode", provider.registryCode || ""],
    ["recipient", recipient.name || ""],
    ["period", `${period.from || ""}…${period.to || ""}`],
    ["contractRef", recipient.contractRef || ""]
  ];

  if (variant === TIMESHEET_VARIANT.MONTHLY) {
    const summed = sumsByClientAndService(rows);
    return {
      template: TEMPLATE.A_TIMESHEET,
      variant,
      header,
      columns: ["client", "referralNumber", "service", "unit", "quantity"],
      rows: summed.map((row) => ({
        client: row.client,
        referralNumber: "",
        service: row.service,
        unit: row.unit,
        quantity: row.quantity
      })),
      footer: { totals: totalsByUnit(rows), entryCount: rows.length },
      warnings: buildWarnings(entries, rows, includeDrafts)
    };
  }

  const columns = [
    "client",
    "referralNumber",
    "date",
    "service",
    "activities",
    "unit",
    "quantity",
    "worker"
  ];
  if (includeTravelTime) columns.push("travelMinutes");
  /* Kliendi kinnituse veerg on SEADISTUS, mitte vaikimisi: ainult osa KOV-e
     nõuab allkirja tööajalehel ja tühi veerg teistele oleks müra. */
  if (includeClientConfirmation) columns.push("clientConfirmed");
  if (includeDrafts) columns.push("status");

  return {
    template: TEMPLATE.A_TIMESHEET,
    variant: TIMESHEET_VARIANT.DAILY,
    header,
    columns,
    rows: rows
      .slice()
      .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)) || isoDate(a.date).localeCompare(isoDate(b.date)))
      .map((entry) => {
        const row = {
          client: clientLabel(entry),
          referralNumber: entry.referralNumber || "",
          date: isoDate(entry.date),
          service: entry.serviceName || entry.serviceId || "",
          activities: (entry.activities || []).join(", "),
          unit: entry.unit,
          quantity: round2(Number(entry.quantity) || 0),
          worker: entry.workerName || ""
        };
        if (includeTravelTime) row.travelMinutes = deriveTravelMinutes(entry) ?? "";
        if (includeClientConfirmation) {
          row.clientConfirmed = entry.confirmedByClientAt
            ? isoDate(entry.confirmedByClientAt)
            : entry.confirmedManually
              ? "manual"
              : "";
        }
        if (includeDrafts) row.status = entry.status;
        return row;
      }),
    footer: {
      byClientAndService: sumsByClientAndService(rows),
      totals: totalsByUnit(rows),
      entryCount: rows.length
    },
    warnings: buildWarnings(entries, rows, includeDrafts)
  };
}

/**
 * MALL B — hoolduspäevik / päevaleht (koduteenuse tüüp).
 *
 * Struktuur tuleb Riigi Teataja koduteenuse kordadest. Kaks asja, mis siin ON
 * ja mujal ei ole: **rahalised tehingud** (kliendi raha kasutamine poeskäigul —
 * kordade päris nõue) ja **tähelepanekud koos PÄRITOLUGA**.
 */
export function buildCareDiary({
  provider = {},
  recipient = {},
  period = {},
  entries = [],
  includeDrafts = false,
  includeMoney = true
} = {}) {
  const rows = selectExportableEntries(entries, { includeDrafts });

  const columns = ["client", "date", "arrived", "left", "duration", "activities"];
  if (includeMoney) columns.push("moneyAmount", "moneyNote");
  columns.push("observation", "provenance", "worker", "confirmed");
  if (includeDrafts) columns.push("status");

  return {
    template: TEMPLATE.B_CARE_DIARY,
    header: [
      ["provider", provider.name || ""],
      ["recipient", recipient.name || ""],
      ["period", `${period.from || ""}…${period.to || ""}`]
    ],
    columns,
    rows: rows
      .slice()
      .sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)))
      .map((entry) => {
        const row = {
          client: clientLabel(entry),
          date: isoDate(entry.date),
          arrived: isoTime(entry.arrivedAt),
          left: isoTime(entry.leftAt),
          duration: round2(Number(entry.quantity) || 0),
          activities: (entry.activities || []).join(", ")
        };
        if (includeMoney) {
          row.moneyAmount = entry.moneyAmount === null || entry.moneyAmount === undefined ? "" : entry.moneyAmount;
          row.moneyNote = entry.moneyNote || "";
        }
        row.observation = entry.note || "";
        /* PÄRITOLU ON OMA VEERG. Ilma selleta muutuks „ta ütles" ja „mulle
           tundus" ekspordis samaks lauseks — ja just see vahe on aruande
           väärtus. */
        row.provenance = entry.note ? entry.noteProvenance || "" : "";
        row.worker = entry.workerName || "";
        row.confirmed = entry.confirmedByClientAt
          ? isoDate(entry.confirmedByClientAt)
          : entry.confirmedManually
            ? "manual"
            : "";
        if (includeDrafts) row.status = entry.status;
        return row;
      }),
    footer: { totals: totalsByUnit(rows), entryCount: rows.length },
    warnings: buildWarnings(entries, rows, includeDrafts)
  };
}

/**
 * MALL C — sisuline aruanne (narratiiv).
 *
 * Ainus mall, mis ei ole tabel. Ta lõpeb ETTEPANEKUGA, sest see on koht, mille
 * põhjal KOV järgmise suunamisotsuse teeb.
 *
 * KUI NARRATIIVI EI OLE, ei sünni tühja dokumenti: mall tagastab `missing`
 * hoiatuse. Tühi sisuline aruanne oleks halvem kui puuduv — ta näeks välja nagu
 * esitatud töö.
 */
export function buildNarrativeReport({
  provider = {},
  recipient = {},
  period = {},
  referral = null,
  narrative = null,
  entries = [],
  includeDrafts = false
} = {}) {
  const rows = selectExportableEntries(entries, { includeDrafts });

  return {
    template: TEMPLATE.C_NARRATIVE,
    header: [
      ["provider", provider.name || ""],
      ["recipient", recipient.name || ""],
      ["client", narrative?.clientDisplayName || referral?.clientDisplayName || ""],
      ["referralNumber", referral?.referralNumber || ""],
      ["period", `${period.from || ""}…${period.to || ""}`]
    ],
    sections: [
      { key: "goals", text: referral?.goalsText || "" },
      { key: "activitySummary", totals: totalsByUnit(rows), entryCount: rows.length },
      { key: "body", text: narrative?.bodyText || "" },
      /* ETTEPANEK on eraldi sektsioon ja eraldi väärtus — mitte teksti sisse
         peidetud lause. */
      { key: "proposal", value: narrative?.proposal || null, text: narrative?.proposalNote || "" }
    ],
    footer: {
      preparedBy: provider.preparedBy || "",
      preparedAt: isoDate(new Date())
    },
    warnings: [
      ...buildWarnings(entries, rows, includeDrafts),
      ...(narrative ? [] : [{ code: "narrative_missing" }]),
      ...(referral?.goalsText ? [] : [{ code: "goals_missing" }])
    ]
  };
}

/**
 * MALL D — s-veebi statistikaväljavõte (riigi aastaaruandlus).
 *
 * Riigikontrolli auditi leid: s-veebi töötundide ja kulude arvestus on
 * osutajate eraldi ajakulu, kuigi ta on MEIE andmetest tuletatav. Sama aatomi
 * neljas väljund.
 *
 * TEENUSE SAAJATE ARV loetakse UNIKAALSETE klientide järgi — mitte kirjete
 * järgi, mis annaks mitmekordse numbri.
 */
export function buildStatistics({ period = {}, entries = [], includeDrafts = false } = {}) {
  const rows = selectExportableEntries(entries, { includeDrafts });

  const clients = new Set();
  const byService = new Map();
  for (const entry of rows) {
    const label = clientLabel(entry);
    if (label) clients.add(label);
    const key = `${entry.serviceName || entry.serviceId || ""}|${entry.unit}`;
    const row = byService.get(key) || {
      service: entry.serviceName || entry.serviceId || "",
      unit: entry.unit,
      quantity: 0,
      clients: new Set()
    };
    row.quantity += Number(entry.quantity) || 0;
    if (label) row.clients.add(label);
    byService.set(key, row);
  }

  return {
    template: TEMPLATE.D_STATISTICS,
    header: [["period", `${period.from || ""}…${period.to || ""}`]],
    columns: ["service", "unit", "quantity", "clientCount"],
    rows: [...byService.values()].map((row) => ({
      service: row.service,
      unit: row.unit,
      quantity: round2(row.quantity),
      clientCount: row.clients.size
    })),
    footer: {
      /* Unikaalsed kliendid KOKKU — mitte teenuste kliendiarvude summa, mis
         loeks sama inimest mitu korda, kui ta saab kahte teenust. */
      totalClients: clients.size,
      totals: totalsByUnit(rows),
      entryCount: rows.length
    },
    warnings: buildWarnings(entries, rows, includeDrafts)
  };
}

/**
 * Hoiatused kannavad EKSPORDI AUSUST: kasutaja peab teadma, mis jäi välja.
 * Vaikiv väljajätmine on halvim variant — ta annab õige välimusega vale
 * numbri.
 */
function buildWarnings(allEntries, exportedEntries, includeDrafts) {
  const warnings = [];
  const voided = allEntries.filter((entry) => entry?.status === ENTRY_STATUS.VOID).length;
  const drafts = allEntries.filter((entry) => entry?.status === ENTRY_STATUS.DRAFT).length;
  if (voided > 0) warnings.push({ code: "voided_excluded", count: voided });
  if (!includeDrafts && drafts > 0) warnings.push({ code: "drafts_excluded", count: drafts });
  if (includeDrafts && drafts > 0) warnings.push({ code: "drafts_included", count: drafts });
  if (!exportedEntries.length) warnings.push({ code: "empty_export" });
  return warnings;
}

export const TEMPLATE_BUILDERS = Object.freeze({
  [TEMPLATE.A_TIMESHEET]: buildTimesheet,
  [TEMPLATE.B_CARE_DIARY]: buildCareDiary,
  [TEMPLATE.C_NARRATIVE]: buildNarrativeReport,
  [TEMPLATE.D_STATISTICS]: buildStatistics
});

export function buildDocument(templateKey, input = {}) {
  const builder = TEMPLATE_BUILDERS[templateKey];
  if (!builder) return null;
  return builder(input);
}
