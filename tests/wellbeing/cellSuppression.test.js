import assert from "node:assert/strict";
import test from "node:test";

import { suppressSmallCells, summarizeCellSuppression } from "../../lib/wellbeing/cellSuppression.js";
import { WELLBEING_MINIMUM_GROUP_SIZE_FLOOR, buildWellbeingAggregateDataset } from "../../lib/wellbeing/aggregate.js";
import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";
import { exportWellbeingPilotReportHtml, signalCell } from "../../lib/wellbeing/pilotReportExport.js";

const MINIMUM = WELLBEING_MINIMUM_GROUP_SIZE_FLOOR;

function published(result) {
  return Object.fromEntries(result.published);
}

test("esimene kiht: alla künnise lahter ei jõua välja, null jääb", () => {
  const result = suppressSmallCells(
    [["a", 9], ["b", 2], ["c", 0]],
    { minimumGroupSize: MINIMUM }
  );

  assert.deepEqual(published(result), { a: 9, c: 0 });
  assert.deepEqual(result.withheldKeys, ["b"]);
  assert.equal(result.familyWithheld, false);
});

/* Mitme valikuga perekond (riskimarkerid) ei liitu ühekski avaldatud summaks,
   seega lahutamisvõrrandit ei ole ja teist kihti ei rakendata. */
test("summeerimata perekonnas jääb ainult väike lahter kinni", () => {
  const result = suppressSmallCells(
    [["risk.a", 11], ["risk.b", 1], ["risk.c", 8]],
    { minimumGroupSize: MINIMUM }
  );

  assert.deepEqual(published(result), { "risk.a": 11, "risk.c": 8 });
  assert.deepEqual(result.withheldKeys, ["risk.b"]);
});

/* SEE ON LEIU TUUM. Üks summutatud lahter avaldatud üldsumma kõrval on
   lahutatav: 12 − 9 = 3. Teine lahter peab kinni minema ka siis, kui ta ise on
   suur. */
test("teine kiht: ainsat summutatud lahtrit ei tohi saada lahutamise teel tagasi", () => {
  const withoutComplementary = suppressSmallCells(
    [["a", 9], ["b", 3]],
    { minimumGroupSize: MINIMUM }
  );
  const total = 12;
  assert.equal(
    total - withoutComplementary.published.reduce((sum, [, count]) => sum + count, 0),
    3,
    "ilma teise kihita on summutatud lahter täpselt tagasi arvutatav"
  );

  const result = suppressSmallCells(
    [["a", 9], ["b", 3]],
    { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }
  );

  assert.deepEqual(result.withheldKeys, ["a", "b"]);
  assert.deepEqual(published(result), {});
});

test("teine kiht võtab kõige väiksema ülejäänud lahtri, mitte suurima", () => {
  const result = suppressSmallCells(
    [["big", 40], ["mid", 6], ["small", 2]],
    { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }
  );

  assert.deepEqual(result.withheldKeys, ["mid", "small"]);
  assert.deepEqual(published(result), { big: 40 });
});

/* Kaks kinni pandud lahtrit ei aita, kui nende SUMMA on ise künnisest väiksem:
   siis teab lugeja, et mõlemad on 1–2. Reegel nõuab mõlemat tingimust, seega
   siia lisandub kolmas lahter ka ilma, et ta ise väike oleks. */
test("summutatud lahtrite summa peab ise künnise ületama", () => {
  const result = suppressSmallCells(
    [["a", 1], ["b", 2], ["c", 30]],
    { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }
  );

  assert.deepEqual(result.withheldKeys, ["a", "b", "c"]);
  assert.deepEqual(published(result), {});
  assert.equal(result.familyWithheld, false, "reegel TÄITUS (3 lahtrit, summa 33) — lihtsalt kõigi arvelt");
});

/* Fail-closed haru on eraldi asi: kandidaadid said otsa ENNE, kui tingimus
   täitus. Ilma temata jääks siin kaks lahtrit avaldamata, aga nende summa 3
   oleks üldsummast lahutatav ja mõlemad seetõttu vahemikus 1–2. */
test("kui tingimust ei saa täita, läheb perekond tervikuna kinni", () => {
  const result = suppressSmallCells(
    [["a", 1], ["b", 2], ["c", 0]],
    { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }
  );

  assert.equal(result.familyWithheld, true);
  assert.deepEqual(published(result), {}, "ka null-lahter läheb kinni — fail-closed");
  assert.deepEqual(result.withheldKeys, ["a", "b", "c"]);
});

test("null-lahter ei käivita summutust ega lähe kandidaadiks", () => {
  const result = suppressSmallCells(
    [["a", 20], ["b", 0]],
    { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }
  );

  assert.deepEqual(published(result), { a: 20, b: 0 });
  assert.deepEqual(result.withheldKeys, []);
});

test("kokkuvõte avaldab võtmed ainult suletud sõnavaraga perekonnal", () => {
  const summary = summarizeCellSuppression(
    [
      { family: "signal", result: suppressSmallCells([["green", 20], ["red", 2], ["yellow", 9]], { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }), publishesKeys: true },
      { family: "risk_event", result: suppressSmallCells([["risk.a", 1], ["risk.b", 30]], { minimumGroupSize: MINIMUM }) },
      { family: "workflow", result: suppressSmallCells([["quick-check", 31]], { minimumGroupSize: MINIMUM, partitionsPublishedTotal: true }) }
    ],
    { minimumGroupSize: MINIMUM }
  );

  const signal = summary.families.find((family) => family.family === "signal");
  const risk = summary.families.find((family) => family.family === "risk_event");

  assert.deepEqual(signal.withheldKeys, ["red", "yellow"], "signaale nimetab aruanne niikuinii kõiki kolme");
  assert.equal(risk.withheldKeys, undefined, "avatud sõnavaraga perekond ei ütle, MILLINE marker jäi kinni");
  assert.equal(risk.withheldCellCount, 1);
  assert.equal(summary.families.some((family) => family.family === "workflow"), false, "summutuseta perekonda loendis ei ole");
  assert.equal(summary.withheldCellCount, 3);
});

/* ── Läbiv: koond ── */

function record(overrides = {}) {
  return {
    ownerUserId: "user_1",
    workflowType: "quick-check",
    computedSignal: { signalLevel: "green" },
    loadFactors: [],
    resourceFactors: [],
    riskMarkers: [],
    ...overrides
  };
}

function prismaWith(records) {
  return { wellbeingRecord: { findMany: async () => records } };
}

test("koond ei avalda ühe inimese riskimarkerit ka siis, kui valim on lävendi ületanud", async () => {
  const records = [
    ...Array.from({ length: 11 }, (unused, index) => record({ ownerUserId: `user_${index + 1}` })),
    record({ ownerUserId: "user_12", riskMarkers: ["risk.workplace_violence"] })
  ];

  const dataset = await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) });

  assert.equal(dataset.suppressed, false, "valim 12 ületab lävendi — kogu koondi summutus siin ei kehti");
  assert.equal(
    dataset.metrics.some((metric) => metric.metricKey.startsWith("risk_event.")),
    false,
    "ainsa inimese riskimarker ei tohi välja jõuda"
  );
  assert.equal(dataset.cellSuppression.withheldCellCount, 1);
  assert.deepEqual(dataset.cellSuppression.families.map((family) => family.family), ["risk_event"]);

  /* NEGATIIVKONTROLL: vana kood avaldas sama lahtri täpse arvuna. Kui see
     mõõtmine läbi ei lähe, ei olnud leid päris. */
  const oldBehaviour = new Map();
  for (const row of records) {
    for (const key of row.riskMarkers) oldBehaviour.set(key, (oldBehaviour.get(key) || 0) + 1);
  }
  assert.equal(oldBehaviour.get("risk.workplace_violence"), 1, "vana kood oleks avaldanud täpselt ühe inimese");
});

test("summutatud signaalilahter kaob koos oma osakaaluga", async () => {
  const records = [
    ...Array.from({ length: 8 }, (unused, index) =>
      record({ ownerUserId: `user_${index + 1}`, computedSignal: { signalLevel: "green" } })),
    ...Array.from({ length: 2 }, (unused, index) =>
      record({ ownerUserId: `red_${index + 1}`, computedSignal: { signalLevel: "red" } }))
  ];

  const dataset = await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) });
  const keys = dataset.metrics.map((metric) => metric.metricKey);

  assert.equal(keys.includes("signal.red.count"), false);
  assert.equal(
    keys.includes("signal.red.share"),
    false,
    "osakaal × avaldatud nimetaja annaks summutatud loenduri tagasi"
  );
  /* Punast kaitseb roheline: üksi jäänuna oleks punane 10 − 8 = 2. */
  assert.equal(keys.includes("signal.green.count"), false);
  assert.equal(keys.includes("signal.yellow.count"), true, "null-lahter jääb, ta ei kirjelda kedagi");

  const signalFamily = dataset.cellSuppression.families.find((family) => family.family === "signal");
  assert.deepEqual(signalFamily.withheldKeys, ["green", "red"]);
});

/* ── Aruanne: puuduv lahter ei tohi muutuda nulliks ── */

test("aruanne ei tee summutatud signaalist nulli", async () => {
  const records = [
    ...Array.from({ length: 8 }, (unused, index) =>
      record({ ownerUserId: `user_${index + 1}`, computedSignal: { signalLevel: "green" } })),
    ...Array.from({ length: 2 }, (unused, index) =>
      record({ ownerUserId: `red_${index + 1}`, computedSignal: { signalLevel: "red" } }))
  ];

  const dataset = await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) });
  const report = buildWellbeingPilotReport(dataset);

  assert.equal(report.signal.redCount, null, "teadmata arv on null, mitte 0");
  assert.equal(report.signal.greenCount, null);
  assert.equal(report.signal.yellowCount, 0, "avaldatud null jääb nulliks");
  assert.equal(report.executiveSummary.statusLabel, "Osaliselt avaldamata");
  assert.equal(report.executiveSummary.tone, "incomplete");
  assert.match(report.decisionSummary, /avaldamata/);
  assert.ok(report.cellSuppressionNotice, "aruanne peab summutust ISE ütlema");
  assert.match(report.cellSuppressionNotice, /ei tähenda nulli/i);

  /* NEGATIIVKONTROLL: vana lugemisreegel („puuduv rida → 0") sama andmestiku
     peal. Kui ta ei anna nulli, ei ole see leiuklass päris ja ülejäänud
     roheline ei tähenda midagi. */
  const oldRead = (key) => Number(dataset.metrics.find((metric) => metric.metricKey === key)?.metricValue || 0);
  assert.equal(oldRead("signal.red.count"), 0, "vana reegel oleks öelnud, et punaseid signaale ei ole");
  assert.notEqual(report.signal.redCount, oldRead("signal.red.count"));
});

/* Prindivaade ja Excel lõikavad arvu kontekstist lahti kõige kiiremini — kui
   summutus jääb ainult JSON-i, loeb juht paberilt „0 punast". */
test("prindivaade ütleb avaldamata signaali sõnadega, mitte nullina", async () => {
  const records = [
    ...Array.from({ length: 8 }, (unused, index) =>
      record({ ownerUserId: `user_${index + 1}`, computedSignal: { signalLevel: "green" } })),
    ...Array.from({ length: 2 }, (unused, index) =>
      record({ ownerUserId: `red_${index + 1}`, computedSignal: { signalLevel: "red" } }))
  ];

  const report = buildWellbeingPilotReport(
    await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) })
  );
  const html = exportWellbeingPilotReportHtml(report);

  assert.match(html, /Avaldamata lahtrid/);
  assert.match(html, /Punased<\/div><div class="kpi">avaldamata</u);
  assert.equal(signalCell(null), "avaldamata");
  assert.equal(signalCell(0), 0, "avaldatud null jääb nulliks");

  /* NEGATIIVKONTROLL: vana avaldis oleks pannud paberile lõpliku nulli. */
  assert.equal(report.signal.redCount ?? 0, 0);
});

test("summutuseta aruanne räägib endist keelt", async () => {
  const records = [
    ...Array.from({ length: 6 }, (unused, index) =>
      record({ ownerUserId: `green_${index + 1}`, computedSignal: { signalLevel: "green" } })),
    ...Array.from({ length: 6 }, (unused, index) =>
      record({ ownerUserId: `red_${index + 1}`, computedSignal: { signalLevel: "red" } }))
  ];

  const report = buildWellbeingPilotReport(
    await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) })
  );

  assert.equal(report.signal.redCount, 6);
  assert.equal(report.executiveSummary.statusLabel, "Tähelepanu vajav");
  assert.match(report.decisionSummary, /6 punast/);
  assert.equal(report.cellSuppressionNotice, undefined, "summutuseta ei teki tühja hoiatust");
});

test("lävendit ületavad lahtrid lähevad välja muutumatuna", async () => {
  const records = [
    ...Array.from({ length: 6 }, (unused, index) =>
      record({ ownerUserId: `green_${index + 1}`, computedSignal: { signalLevel: "green" } })),
    ...Array.from({ length: 6 }, (unused, index) =>
      record({ ownerUserId: `red_${index + 1}`, computedSignal: { signalLevel: "red" } }))
  ];

  const dataset = await buildWellbeingAggregateDataset({}, { prisma: prismaWith(records) });
  const red = dataset.metrics.find((metric) => metric.metricKey === "signal.red.count");

  assert.equal(red.metricValue, 6, "summutus ei tohi puutuda piisavalt suuri lahtreid");
  assert.equal(dataset.cellSuppression.withheldCellCount, 0);
  assert.deepEqual(dataset.cellSuppression.families, []);
});
