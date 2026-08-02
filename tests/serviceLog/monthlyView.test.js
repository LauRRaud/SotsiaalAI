/**
 * TEENUSPÄEVIK-V1 E4 — kuuvaate ja rütmi lepingutestid.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ANNUAL_RHYTHMS,
  buildMonthlySummary,
  clientKey,
  evaluateAnnualRhythms,
  evaluateReportRhythm,
  parseMonth,
  reportDeadlineFor,
  reportReminderFor
} from "../../lib/serviceLog/monthlyView.js";
import { ENTRY_STATUS, SERVICE_UNIT } from "../../lib/serviceLog/constants.js";

const entry = (over = {}) => ({
  clientDisplayName: "Mari",
  serviceId: "svc-1",
  unit: SERVICE_UNIT.HOUR,
  quantity: 2,
  date: "2026-08-10",
  status: ENTRY_STATUS.FINAL,
  ...over
});

test("summad tulevad kliendi ja teenuse kaupa", () => {
  const summary = buildMonthlySummary([entry(), entry({ quantity: 3 })], { month: "2026-08" });
  assert.equal(summary.clients.length, 1);
  assert.equal(summary.clients[0].services[0].final, 5);
  assert.equal(summary.clients[0].entryCount, 2);
});

test("ÜHIKUID EI LIIDETA — sama teenus tunnis ja korras on kaks rida", () => {
  // „12" ei tähenda midagi, kui ta on 8 tundi pluss 4 korda.
  const summary = buildMonthlySummary(
    [entry({ quantity: 8 }), entry({ unit: SERVICE_UNIT.SESSION, quantity: 4 })],
    { month: "2026-08" }
  );
  assert.equal(summary.clients[0].services.length, 2);
  assert.equal(summary.totalsByUnit.length, 2);
  const hours = summary.totalsByUnit.find((row) => row.unit === SERVICE_UNIT.HOUR);
  const sessions = summary.totalsByUnit.find((row) => row.unit === SERVICE_UNIT.SESSION);
  assert.equal(hours.final, 8);
  assert.equal(sessions.final, 4);
});

test("TÜHISTATUD kirje ei ole aruandes, aga on loendatud", () => {
  const summary = buildMonthlySummary(
    [entry(), entry({ quantity: 100, status: ENTRY_STATUS.VOID })],
    { month: "2026-08" }
  );
  assert.equal(summary.totalsByUnit[0].final, 2);
  assert.equal(summary.entryCounts.voided, 1);
});

test("MUSTAND on nähtav eraldi, mitte vaikselt summas ega vaikselt ära", () => {
  /* Esitamata mustand on kõige tavalisem põhjus, miks kuu maht on vale —
     seepärast peab kuuvaade ütlema „sul on kinnitamata kirjeid". */
  const summary = buildMonthlySummary(
    [entry(), entry({ quantity: 3, status: ENTRY_STATUS.DRAFT })],
    { month: "2026-08" }
  );
  assert.equal(summary.totalsByUnit[0].final, 2);
  assert.equal(summary.totalsByUnit[0].draft, 3);
  assert.equal(summary.totalsByUnit[0].total, 5);
  assert.equal(summary.unconfirmed, 1);
});

test("teise kuu kirje ei jõua koondisse", () => {
  const summary = buildMonthlySummary([entry(), entry({ date: "2026-09-01", quantity: 50 })], {
    month: "2026-08"
  });
  assert.equal(summary.totalsByUnit[0].final, 2);
});

test("platvormi klient ja sama nimega väline klient EI sulandu kokku", () => {
  // Sama nimi ei tähenda sama inimest.
  const summary = buildMonthlySummary(
    [entry({ clientUserId: "u1", clientDisplayName: "Mari" }), entry({ clientDisplayName: "Mari" })],
    { month: "2026-08" }
  );
  assert.equal(summary.clients.length, 2);
  assert.notEqual(clientKey({ clientUserId: "u1" }), clientKey({ clientDisplayName: "Mari" }));
});

/* --- tähtaeg ja meeldetuletus -------------------------------------------- */

test("tähtaeg on järgmise kuu 10. kuupäev", () => {
  assert.equal(reportDeadlineFor("2026-08").toISOString().slice(0, 10), "2026-09-10");
  assert.equal(reportReminderFor("2026-08").toISOString().slice(0, 10), "2026-09-05");
});

test("detsembri aruanne läheb üle aastavahetuse", () => {
  assert.equal(reportDeadlineFor("2026-12").toISOString().slice(0, 10), "2027-01-10");
});

test("meeldetuletus tuleb 5-ndal ja on ÜKS", () => {
  const before = evaluateReportRhythm("2026-08", { now: new Date("2026-09-04T12:00:00Z") });
  assert.equal(before.shouldRemind, false);

  const onDay = evaluateReportRhythm("2026-08", { now: new Date("2026-09-05T06:00:00Z") });
  assert.equal(onDay.shouldRemind, true);

  const already = evaluateReportRhythm("2026-08", {
    now: new Date("2026-09-08T06:00:00Z"),
    remindedAt: "2026-09-05T06:00:00Z"
  });
  assert.equal(already.shouldRemind, false, "teine meeldetuletus oleks nügimine, mitte teenus");
});

test("üle tähtaja olek on nähtav, aga ei tekita uut meeldetuletust", () => {
  const overdue = evaluateReportRhythm("2026-08", {
    now: new Date("2026-09-20T06:00:00Z"),
    remindedAt: "2026-09-05T06:00:00Z"
  });
  assert.equal(overdue.overdue, true);
  assert.equal(overdue.shouldRemind, false);
});

test("vigane kuu ei tekita vaikset vale tähtaega", () => {
  assert.equal(parseMonth("2026-13"), null);
  assert.equal(parseMonth("sodi"), null);
  assert.equal(reportDeadlineFor("2026-13"), null);
  assert.equal(evaluateReportRhythm("sodi"), null);
});

/* --- aastased rütmid ----------------------------------------------------- */

test("aastased rütmid kannavad allikat, mis EI OLE seadus", () => {
  /* Parandatud 30.07: tagasisideküsitlus ja vahehindamine tulevad SKA
     KVALITEEDIJUHISEST. Vale vastavusväide töövahendis on tõsisem viga kui
     puuduv meeldetuletus, sest töövahendit usutakse. */
  for (const rhythm of ANNUAL_RHYTHMS) {
    assert.equal(rhythm.source, "quality_guide");
    assert.notEqual(rhythm.source, "law");
  }
  const evaluated = evaluateAnnualRhythms({ now: new Date("2026-08-02T00:00:00Z") });
  for (const rhythm of evaluated) {
    assert.equal(rhythm.source, "quality_guide");
  }
});

test("ilma varasema kirjeta ei väideta, et miski on üle tähtaja", () => {
  // Me ei tea, kas seda on kunagi tehtud — ta on lihtsalt tegemata.
  const evaluated = evaluateAnnualRhythms({ now: new Date("2026-08-02T00:00:00Z") });
  for (const rhythm of evaluated) {
    assert.equal(rhythm.due, false);
    assert.equal(rhythm.neverDone, true);
  }
});

test("aasta möödudes muutub rütm tähtajaks", () => {
  const evaluated = evaluateAnnualRhythms({
    now: new Date("2026-08-02T00:00:00Z"),
    lastDoneAt: { feedback_survey: "2025-06-01T00:00:00Z", interim_assessment: "2026-06-01T00:00:00Z" }
  });
  const survey = evaluated.find((row) => row.key === "feedback_survey");
  const assessment = evaluated.find((row) => row.key === "interim_assessment");
  assert.equal(survey.due, true);
  assert.equal(assessment.due, false);
  assert.equal(survey.neverDone, false);
});
