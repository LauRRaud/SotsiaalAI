import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CASE_WORK_TARGET,
  CASE_WORK_TARGETS,
  countCaseWorkItems,
  linkCaseWorkItem,
  unlinkCaseWorkItem
} from "../../lib/casework/caseWorkItem.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";

function withFeatureOn(fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

function db({ assists = [], documents = [], artifacts = [], visits = [], items = [], beforeTransaction = null } = {}) {
  const ownerScoped = (rows, ownerField) => ({
    async findFirst({ where }) {
      return rows.find((row) => row.id === where.id && row[ownerField] === where[ownerField]) || null;
    }
  });
  const seen = { countCalls: 0 };
  const database = {
    items,
    assists,
    seen,
    /* L14 jõustaja elab tehingus (`withActiveCaseLock`); `beforeTransaction`
       laseb testil „teisel tehingul" täpselt sinna vahele jõuda. */
    async $transaction(callback) {
      if (beforeTransaction) await beforeTransaction();
      return callback(database);
    },
    caseWorkAssist: {
      async findFirst({ where }) {
        return assists.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null;
      },
      async updateMany({ where }) {
        const matching = assists.filter(
          (row) =>
            row.id === where.id &&
            row.ownerUserId === where.ownerUserId &&
            (where.retentionState === undefined || row.retentionState === where.retentionState)
        );
        return { count: matching.length };
      }
    },
    userDocument: ownerScoped(documents, "ownerId"),
    agentArtifact: ownerScoped(artifacts, "ownerId"),
    fieldVisit: ownerScoped(visits, "ownerUserId"),
    caseWorkItem: {
      async create({ data }) {
        const row = { id: `item_${items.length + 1}`, createdAt: new Date(), ...data };
        items.push(row);
        return row;
      },
      async deleteMany() {
        /* Nähtavusfiltrit fake-db ei jäljenda — seda tõendab sond päris
           andmebaasi vastu. Siin on oluline ainult, et kutse üldse toimub. */
        return { count: 0 };
      },
      async count({ where }) {
        seen.countCalls += 1;
        return items.filter((row) => row.caseWorkAssistId === where.caseWorkAssistId).length;
      }
    }
  };
  return database;
}

test("sihttüüpide register katab täpselt need veerud, mis skeemis on", () => {
  assert.deepEqual(
    [...CASE_WORK_TARGETS].sort(),
    [CASE_WORK_TARGET.AGENT_ARTIFACT, CASE_WORK_TARGET.FIELD_VISIT, CASE_WORK_TARGET.USER_DOCUMENT].sort()
  );

  /* Skeem on tõde: kui keegi lisab `CaseWorkItem`-ile neljanda sihiveeru ja
     unustab registri, peab SEE test kukkuma — muidu jääks uus sihttüüp
     nähtavusfiltrist välja ja tema seosed oleksid lugemisrajal nähtamatud. */
  const schema = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const model = schema.match(/model CaseWorkItem \{([\s\S]*?)\n\}/u)[1];
  const targetColumns = [...model.matchAll(/^\s{2}(\w+)\s+String\?/gmu)].map((match) => match[1]);
  assert.deepEqual(targetColumns.sort(), ["agentArtifactId", "fieldVisitId", "userDocumentId"]);
});

test(
  "tundmatu sihttüüp kukub FAIL-CLOSED",
  withFeatureOn(async () => {
    await assert.rejects(
      () =>
        linkCaseWorkItem({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          targetType: "JOURNEY",
          targetId: "j1",
          db: db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" }] })
        }),
      (error) => error.status === 400 && error.messageKey === "casework.errors.target_type_unknown"
    );
  })
);

test(
  "sidumine nõuab AKTIIVSET juhtumit",
  withFeatureOn(async () => {
    const database = db({
      assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "READ_ONLY" }],
      documents: [{ id: "d1", ownerId: "w1" }]
    });
    await assert.rejects(
      () =>
        linkCaseWorkItem({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          targetType: CASE_WORK_TARGET.USER_DOCUMENT,
          targetId: "d1",
          db: database
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );
  })
);

test(
  "countCaseWorkItems kannab SAMA omanikupiiri mis loend — võõras juhtum annab 404",
  withFeatureOn(async () => {
    /* v5 leid. Loendur kandis ainult `visibleItemWhere()`-i, mis piirab
       SIHTOBJEKTE, mitte juhtumit ennast — võõra `caseWorkAssistId`-ga kutse ei
       kukkunud, vaid arvutas „mitu MINU objekti on seotud TEMA juhtumiga".

       Fikstuur on tahtlikult see, mis tavaandmetel EI teki: võõras juhtum, mille
       küljes on KUTSUJALE NÄHTAV siht. Nii ei tugine test sellele, et vastus
       oleks nagunii 0 — vastus OLEKS mitte-null, ja just seda loendur ei tohi
       öelda. */
    const database = db({
      assists: [{ id: "case_1", ownerUserId: "keegi-teine", retentionState: "ACTIVE" }],
      documents: [{ id: "d1", ownerId: "w1" }],
      items: [{ id: "item_1", caseWorkAssistId: "case_1", userDocumentId: "d1", createdAt: new Date() }]
    });

    await assert.rejects(
      () => countCaseWorkItems({ ownerUserId: "w1", caseWorkAssistId: "case_1", db: database }),
      (error) => error.status === 404
    );

    /* Ja ta ei tohi päringuni JÕUDA: kontroll enne loendust, mitte loenduse
       tulemuse filtreerimine tagantjärele. */
    assert.equal(database.seen.countCalls, 0, "loendur käivitas päringu võõra juhtumi peal");
  })
);

test(
  "countCaseWorkItems loeb oma juhtumi seosed normaalselt",
  withFeatureOn(async () => {
    const database = db({
      assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "READ_ONLY" }],
      documents: [{ id: "d1", ownerId: "w1" }],
      items: [{ id: "item_1", caseWorkAssistId: "case_1", userDocumentId: "d1", createdAt: new Date() }]
    });

    /* `READ_ONLY` on tahtlik: kirjutuskaitse ei tohi LUGEMIST katkestada. */
    assert.equal(await countCaseWorkItems({ ownerUserId: "w1", caseWorkAssistId: "case_1", db: database }), 1);
    assert.equal(database.seen.countCalls, 1);
  })
);

test(
  "VÕISTLUS: vahepealne retention-siire tapab sidumise, mitte ei kaota",
  withFeatureOn(async () => {
    /* Sama muster mis puuduva info juures: `requireOwnedCase` andis vastuse
       „ACTIVE", `transitionRetention` jõudis vahele, ja seos tekkis
       kirjutuskaitstud juhtumisse. Jõustaja on nüüd kirjutuse enda sees. */
    const parent = { id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" };
    const database = db({
      assists: [parent],
      documents: [{ id: "d1", ownerId: "w1" }],
      beforeTransaction: () => {
        parent.retentionState = "READ_ONLY";
      }
    });

    await assert.rejects(
      () =>
        linkCaseWorkItem({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          targetType: CASE_WORK_TARGET.USER_DOCUMENT,
          targetId: "d1",
          db: database
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );

    assert.equal(database.items.length, 0, "kirjutuskaitstud juhtumisse tekkis ikkagi seos");
  })
);

test(
  "L4: võõra objekti sidumine annab 404, mitte vaikset lisamist",
  withFeatureOn(async () => {
    const database = db({
      assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" }],
      documents: [{ id: "d1", ownerId: "keegi-teine" }]
    });
    await assert.rejects(
      () =>
        linkCaseWorkItem({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          targetType: CASE_WORK_TARGET.USER_DOCUMENT,
          targetId: "d1",
          db: database
        }),
      (error) => error.status === 404
    );
    assert.equal(database.items.length, 0, "keeldumine ei tohi jätta rida");
  })
);

test(
  "oma objekti sidumine õnnestub ja annab tüübi tagasi",
  withFeatureOn(async () => {
    const database = db({
      assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" }],
      visits: [{ id: "v1", ownerUserId: "w1" }]
    });
    const item = await linkCaseWorkItem({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      targetType: CASE_WORK_TARGET.FIELD_VISIT,
      targetId: "v1",
      db: database
    });
    assert.equal(item.targetType, CASE_WORK_TARGET.FIELD_VISIT);
    assert.equal(item.targetId, "v1");
  })
);

test(
  "võõra juhtumi seoseid ei saa lisada ega eemaldada — 404",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "keegi-teine", retentionState: "ACTIVE" }] });
    await assert.rejects(
      () => unlinkCaseWorkItem({ ownerUserId: "w1", caseWorkAssistId: "case_1", itemId: "item_1", db: database }),
      (error) => error.status === 404
    );
  })
);

test(
  "nähtamatu seose eemaldamine annab 404 — õnnestumine kinnitaks tema olemasolu",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" }] });
    await assert.rejects(
      () => unlinkCaseWorkItem({ ownerUserId: "w1", caseWorkAssistId: "case_1", itemId: "item_x", db: database }),
      (error) => error.status === 404
    );
  })
);
