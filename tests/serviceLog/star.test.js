/**
 * TEENUSPÄEVIK E9 — STAR / s-veebi kuju.
 *
 * KÕIGE TÄHTSAM TEST SIIN ON AUSUS. Lepingu ptk 6a ütleb, et täpsed s-veebi
 * väljad tuleb kontrollida ehituse ajal, ja avalikku väljakirjeldust, mille
 * vastu valideerida, ei ole. Seega EI TOHI see fail väita, et ta vastab
 * riiklikule skeemile. Vale vastavusväide töövahendis on tõsisem viga kui
 * puuduv funktsioon — sama reegel, mille leping juba kord kirja pani.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  STAR_MAPPING_STATUS,
  STAR_SCHEMA_VERSION,
  buildStarPayload,
  starPayloadToJson
} from "../../lib/serviceLog/export/star.js";
import { TEMPLATE } from "../../lib/serviceLog/export/templates.js";

function statisticsDocument(overrides = {}) {
  return {
    template: TEMPLATE.D_STATISTICS,
    header: [["period", "2026-08-01…2026-08-31"]],
    columns: ["service", "unit", "quantity", "clientCount"],
    rows: [
      { service: "Koduteenus", unit: "HOUR", quantity: 12.5, clientCount: 3 },
      { service: "Tugiisik", unit: "SESSION", quantity: 4, clientCount: 2 }
    ],
    footer: { totalClients: 4, totals: { HOUR: 12.5, SESSION: 4 }, entryCount: 9 },
    warnings: [{ code: "drafts_excluded", count: 2 }],
    ...overrides
  };
}

const CONTEXT = {
  provider: { name: "OÜ Hooldus", registryCode: "12345678" },
  period: { from: "2026-08-01", to: "2026-08-31" },
  generatedAt: "2026-09-01T08:00:00.000Z"
};

test("ümbrik kannab versiooni ja AUSAT kaardistuse seisu", () => {
  const payload = buildStarPayload(statisticsDocument(), CONTEXT);
  assert.equal(payload.schemaVersion, STAR_SCHEMA_VERSION);
  assert.equal(payload.mappingStatus, STAR_MAPPING_STATUS);
  assert.equal(payload.mappingStatus, "unverified", "vastavust EI TOHI väita");
});

test("koond tuleb jaluses olevatest arvudest, mitte ridade summast", () => {
  const payload = buildStarPayload(statisticsDocument(), CONTEXT);
  /* 3 + 2 = 5, aga unikaalseid kliente on 4: sama inimene sai kahte teenust.
     Ridade summeerimine annaks siin vale rahvaarvu. */
  assert.equal(payload.totals.uniqueClients, 4);
  assert.equal(payload.totals.entries, 9);
  assert.deepEqual(payload.totals.byUnit, { HOUR: 12.5, SESSION: 4 });
});

test("teenused tulevad kaasa koos ühiku ja mahuga", () => {
  const payload = buildStarPayload(statisticsDocument(), CONTEXT);
  assert.equal(payload.services.length, 2);
  assert.deepEqual(payload.services[0], {
    service: "Koduteenus",
    unit: "HOUR",
    quantity: 12.5,
    uniqueClients: 3
  });
});

/* Riigi statistika ei vaja isikuandmeid ja nende kaasa panemine oleks
   minimeerimise rikkumine. See test loeb kogu JSON-i läbi, mitte ei usalda
   väljade nimekirja. */
test("ümbrikus ei ole isikuandmeid", () => {
  const json = starPayloadToJson(buildStarPayload(statisticsDocument(), CONTEXT));
  for (const forbidden of ["clientDisplayName", "clientUserId", "referralNumber", "workerName", "note"]) {
    assert.ok(!json.includes(forbidden), `${forbidden} ei tohi STAR-ümbrikus olla`);
  }
});

/* Hoiatused peavad faili juurde jääma: kui väljavõttest jäi midagi välja, ei
   tohi see teadmine kaduda just seal, kus arvu riigile edastatakse. */
test("hoiatused tulevad kaasa", () => {
  const payload = buildStarPayload(statisticsDocument(), CONTEXT);
  assert.deepEqual(payload.warnings, [{ code: "drafts_excluded", count: 2 }]);
});

/* Teised mallid kannavad nimesid ja suunamisnumbreid — nende lubamine
   tähendaks vaikset üleliigset edastust. */
test("ainult mall D kõlbab STAR-kujuks", () => {
  assert.throws(
    () => buildStarPayload(statisticsDocument({ template: TEMPLATE.A_TIMESHEET }), CONTEXT),
    TypeError
  );
  assert.throws(() => buildStarPayload(null, CONTEXT), TypeError);
});

test("tühi periood ei tee tühjast väljast valet väärtust", () => {
  const payload = buildStarPayload(statisticsDocument(), { provider: {}, period: {} });
  assert.equal(payload.provider.name, null);
  assert.equal(payload.period.from, null);
  assert.equal(payload.generatedAt, null);
});
