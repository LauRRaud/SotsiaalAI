/**
 * TEENUSPÄEVIK-V1 E6 — mallimootori lepingutestid.
 *
 * Eksport on koht, kus vale number jõuab KOV-i lauale ja arvele. Iga test siin
 * kirjeldab ühte tagajärge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  TEMPLATE,
  TIMESHEET_VARIANT,
  buildCareDiary,
  buildDocument,
  buildNarrativeReport,
  buildStatistics,
  buildTimesheet,
  selectExportableEntries
} from "../../lib/serviceLog/export/templates.js";
import { documentToCsv, escapeCsvValue } from "../../lib/serviceLog/export/csv.js";
import { exportFileName } from "../../lib/serviceLog/exportService.js";
import { ENTRY_STATUS, PROVENANCE, SERVICE_UNIT } from "../../lib/serviceLog/constants.js";

const entry = (over = {}) => ({
  clientDisplayName: "Mari",
  serviceName: "Tugiisik",
  unit: SERVICE_UNIT.HOUR,
  quantity: 2,
  date: "2026-08-10",
  activities: ["saatmine"],
  status: ENTRY_STATUS.FINAL,
  ...over
});

/* --- ühised reeglid ------------------------------------------------------ */

test("TÜHISTATUD kirje ei ole üheski ekspordis", () => {
  const entries = [entry(), entry({ quantity: 99, status: ENTRY_STATUS.VOID })];
  for (const template of Object.values(TEMPLATE)) {
    const doc = buildDocument(template, { entries, referralId: "r", narrative: { bodyText: "x" } });
    const blob = JSON.stringify(doc);
    assert.equal(blob.includes("99"), false, `${template}: tühistatud kirje lekkis`);
  }
});

test("MUSTANDID EI LÄHE arve alusdokumenti ilma sõnaselge sooviita", () => {
  /* Kinnitamata töö esitamine tähendaks arvet töö eest, mida osutaja ise ei ole
     veel kinnitanud. */
  const entries = [entry(), entry({ quantity: 7, status: ENTRY_STATUS.DRAFT })];
  const doc = buildTimesheet({ entries });
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.footer.totals[0].quantity, 2);
  assert.ok(doc.warnings.some((w) => w.code === "drafts_excluded" && w.count === 1));
});

test("mustandid saab kaasa võtta, aga siis on nad MÄRGITUD", () => {
  const entries = [entry(), entry({ quantity: 7, status: ENTRY_STATUS.DRAFT })];
  const doc = buildTimesheet({ entries, includeDrafts: true });
  assert.equal(doc.rows.length, 2);
  assert.ok(doc.columns.includes("status"));
  assert.ok(doc.warnings.some((w) => w.code === "drafts_included"));
});

test("ÜHIKUID EI LIIDETA üheski summas", () => {
  const entries = [entry({ quantity: 8 }), entry({ unit: SERVICE_UNIT.SESSION, quantity: 4 })];
  const doc = buildTimesheet({ entries });
  assert.equal(doc.footer.totals.length, 2);
  const hours = doc.footer.totals.find((row) => row.unit === SERVICE_UNIT.HOUR);
  assert.equal(hours.quantity, 8);
});

test("tühi eksport hoiatab, ei teeskle esitist", () => {
  const doc = buildTimesheet({ entries: [] });
  assert.ok(doc.warnings.some((w) => w.code === "empty_export"));
});

test("eelfilter on ühine — ükski mall ei saa temast mööda minna", () => {
  const kept = selectExportableEntries([entry(), entry({ status: ENTRY_STATUS.VOID })]);
  assert.equal(kept.length, 1);
});

/* --- mall A -------------------------------------------------------------- */

test("mall A päevavariant kirjutab iga kirje lahti", () => {
  const doc = buildTimesheet({ entries: [entry(), entry({ date: "2026-08-11" })] });
  assert.equal(doc.variant, TIMESHEET_VARIANT.DAILY);
  assert.equal(doc.rows.length, 2);
});

test("mall A kuuvariant annab SAMADEST andmetest summad", () => {
  const doc = buildTimesheet({
    entries: [entry(), entry({ date: "2026-08-11", quantity: 3 })],
    variant: TIMESHEET_VARIANT.MONTHLY
  });
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.rows[0].quantity, 5);
});

test("mall A EI SISALDA märkmeid — ta on mahuaruanne", () => {
  /* Tundliku sisu lisamine muudaks arve lisa dokumendiks, mida ei tohi
     raamatupidamisele saata. */
  const doc = buildTimesheet({ entries: [entry({ note: "väga tundlik sisu" })] });
  assert.equal(JSON.stringify(doc).includes("tundlik"), false);
  assert.equal(doc.columns.includes("observation"), false);
});

test("kliendi kinnituse veerg on SEADISTUS, mitte vaikimisi", () => {
  assert.equal(buildTimesheet({ entries: [entry()] }).columns.includes("clientConfirmed"), false);
  assert.equal(
    buildTimesheet({ entries: [entry()], includeClientConfirmation: true }).columns.includes("clientConfirmed"),
    true
  );
});

/* --- mall B -------------------------------------------------------------- */

test("mall B kannab rahalisi tehinguid ja PÄRITOLU eraldi veerus", () => {
  const doc = buildCareDiary({
    entries: [
      entry({ note: "ei saa hakkama", noteProvenance: PROVENANCE.KLIENDI_OELDUD, moneyAmount: 12.5, moneyNote: "pood" })
    ]
  });
  assert.ok(doc.columns.includes("moneyAmount"));
  assert.ok(doc.columns.includes("provenance"));
  assert.equal(doc.rows[0].provenance, PROVENANCE.KLIENDI_OELDUD);
  assert.equal(doc.rows[0].moneyAmount, 12.5);
});

test("märkmeta real ei ole päritolu välja mõeldud", () => {
  const doc = buildCareDiary({ entries: [entry()] });
  assert.equal(doc.rows[0].provenance, "");
});

/* --- mall C -------------------------------------------------------------- */

test("mall C lõpeb ETTEPANEKUGA eraldi sektsioonina", () => {
  const doc = buildNarrativeReport({
    entries: [entry()],
    referral: { goalsText: "Iseseisvus", referralNumber: "123" },
    narrative: { bodyText: "Lugu.", proposal: "CONTINUE" }
  });
  const proposal = doc.sections.find((section) => section.key === "proposal");
  assert.equal(proposal.value, "CONTINUE");
});

test("puuduv narratiiv ei tekita tühja dokumenti vaikselt", () => {
  // Tühi sisuline aruanne näeks välja nagu esitatud töö.
  const doc = buildNarrativeReport({ entries: [entry()], referral: { goalsText: "x" } });
  assert.ok(doc.warnings.some((w) => w.code === "narrative_missing"));
});

test("puuduvad eesmärgid on hoiatus, mitte vaikus", () => {
  const doc = buildNarrativeReport({ entries: [entry()], narrative: { bodyText: "x" } });
  assert.ok(doc.warnings.some((w) => w.code === "goals_missing"));
});

/* --- mall D -------------------------------------------------------------- */

test("mall D loeb UNIKAALSEID kliente, mitte kirjeid", () => {
  const doc = buildStatistics({
    entries: [entry(), entry({ date: "2026-08-11" }), entry({ clientDisplayName: "Jaan" })]
  });
  assert.equal(doc.footer.totalClients, 2);
});

test("mall D ei liida sama inimest kaks korda üle teenuste", () => {
  const doc = buildStatistics({
    entries: [entry({ serviceName: "A" }), entry({ serviceName: "B" })]
  });
  assert.equal(doc.footer.totalClients, 1);
  assert.equal(doc.rows.length, 2);
});

/* --- CSV ----------------------------------------------------------------- */

test("CSV-SÜST on tõkestatud", () => {
  /* Excelis on `=`-ga algav lahter VALEM. Eksport läheb KOV-i raamatupidajale
     — see ei ole teoreetiline oht. */
  assert.equal(escapeCsvValue("=cmd|'/c calc'!A1"), "'=cmd|'/c calc'!A1");
  assert.equal(escapeCsvValue("+1"), "'+1");
  assert.equal(escapeCsvValue("-1"), "'-1");
  assert.equal(escapeCsvValue("@x"), "'@x");
  assert.equal(escapeCsvValue("Mari"), "Mari");
});

test("eraldaja ja jutumärgid pääsevad õigesti", () => {
  assert.equal(escapeCsvValue("a;b"), '"a;b"');
  assert.equal(escapeCsvValue('ütles "ei"'), '"ütles ""ei"""');
  assert.equal(escapeCsvValue("rida\nteine"), '"rida\nteine"');
});

test("tühi väärtus on tühi, mitte null", () => {
  assert.equal(escapeCsvValue(null), "");
  assert.equal(escapeCsvValue(undefined), "");
});

test("CSV kannab BOM-i, päist, jalust JA hoiatusi", () => {
  /* Hoiatus peab jõudma ka selleni, kes faili hiljem avab — mitte ainult
     selleni, kes ta eksportis. */
  const doc = buildTimesheet({
    provider: { name: "OÜ Näide" },
    recipient: { name: "Tartu vald" },
    period: { from: "2026-08-01", to: "2026-08-31" },
    entries: [entry(), entry({ status: ENTRY_STATUS.DRAFT })]
  });
  const csv = documentToCsv(doc);
  assert.ok(csv.startsWith("﻿"), "BOM puudub — täpitähed muutuksid prügiks");
  assert.ok(csv.includes("OÜ Näide"));
  assert.ok(csv.includes("total:HOUR"));
  assert.ok(csv.includes("warning:drafts_excluded"));
});

/* --- failinimi ----------------------------------------------------------- */

test("failinimi on ASCII ja lühike", () => {
  // Projekt on juba kord maksnud 269-baidise failinime eest (ext4 piir 255).
  const name = exportFileName({ month: "2026-08", template: TEMPLATE.A_TIMESHEET, kovName: "Põlva vald" });
  assert.match(name, /^[a-z0-9.-]+\.csv$/);
  assert.ok(Buffer.byteLength(name, "utf8") < 100);
  assert.ok(name.includes("polva-vald"));
});

/* =========================================================================
   KONTROLLI LEIDUDE REGRESSIOONITESTID (02.08). Iga test kukub vana koodi peal.
   ========================================================================= */

test("P0: saajata eksport EI LAENA esimese KOV-i nime ja hoiatab", () => {
  /* Varem võttis päis `referrals[0].kovName` — fail nimega „Tallinna vald",
     milles on ka Tartu kliendid. Väliselt korrektne esitis, sisuliselt leke. */
  const doc = buildTimesheet({
    recipient: { name: "", isSingleRecipient: false },
    entries: [entry()]
  });
  const recipientRow = doc.header.find(([key]) => key === "recipient");
  assert.equal(recipientRow[1], "");
  assert.ok(doc.warnings.some((w) => w.code === "not_submittable_all_recipients"));
});

test("P0: määratud saajaga eksport ei kanna seda hoiatust", () => {
  const doc = buildTimesheet({
    recipient: { name: "Tartu vald", isSingleRecipient: true },
    entries: [entry()]
  });
  assert.equal(doc.warnings.some((w) => w.code === "not_submittable_all_recipients"), false);
});

test("P1: KAKS ERI KLIENTI sama nimega ei liideta kokku", () => {
  /* Kontrollproov andis kahe eri „Mari" peale totalClients = 1 ja ühe liidetud
     rea — aruandes tähendab see, et üks inimene saab teise tunnid. */
  const entries = [
    entry({ clientUserId: "u1", clientDisplayName: "Mari" }),
    entry({ clientUserId: "u2", clientDisplayName: "Mari" })
  ];
  assert.equal(buildStatistics({ entries }).footer.totalClients, 2);
  const monthly = buildTimesheet({ entries, variant: TIMESHEET_VARIANT.MONTHLY });
  assert.equal(monthly.rows.length, 2);
});

test("P1: mall A kuuvariant kannab suunamisotsuse numbrit", () => {
  // Ilma temata ei saa KOV rida oma otsusega kokku viia.
  const doc = buildTimesheet({
    entries: [entry({ referralNumber: "2026-123" })],
    variant: TIMESHEET_VARIANT.MONTHLY
  });
  assert.equal(doc.rows[0].referralNumber, "2026-123");
});

test("P1: mall B kestus kannab ÜHIKUT", () => {
  // `duration: 1` on kahemõtteline: tund, kord või ööpäev?
  const doc = buildCareDiary({ entries: [entry({ unit: SERVICE_UNIT.SESSION, quantity: 1 })] });
  assert.ok(doc.columns.includes("unit"));
  assert.equal(doc.rows[0].unit, SERVICE_UNIT.SESSION);
});

test("P1: mall C ettepaneku VÄÄRTUS ei kao märkuse taha", () => {
  /* Varem võttis CSV `section.text || section.value` ja märkusega ettepanekul
     kadus CONTINUE/CHANGE_VOLUME/END — just see, mida KOV otsusena loeb. */
  const doc = buildNarrativeReport({
    entries: [entry()],
    referral: { goalsText: "x" },
    narrative: { bodyText: "lugu", proposal: "END", proposalNote: "klient kolib ära" }
  });
  const csv = documentToCsv(doc);
  assert.ok(csv.includes("proposal:value"), "ettepaneku väärtus puudub CSV-st");
  assert.ok(csv.includes("END"));
  assert.ok(csv.includes("klient kolib ära"));
});

test("P1: mall C tegevuste kokkuvõte sisaldab TEGEVUSI, mitte ainult mahte", () => {
  const doc = buildNarrativeReport({
    entries: [entry({ activities: ["saatmine"] }), entry({ activities: ["saatmine", "asjaajamine"] })],
    narrative: { bodyText: "x" }
  });
  const summary = doc.sections.find((s) => s.key === "activitySummary");
  assert.ok(summary.activities.some((row) => row.name === "saatmine" && row.count === 2));
});

test("P1: CSV-kaitse ei jäta juhtivate tühikute taha valemit", () => {
  /* `"  =SUM(A1)"` jõudis varem Excelisse VALEMINA. Repos oli juba tugevam
     variant (lib/wellbeing/aggregateExport.js) — kaks eri tugevusega kaitset
     samas koodibaasis on halvim variant. */
  assert.equal(escapeCsvValue("  =SUM(A1)"), "'  =SUM(A1)");
  assert.equal(escapeCsvValue("\t=SUM(A1)"), "'\t=SUM(A1)");
  assert.equal(escapeCsvValue(" +1"), "' +1");
  assert.equal(escapeCsvValue(" tavaline tekst"), " tavaline tekst");
});

test("P1: CSV kannab jaluse välju, mis varem kadusid", () => {
  const doc = buildTimesheet({
    provider: { name: "OÜ Näide", preparedBy: "Mari" },
    recipient: { name: "Tartu vald", isSingleRecipient: true },
    entries: [entry({ referralNumber: "2026-1" })]
  });
  const csv = documentToCsv(doc);
  assert.ok(csv.includes("entryCount"), "kirjete arv puudub");
  assert.ok(csv.includes("2026-1"), "kliendi ja teenuse kaupa koond puudub");
});

/* --- TEISE RINGI leiud --------------------------------------------------- */

test("P1: KAKS ERI VÄLISKLIENTI sama nimega, eri viitega ei liitu", () => {
  /* `clientExternalRef` on täpselt see väli, mis nad eristab — ilma temata sai
     üks „Mari" teise tunnid. */
  const entries = [
    entry({ clientDisplayName: "Mari", clientExternalRef: "2026-1" }),
    entry({ clientDisplayName: "Mari", clientExternalRef: "2026-2" })
  ];
  assert.equal(buildStatistics({ entries }).footer.totalClients, 2);
  assert.equal(buildTimesheet({ entries, variant: TIMESHEET_VARIANT.MONTHLY }).rows.length, 2);
});

test("P1: ÜHE kliendi KAKS suunamisotsust ei liitu esimese otsuse alla", () => {
  /* Sama klient võib saada sama teenust kahe eri otsuse alusel (maht muutus
     keset kuud) — liitmine paneks arve alusdokumenti VALE otsuse numbri. */
  const entries = [
    entry({ referralId: "r1", referralNumber: "OTS-1" }),
    entry({ referralId: "r2", referralNumber: "OTS-2" })
  ];
  const doc = buildTimesheet({ entries, variant: TIMESHEET_VARIANT.MONTHLY });
  assert.equal(doc.rows.length, 2);
  assert.deepEqual(doc.rows.map((row) => row.referralNumber).sort(), ["OTS-1", "OTS-2"]);
});

test("sama klient sama otsuse all liidetakse endiselt kokku", () => {
  // Grupeerimine ei tohi muutuda mõttetuks: sama otsus = üks rida.
  const entries = [
    entry({ referralId: "r1", referralNumber: "OTS-1" }),
    entry({ referralId: "r1", referralNumber: "OTS-1", quantity: 3 })
  ];
  const doc = buildTimesheet({ entries, variant: TIMESHEET_VARIANT.MONTHLY });
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.rows[0].quantity, 5);
});
