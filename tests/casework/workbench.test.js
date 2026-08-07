import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  estonianDayBounds,
  getCaseWorkbench,
  SECTION_STATE,
  WORKBENCH_SECTIONS
} from "../../lib/casework/workbench.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";

/* JTA-V1 E1 testileping (leping v4). Kaheksa punkti, kõik nimeliselt. */

function withFeature(value, fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    if (value === null) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
    else process.env[CASEWORK_FLAG_KEYS.ENABLED] = value;
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

const WORKER = { effectiveRole: "SOCIAL_WORKER" };
const PROVIDER = { effectiveRole: "SERVICE_PROVIDER" };

/** 08.08.2026 kell 12:00 Eesti aja järgi (suveaeg, UTC+3). */
const NOW = new Date("2026-08-08T09:00:00.000Z");

function caseRow(overrides = {}) {
  return {
    id: "case_1",
    ownerUserId: "w1",
    preInquiryId: null,
    urgentRequestId: null,
    clientUserId: null,
    clientDisplayName: "perearst R",
    clientExternalRef: null,
    clientErasedAt: null,
    externalSystem: null,
    externalReference: null,
    nextContactAt: null,
    retentionState: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

/**
 * Fake-db, mis JÄLJENDAB SKOOPI: iga päring peab kandma `ownerUserId`-d, muidu
 * ta viskab. Nii ei saa test läbi minna kogemata — skoobita lugeja kukub siin,
 * mitte alles toodangus.
 */
function db({ cases = [], missingInfo = [], preInquiries = [], shares = [], seeds = [], reflection = null } = {}) {
  const requireOwner = (where, field = "ownerUserId") => {
    const owner = where?.[field] ?? where?.caseWorkAssist?.[field];
    if (!owner) throw new Error(`skoopimata päring: ${field} puudub`);
    return owner;
  };

  return {
    caseWorkAssist: {
      async findMany({ where }) {
        const owner = requireOwner(where);
        return cases.filter((row) => {
          if (row.ownerUserId !== owner) return false;
          if (where.retentionState && row.retentionState !== where.retentionState) return false;
          if (where.nextContactAt) {
            if (!row.nextContactAt) return false;
            const at = row.nextContactAt.getTime();
            if (where.nextContactAt.gte && at < where.nextContactAt.gte.getTime()) return false;
            if (where.nextContactAt.lt && at >= where.nextContactAt.lt.getTime()) return false;
          }
          return true;
        });
      }
    },
    caseWorkMissingInfo: {
      async findMany({ where }) {
        const owner = requireOwner(where);
        return missingInfo.filter((row) => row.ownerUserId === owner && row.status === where.status);
      },
      async groupBy({ where }) {
        const owner = requireOwner(where);
        const counts = new Map();
        for (const row of missingInfo) {
          if (row.ownerUserId !== owner || row.status !== where.status) continue;
          counts.set(row.caseWorkAssistId, (counts.get(row.caseWorkAssistId) || 0) + 1);
        }
        return [...counts].map(([caseWorkAssistId, n]) => ({ caseWorkAssistId, _count: { _all: n } }));
      }
    },
    preInquiry: {
      async findMany({ where }) {
        if (!where?.recipientOwnerId) throw new Error("skoopimata päring: recipientOwnerId puudub");
        return preInquiries.filter((row) => row.recipientOwnerId === where.recipientOwnerId);
      }
    },
    networkShare: {
      async findMany({ where }) {
        if (!where?.workerId) throw new Error("skoopimata päring: workerId puudub");
        return shares.filter((row) => row.workerId === where.workerId);
      }
    },
    topicSeed: {
      async findMany({ where }) {
        if (!where?.ownerId) throw new Error("skoopimata päring: ownerId puudub");
        return seeds.filter((row) => row.ownerId === where.ownerId);
      }
    },
    practiceReflection: {
      async findFirst() {
        return reflection;
      },
      async aggregate() {
        return { _max: { updatedAt: reflection?.updatedAt || null } };
      }
    },
    user: { async findMany() { return []; } }
  };
}

test(
  "1. võõra kasutaja andmeid ei jõua ühessegi sektsiooni",
  withFeature("1", async () => {
    const store = db({
      cases: [caseRow({ id: "mine" }), caseRow({ id: "theirs", ownerUserId: "w2" })],
      missingInfo: [
        { id: "m1", ownerUserId: "w1", caseWorkAssistId: "mine", status: "OPEN", text: "minu" },
        { id: "m2", ownerUserId: "w2", caseWorkAssistId: "theirs", status: "OPEN", text: "võõras" }
      ]
    });

    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });

    const rendered = JSON.stringify(sections);
    assert.equal(rendered.includes("theirs"), false, "võõra juhtumi id lekkis lauale");
    assert.equal(rendered.includes("võõras"), false, "võõra puuduva info tekst lekkis lauale");
    assert.equal(sections.activePreparations.items.length, 1);
    assert.equal(sections.openMissingInfo.items.length, 1);
  })
);

test(
  "2. sektsioon eristab EMPTY ja FORBIDDEN",
  withFeature("1", async () => {
    const store = db({});

    const worker = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });
    assert.equal(worker.sections.networkPreparation.state, SECTION_STATE.EMPTY);

    /* Teenuseosutajal EI OLE võrgustikutööd. Tühi loend väidaks, et tal ei ole
       midagi ootel — tegelikult ei ole tal seda tööriista. */
    const provider = await getCaseWorkbench({ userId: "p1", roleState: PROVIDER, now: NOW, db: store });
    assert.equal(provider.sections.networkPreparation.state, SECTION_STATE.FORBIDDEN);
    assert.ok(provider.sections.networkPreparation.notice, "FORBIDDEN peab kandma põhjust");
  })
);

test(
  "3. ühe allika erind annab ainult selle sektsiooni ERROR, ülejäänud jäävad terveks",
  withFeature("1", async () => {
    const store = db({ cases: [caseRow()] });
    store.topicSeed.findMany = async () => {
      throw new Error("kovisiooni allikas on maas");
    };

    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });

    assert.equal(sections.covisionPreparation.state, SECTION_STATE.ERROR);
    assert.equal(sections.activePreparations.state, SECTION_STATE.OK);
    assert.equal(sections.openMissingInfo.state, SECTION_STATE.EMPTY);

    /* Veateade EI TOHI vastusesse jõuda — erind võib kanda kirje sisu. */
    assert.equal(JSON.stringify(sections).includes("maas"), false);
  })
);

test(
  "4. aeglane lugeja annab TIMEOUT ja koondkutse tagastab enne tema lõppu",
  withFeature("1", async () => {
    const store = db({ cases: [caseRow()] });
    let slowResolved = false;
    store.topicSeed.findMany = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      slowResolved = true;
      return [];
    };

    const { sections } = await getCaseWorkbench({
      userId: "w1",
      roleState: WORKER,
      now: NOW,
      deadlineMs: 30,
      db: store
    });

    assert.equal(sections.covisionPreparation.state, SECTION_STATE.TIMEOUT);
    assert.equal(slowResolved, false, "koond ootas aeglase lugeja lõpuni");
    assert.equal(sections.activePreparations.state, SECTION_STATE.OK, "aeglane allikas ei tohi lauda blokeerida");
  })
);

test(
  "5. rollita ja väravata kutse annab tühjad sektsioonid, MITTE erindi",
  withFeature("1", async () => {
    const store = db({ cases: [caseRow()] });

    for (const roleState of [null, { effectiveRole: "CLIENT" }, { effectiveRole: "ADMIN" }]) {
      const result = await getCaseWorkbench({ userId: "w1", roleState, now: NOW, db: store });
      for (const key of WORKBENCH_SECTIONS) {
        assert.equal(result.sections[key].state, SECTION_STATE.EMPTY);
        assert.equal(result.sections[key].items.length, 0);
      }
    }

    const noUser = await getCaseWorkbench({ userId: "", roleState: WORKER, now: NOW, db: store });
    assert.equal(noUser.sections.activePreparations.items.length, 0);
  })
);

test(
  "5b. värav väljas -> tühi laud, ka õige rolliga",
  withFeature(null, async () => {
    const store = db({ cases: [caseRow()] });
    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });
    assert.equal(sections.activePreparations.items.length, 0);
  })
);

test(
  "6. activePreparations kannab notice-võtit ka siis, kui ridu ON",
  withFeature("1", async () => {
    const store = db({ cases: [caseRow()] });
    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });

    assert.equal(sections.activePreparations.state, SECTION_STATE.OK);
    assert.equal(sections.activePreparations.notice, "casework.workbench.preparations_not_yet");

    const empty = await getCaseWorkbench({ userId: "w9", roleState: WORKER, now: NOW, db: db({}) });
    assert.equal(empty.sections.activePreparations.state, SECTION_STATE.EMPTY);
    assert.equal(empty.sections.activePreparations.notice, "casework.workbench.preparations_not_yet");
  })
);

test(
  "7. todaysContacts ja upcomingContacts ei kattu, ja piir on EESTI kalendripäev",
  withFeature("1", async () => {
    /* 08.08.2026 on suveaeg (UTC+3). Eesti päev algab 07.08 21:00 UTC ja lõpeb
       08.08 21:00 UTC. Kell 08.08 20:00 UTC = 08.08 23:00 Eestis = TÄNA.
       UTC-põhine loogika jätaks selle homsesse ja töötaja ei näeks teda. */
    const store = db({
      cases: [
        caseRow({ id: "hommik", nextContactAt: new Date("2026-08-08T05:00:00.000Z") }),
        caseRow({ id: "hilisohtu", nextContactAt: new Date("2026-08-08T20:00:00.000Z") }),
        caseRow({ id: "homme", nextContactAt: new Date("2026-08-09T07:00:00.000Z") })
      ]
    });

    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });

    const today = sections.todaysContacts.items.map((row) => row.id).sort();
    const upcoming = sections.upcomingContacts.items.map((row) => row.id).sort();

    assert.deepEqual(today, ["hilisohtu", "hommik"]);
    assert.deepEqual(upcoming, ["homme"]);
    assert.equal(today.some((id) => upcoming.includes(id)), false, "sektsioonid kattuvad");
  })
);

test("7b. estonianDayBounds arvutab nihke mõõtes, mitte konstandiga", () => {
  const suvi = estonianDayBounds(new Date("2026-08-08T09:00:00.000Z"));
  assert.equal(suvi.isoDay, "2026-08-08");
  assert.equal(suvi.start.toISOString(), "2026-08-07T21:00:00.000Z", "suveaeg on UTC+3");

  const talv = estonianDayBounds(new Date("2026-01-15T09:00:00.000Z"));
  assert.equal(talv.isoDay, "2026-01-15");
  assert.equal(talv.start.toISOString(), "2026-01-14T22:00:00.000Z", "talveaeg on UTC+2");
});

test("8. koondlugeja ei kutsu ühtegi prisma.* meetodit otse (leping L10)", () => {
  const source = readFileSync(fileURLToPath(new URL("../../lib/casework/workbench.js", import.meta.url)), "utf8");

  /* 04.08 IDOR tekkis koondvaatest, mis tegi oma päringu ja unustas skoobi.
     Kontroll on staatiline, sest käitusaegne test tabaks ainult neid radu,
     mida ta juhtub läbima. */
  const direct = source.match(/\b(?:prisma|prismaClient|db)\s*\.\s*[a-zA-Z]+\s*\.\s*(?:findMany|findFirst|findUnique|groupBy|count|create|update|updateMany|delete|deleteMany)\s*\(/g);
  assert.equal(direct, null, `koondlugeja teeb oma päringu: ${direct?.join(", ")}`);
});

test("8b. vastus kannab täpselt L12 tabeli E1-veeru sektsioone", async () => {
  const run = withFeature("1", async () => getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: db({}) }));
  const { sections } = await run();

  assert.deepEqual(Object.keys(sections).sort(), [...WORKBENCH_SECTIONS].sort());

  /* #4 ja #10 sünnivad E5-s ja E6-s. Kuni selleta nad EI OLE tühjad — neid ei
     ole. Tühi kast tähendaks töötajale, et tal ei ole ühtegi mustandit ootel. */
  assert.equal("draftsAwaitingTransfer" in sections, false);
  assert.equal("transferHistory" in sections, false);
});
