import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getCaseWorkbench, SECTION_STATE, WORKBENCH_SECTIONS } from "../../lib/casework/workbench.js";
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
  const seen = {};
  const requireOwner = (where, field = "ownerUserId") => {
    const owner = where?.[field] ?? where?.caseWorkAssist?.[field];
    if (!owner) throw new Error(`skoopimata päring: ${field} puudub`);
    return owner;
  };

  return {
    seen,
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
      /* `select` salvestatakse, sest lugeja väljavalik ON osa lepingust:
         ilma temata kannaks iga uus veerg end laua vastusesse ise. */
      async findMany({ where, select }) {
        if (!where?.workerId) throw new Error("skoopimata päring: workerId puudub");
        seen.networkShareSelect = select || null;
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
      /* Erindi teade jäljendab päris juhtu: Prisma paneb teatesse ebaõnnestunud
         päringu argumendid ja teenuskiht kirje teksti. */
      throw new Error("kovisiooni allikas on maas: seed 'kliendi olukord X'");
    };

    const logged = [];
    const originalError = console.error;
    console.error = (...args) => logged.push(args.map((arg) => JSON.stringify(arg)).join(" "));

    let sections;
    try {
      ({ sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store }));
    } finally {
      console.error = originalError;
    }

    assert.equal(sections.covisionPreparation.state, SECTION_STATE.ERROR);
    assert.equal(sections.activePreparations.state, SECTION_STATE.OK);
    assert.equal(sections.openMissingInfo.state, SECTION_STATE.EMPTY);

    /* Veateade EI TOHI vastusesse jõuda — erind võib kanda kirje sisu. */
    assert.equal(JSON.stringify(sections).includes("kliendi olukord"), false);

    /* EGA LOGISSE. Vastusest väljajätmine hoiab isikuandme HTTP-st eemal, aga
       serverilogi on lihtsalt teine hoidla, teise säilituse ja teise
       ligipääsuga. Logisse tohib jõuda ainult see, mis on sisu poolest
       konstant: sektsiooni võti ja erindi klass. */
    const log = logged.join(" | ");
    assert.equal(log.includes("kliendi olukord"), false, `erindi teade jõudis logisse: ${log}`);
    assert.equal(log.includes("maas"), false, `erindi teade jõudis logisse: ${log}`);
    assert.ok(log.includes("covisionPreparation"), "logi peab ütlema, MILLINE sektsioon kukkus");
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
       08.08 21:00 UTC.

       KAKS ESIMEST RIDA ON PIIRIL ja nemad eristavad Eesti päeva UTC-päevast:
         07.08 21:30 UTC = 08.08 00:30 Eestis → TÄNA (UTC ütleks „eile")
         08.08 21:30 UTC = 09.08 00:30 Eestis → HOMME (UTC ütleks „täna")
       Vana, serveri ajavööndist sõltuv arvutus andis UTC-serveris mõlemad
       valesse sektsiooni. Varasem katvus seda EI TABANUD: fikstuurid olid
       päeva keskel, kus UTC-piir ja Eesti piir annavad sama vastuse. */
    const store = db({
      cases: [
        caseRow({ id: "kesooeel", nextContactAt: new Date("2026-08-07T21:30:00.000Z") }),
        caseRow({ id: "kesooejarel", nextContactAt: new Date("2026-08-08T21:30:00.000Z") }),
        caseRow({ id: "hommik", nextContactAt: new Date("2026-08-08T05:00:00.000Z") }),
        caseRow({ id: "hilisohtu", nextContactAt: new Date("2026-08-08T20:00:00.000Z") }),
        caseRow({ id: "homme", nextContactAt: new Date("2026-08-09T07:00:00.000Z") })
      ]
    });

    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });

    const today = sections.todaysContacts.items.map((row) => row.caseId).sort();
    const upcoming = sections.upcomingContacts.items.map((row) => row.caseId).sort();

    assert.deepEqual(today, ["hilisohtu", "hommik", "kesooeel"]);
    assert.deepEqual(upcoming, ["homme", "kesooejarel"]);
    assert.equal(today.some((id) => upcoming.includes(id)), false, "sektsioonid kattuvad");
  })
);

test("8. koondlugeja ei kutsu ühtegi prisma.* meetodit otse (leping L10)", () => {
  const source = readFileSync(fileURLToPath(new URL("../../lib/casework/workbench.js", import.meta.url)), "utf8");

  /* 04.08 IDOR tekkis koondvaatest, mis tegi oma päringu ja unustas skoobi.
     Kontroll on staatiline, sest käitusaegne test tabaks ainult neid radu,
     mida ta juhtub läbima. */
  const direct = source.match(/\b(?:prisma|prismaClient|db)\s*\.\s*[a-zA-Z]+\s*\.\s*(?:findMany|findFirst|findUnique|groupBy|count|create|update|updateMany|delete|deleteMany)\s*\(/g);
  assert.equal(direct, null, `koondlugeja teeb oma päringu: ${direct?.join(", ")}`);
});

test(
  "9. sektsioon annab DESKRIPTORI, mitte andmebaasi rida (L1a)",
  withFeature("1", async () => {
    /* Laud loeb kaheksat allikat ja E2 saadab tema vastuse brauserisse. Kui
       sektsioon annaks lugeja rea edasi „nagu on", määraks laua avaliku kuju
       see, mis juhtumisi seisab mudelis. Need väärtused on fikstuuridesse
       pandud nimeliselt: ükski neist ei tohi vastusesse jõuda. */
    const store = db({
      cases: [
        caseRow({
          id: "case_1",
          nextContactAt: new Date("2026-08-08T05:00:00.000Z"),
          preInquiryId: "pi_paritolu",
          clientUserId: "klient_konto",
          clientExternalRef: "EE-49001010001",
          externalSystem: "STAR2",
          externalReference: "STAR-menetlus-777"
        })
      ],
      missingInfo: [
        { id: "m1", ownerUserId: "w1", caseWorkAssistId: "case_1", status: "OPEN", text: "puuduv tõend" }
      ],
      shares: [
        {
          id: "share_1",
          workerId: "w1",
          status: "DRAFT",
          updatedAt: NOW,
          summaryText: "kliendi kokkuvõte",
          purpose: "jagamise eesmärk",
          sharingBoundary: "piir"
        }
      ],
      seeds: [{ id: "seed_1", ownerId: "w1", title: "teema", status: "DRAFT", whyNow: "miks praegu", updatedAt: NOW }]
    });

    const { sections } = await getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: store });
    const rendered = JSON.stringify(sections);

    for (const leak of [
      "pi_paritolu",
      "klient_konto",
      "EE-49001010001",
      "STAR-menetlus-777",
      "kliendi kokkuvõte",
      "jagamise eesmärk",
      "miks praegu"
    ]) {
      assert.equal(rendered.includes(leak), false, `toorväli lekkis lauale: ${leak}`);
    }

    /* Ja positiivne pool — kuju on TÄPSELT kokkulepitud, mitte „vähemalt". */
    assert.deepEqual(Object.keys(sections.todaysContacts.items[0]).sort(), ["caseId", "label", "nextContactAt"]);
    assert.deepEqual(
      Object.keys(sections.activePreparations.items[0]).sort(),
      ["caseId", "label", "nextContactAt", "openMissingInfoCount"]
    );
    assert.deepEqual(
      Object.keys(sections.openMissingInfo.items[0]).sort(),
      ["caseId", "createdAt", "itemId", "provenance", "text"]
    );
    assert.deepEqual(Object.keys(sections.networkPreparation.items[0]).sort(), ["shareId", "status", "updatedAt"]);
    assert.deepEqual(Object.keys(sections.covisionPreparation.items[0]).sort(), [
      "seedId",
      "status",
      "title",
      "updatedAt"
    ]);

    /* Deskriptor üksi ei piisa: kui lugeja toob terve rea kohale, elab sisu
       protsessi mälus ja järgmine kutsuja saab ta ilma otsuseta. */
    assert.ok(store.seen.networkShareSelect, "jagamiste lugeja peab küsima valitud välju, mitte tervet rida");
  })
);

test("8b. vastus kannab täpselt L12 tabeli E6-veeru sektsioone", async () => {
  const run = withFeature("1", async () => getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: db({}) }));
  const { sections } = await run();

  assert.deepEqual(Object.keys(sections).sort(), [...WORKBENCH_SECTIONS].sort());

  /* #4 ja #10 SÜNDISID E6-s ja L12 tabel on nüüd täis. Enne seda nad ei olnud
     tühjad — neid EI OLNUD, ja tühi kast oleks tähendanud töötajale, et tal ei
     ole ühtegi mustandit ootel. */
  assert.equal("draftsAwaitingTransfer" in sections, true);
  assert.equal("transferHistory" in sections, true);
  assert.equal(WORKBENCH_SECTIONS.length, 10);
});
