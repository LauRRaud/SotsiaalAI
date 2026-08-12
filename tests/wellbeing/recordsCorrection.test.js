import assert from "node:assert/strict";
import test from "node:test";

import {
  createWellbeingRecordCorrectionForUser,
  deleteWellbeingRecordForUser,
  getWellbeingRecordForUser
} from "../../lib/wellbeing/records.js";
import { buildWellbeingAggregateDataset } from "../../lib/wellbeing/aggregate.js";

/* Elus jagatud pood, sama muster mis recordsRead.test.js — üks massiiv teenindab
   nii parandust kui agregaati, nii et paranduse koondimõju on tõestatav ilma
   materialiseeritud kihita. `$transaction`'it EI ole: `withWellbeingAdvisoryLock`
   kukub siis lukuta tagavarateele, mis on siin täpselt see, mida tahame
   testida — loogikat, mitte Postgresi lukustust. */
function createLiveStore(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  let sequence = 0;

  function matches(row, where = {}) {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.ownerUserId !== undefined && row.ownerUserId !== where.ownerUserId) return false;
    if (where.visibility !== undefined && row.visibility !== where.visibility) return false;
    if (where.aggregationEligible !== undefined && row.aggregationEligible !== where.aggregationEligible) return false;
    if (where.workflowType !== undefined && row.workflowType !== where.workflowType) return false;
    return true;
  }

  /* Tagasiviite lahendus: `supersededBy` on see rida, kes viitab MINULE. */
  function withRelations(row, include = {}) {
    if (!row || !include.supersededBy) return row;
    const corrector = rows.find((candidate) => candidate.supersedesRecordId === row.id) || null;
    return { ...row, supersededBy: corrector ? { id: corrector.id, createdAt: corrector.createdAt } : null };
  }

  const wellbeingRecord = {
    findFirst: async ({ where = {}, include = {} } = {}) =>
      withRelations(rows.find((row) => matches(row, where)) || null, include),
    findMany: async ({ where = {} } = {}) => rows.filter((row) => matches(row, where)),
    update: async ({ where, data }) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("row not found");
      Object.assign(row, data);
      return { ...row };
    },
    create: async ({ data }) => {
      sequence += 1;
      const row = { id: `rec_new_${sequence}`, createdAt: new Date("2026-07-20T09:00:00.000Z"), ...data };
      rows.push(row);
      return { ...row };
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matches(rows[index], where)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    }
  };

  return { rows, prisma: { wellbeingRecord } };
}

function quickCheckFields(overrides = {}) {
  return {
    workloadLevel: "high",
    caseComplexityLevel: "moderate",
    emotionalLoad: "moderate",
    documentationLoad: "moderate",
    interruptionsLevel: "moderate",
    recoveryLevel: "partial",
    afterHoursImpact: "low",
    decisionControl: "moderate",
    priorityClarity: "clear",
    supportAvailability: "available",
    covisionNeed: false,
    workBoundaryClarity: "clear",
    difficultCaseMarker: false,
    supportNeed: false,
    ...overrides
  };
}

function storedRecord(id, ownerUserId, overrides = {}) {
  return {
    id,
    ownerUserId,
    workflowType: "quick-check",
    period: "2026-W29",
    roleGroup: "child_protection",
    visibility: "private",
    aggregationEligible: true,
    standardizedFields: quickCheckFields(),
    computedSignal: { signalLevel: "yellow" },
    loadFactors: ["documentation"],
    resourceFactors: [],
    riskMarkers: [],
    recommendedActions: [],
    supersedesRecordId: null,
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    ...overrides
  };
}

/* SELLE VIILU TÄHTSAIM TEST (TO-1 valiku põhjus).
   „Paranda uue kirjena" tohib mustri-statistikat parandada, mitte topeltloendada.
   Kui parandatav jääks koondisse, kasvaks recordCount iga paranduse peale ja
   kasutaja „ma eksisin ühe vastusega" muutuks kaheks kirjeks statistikas. */
test("correcting a record replaces it in the live aggregate instead of doubling it", async () => {
  const { prisma } = createLiveStore([
    storedRecord("rec_a", "user_1"),
    storedRecord("rec_b", "user_2"),
    storedRecord("rec_c", "user_3")
  ]);

  const before = await buildWellbeingAggregateDataset({}, { prisma });
  assert.equal(before.recordCount, 3);
  assert.equal(before.sampleSize, 3);

  await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: quickCheckFields({ workloadLevel: "moderate" })
  }, { prisma });

  const after = await buildWellbeingAggregateDataset({}, { prisma });
  assert.equal(after.recordCount, 3, "parandus asendab kirje koondis, ei lisa teist");
  assert.equal(after.sampleSize, 3, "omanike arv ei muutu parandamisest");
});

test("the corrected record stays readable and both ends of the chain are visible", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  const { record, correctedRecordId } = await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: quickCheckFields({ workloadLevel: "moderate" })
  }, { prisma });

  assert.equal(correctedRecordId, "rec_a");
  assert.equal(record.supersedesRecordId, "rec_a", "parandus viitab parandatavale");
  assert.equal(record.aggregationEligible, true);

  const original = await getWellbeingRecordForUser("user_1", "rec_a", { prisma });
  assert.ok(original, "parandatav jääb omanikule loetavaks — parandamine ei ole kustutamine");
  assert.equal(original.aggregationEligible, false, "parandatav on koondist väljas");
  assert.equal(original.supersededBy?.id, record.id, "parandatav teab oma parandust");
});

test("the correction inherits period and role group when it does not restate them", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  const { record } = await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: quickCheckFields({ workloadLevel: "low" })
  }, { prisma });

  assert.equal(record.period, "2026-W29", "parandus kirjeldab sama hetke, mitte uut");
  assert.equal(record.roleGroup, "child_protection");
  assert.equal(record.workflowType, "quick-check", "parandus ehitatakse originaali töövoo builderiga");
});

test("a record can be corrected only once, but a chain of corrections is allowed", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  const first = await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: quickCheckFields({ workloadLevel: "moderate" })
  }, { prisma });

  /* Teine parandus SAMA kirje peale on keelatud: see jätaks koondisse kaks
     „kehtivat" versiooni. */
  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
      standardizedFields: quickCheckFields({ workloadLevel: "low" })
    }, { prisma }),
    /wellbeing.errors.record_already_superseded/
  );

  /* Aga paranduse parandamine (ahel A <- B <- C) on lubatud. */
  const second = await createWellbeingRecordCorrectionForUser("user_1", first.record.id, {
    standardizedFields: quickCheckFields({ workloadLevel: "low" })
  }, { prisma });
  assert.equal(second.record.supersedesRecordId, first.record.id);

  const aggregate = await buildWellbeingAggregateDataset({}, { prisma });
  assert.equal(aggregate.recordCount, 1, "kolmeliikmelisest ahelast on koondis täpselt üks kirje");
});

test("correction is owner-scoped and never confirms a foreign record exists", async () => {
  const { prisma, rows } = createLiveStore([
    storedRecord("rec_mine", "user_1"),
    storedRecord("rec_theirs", "user_2")
  ]);

  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "rec_theirs", {
      standardizedFields: quickCheckFields()
    }, { prisma }),
    /wellbeing.errors.record_missing/,
    "võõras kirje annab sama vea mis olematu — olemasolu ei leki"
  );
  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "rec_absent", {
      standardizedFields: quickCheckFields()
    }, { prisma }),
    /wellbeing.errors.record_missing/
  );

  assert.equal(rows.length, 2, "ebaõnnestunud parandus ei loo ega muuda midagi");
  assert.equal(rows.every((row) => row.aggregationEligible === true), true,
    "ebaõnnestunud parandus ei tohi võõrast kirjet koondist välja lükata");
});

test("correction rejects an unauthenticated user and an empty record id", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("", "rec_a", { standardizedFields: quickCheckFields() }, { prisma }),
    /wellbeing.errors.unauthorized/
  );
  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "", { standardizedFields: quickCheckFields() }, { prisma }),
    /wellbeing.errors.record_missing/
  );
});

test("correction validates the standardized fields of the original workflow", async () => {
  const { prisma, rows } = createLiveStore([storedRecord("rec_a", "user_1")]);

  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
      standardizedFields: { workloadLevel: "low" }
    }, { prisma }),
    /wellbeing.errors.invalid_standardized_fields/
  );

  assert.equal(rows.length, 1, "vigane parandus ei loo kirjet");
  assert.equal(rows[0].aggregationEligible, true, "vigane parandus ei lükka originaali koondist välja");
});

test("a workflow type without a builder cannot be corrected", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1", { workflowType: "overview" })]);

  await assert.rejects(
    () => createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
      standardizedFields: quickCheckFields()
    }, { prisma }),
    /wellbeing.errors.workflow_not_correctable/
  );
});

/* §19.8 lubadus jääb kehtima ka ahelas: kustutus on päris kustutus ja ta ei tohi
   teha teisi ahela liikmeid loetamatuks. (FK `ON DELETE SET NULL` jõustub päris
   DB-s; siin on tõendatud rakenduskihi pool.) */
test("deleting the original leaves the correction readable", async () => {
  const { prisma } = createLiveStore([storedRecord("rec_a", "user_1")]);

  const { record } = await createWellbeingRecordCorrectionForUser("user_1", "rec_a", {
    standardizedFields: quickCheckFields({ workloadLevel: "moderate" })
  }, { prisma });

  const deleted = await deleteWellbeingRecordForUser("user_1", "rec_a", { prisma });
  assert.deepEqual(deleted, { deleted: true, count: 1 });

  const correction = await getWellbeingRecordForUser("user_1", record.id, { prisma });
  assert.ok(correction, "parandus jääb alles ka siis, kui parandatav kustutatakse");
  assert.equal(correction.aggregationEligible, true);
});

/* SOL-WB-08: kokkulepe LIIGUB parandusega kaasa, mitte ei jää kahte kohta.
   Vana rada kopeeris `checkpointDueOn`/`checkpoint` uuele reale ja jättis need
   ka vanale — taimer nägi mõlemat, sourceId erines ja kasutaja sai sama
   kokkuleppe kohta kaks badge'i ning kaks iseseisvalt vastatavat kontrollpunkti. */
test("correction moves the checkpoint instead of leaving one on each row", async () => {
  const dueOn = new Date("2026-08-01T09:00:00.000Z");
  const store = createLiveStore([
    {
      id: "rec_1",
      ownerUserId: "user_1",
      workflowType: "quick-check",
      schemaVersion: "1.0",
      scoringVersion: "quick-check-v1",
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: quickCheckFields(),
      computedSignal: { signalLevel: "yellow" },
      loadFactors: [],
      resourceFactors: [],
      riskMarkers: [],
      recommendedActions: [],
      visibility: "private",
      aggregationEligible: true,
      checkpointDueOn: dueOn,
      checkpointAnsweredAt: null,
      checkpoint: { id: "cp_1", nextStep: "räägin juhiga", setAt: "2026-07-20T09:00:00.000Z", followUp: null },
      createdAt: new Date("2026-07-20T09:00:00.000Z")
    }
  ]);

  const { record } = await createWellbeingRecordCorrectionForUser(
    "user_1",
    "rec_1",
    { standardizedFields: quickCheckFields({ workloadLevel: "moderate" }) },
    { prisma: store.prisma }
  );

  const original = store.rows.find((row) => row.id === "rec_1");
  assert.equal(original.checkpointDueOn, null);
  assert.equal(original.checkpoint, null);
  assert.deepEqual(record.checkpointDueOn, dueOn);
  assert.equal(record.checkpoint.id, "cp_1");

  const active = store.rows.filter((row) => row.checkpointDueOn);
  assert.equal(active.length, 1, "aktiivne kontrollpunkt peab olema täpselt üks");
  assert.equal(active[0].id, record.id);
});

/* Juba VASTATUD kokkulepe ei tohi paranduse peale taimeris uuesti ellu ärgata. */
test("an answered checkpoint stays answered after a correction", async () => {
  const answeredAt = new Date("2026-08-02T09:00:00.000Z");
  const store = createLiveStore([
    {
      id: "rec_2",
      ownerUserId: "user_1",
      workflowType: "quick-check",
      schemaVersion: "1.0",
      scoringVersion: "quick-check-v1",
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: quickCheckFields(),
      computedSignal: { signalLevel: "yellow" },
      loadFactors: [],
      resourceFactors: [],
      riskMarkers: [],
      recommendedActions: [],
      visibility: "private",
      aggregationEligible: true,
      checkpointDueOn: new Date("2026-08-01T09:00:00.000Z"),
      checkpointAnsweredAt: answeredAt,
      checkpoint: {
        id: "cp_2",
        nextStep: "räägin juhiga",
        setAt: "2026-07-20T09:00:00.000Z",
        followUp: { state: "kept", notedAt: answeredAt.toISOString() }
      },
      createdAt: new Date("2026-07-20T09:00:00.000Z")
    }
  ]);

  const { record } = await createWellbeingRecordCorrectionForUser(
    "user_1",
    "rec_2",
    { standardizedFields: quickCheckFields({ workloadLevel: "low" }) },
    { prisma: store.prisma }
  );

  assert.deepEqual(record.checkpointAnsweredAt, answeredAt);
  assert.equal(record.checkpoint.followUp.state, "kept");
});
