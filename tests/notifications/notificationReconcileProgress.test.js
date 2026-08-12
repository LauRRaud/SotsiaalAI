import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RECONCILE_SOURCES,
  loadReconcileCursors,
  reconcileNotificationEvents,
  saveReconcileCursors
} from "../../lib/notificationReconciler.js";

/* SOL-NOTIF-02, -03 ja -04 — kolm viga samas reconciler'is.

   -02: iga käivitus algas `cursor = null` pealt ja katkes 100 lehekülje järel,
   seega esimese ~10 000 sobiva rea taha jäänud read ei jõudnud KUNAGI teavituseni.
   -03: ruumiaktiivsuse autorite välistus käis ainult hetkelehekülje pealt.
   -04: dedupe-aken tuli worker'i kellast, valikuaken liikuvast piirist. */

const NOW = new Date("2026-08-12T12:00:00.000Z");

function cursorStore(initial = {}) {
  const rows = new Map(Object.entries(initial));
  return {
    rows,
    notificationReconcileCursor: {
      async findMany({ where }) {
        return [...rows.entries()]
          .filter(([source]) => where.source.in.includes(source))
          .map(([source, cursorId]) => ({ source, cursorId }));
      },
      async upsert({ where, create, update }) {
        rows.set(where.source, ("cursorId" in update ? update.cursorId : create.cursorId) ?? null);
        return { source: where.source };
      }
    }
  };
}

/** Allikas, kus on `total` rida ja mis austab ID-kursorit. */
function pagedSource(total, prefix) {
  const ids = Array.from({ length: total }, (_, index) => `${prefix}${String(index + 1).padStart(4, "0")}`);
  return {
    ids,
    // Adressaadi kontroll () küsib allikalt rea üle.
    async findFirst() { return { id: "source-row", recipientOwnerId: null }; },
    async findMany({ where, take }) {
      // `preInquiry` teenindab KAHTE allikat; „due" oma tunneb ära `nextContactOn`.
      if (where?.nextContactOn) return [];
      const after = where?.id?.gt || "";
      return ids
        .filter((id) => id > after)
        .slice(0, take)
        .map((id) => ({
          id,
          authorId: `author-${id}`,
          recipientOwnerId: `owner-${id}`,
          sentAt: NOW,
          updatedAt: NOW,
          status: "SENT",
          openedAt: null
        }));
    }
  };
}

function emptySource() {
  return { async findMany() { return []; }, async findFirst() { return null; } };
}

function reconcilerDb({ inquiries = emptySource(), cursors = cursorStore() } = {}) {
  const created = [];
  return {
    created,
    ...cursors,
    preInquiry: inquiries,
    invite: emptySource(),
    roomMessage: { ...emptySource(), async aggregate() { return { _max: { createdAt: null } }; } },
    roomMember: emptySource(),
    helpMatch: emptySource(),
    effectivePracticeReviewAssignment: emptySource(),
    serviceProviderService: emptySource(),
    user: { async findUnique() { return { notificationEmailEnabled: false }; } },
    notificationEvent: {
      async create({ data }) {
        created.push(data);
        return { id: `n${created.length}`, ...data };
      },
      async findUnique() { return null; }
    }
  };
}

test("KANDEV: teine jooks jätkab sealt, kus esimene pooleli jäi", async () => {
  const cursors = cursorStore();
  const db = reconcilerDb({ inquiries: pagedSource(5, "inq-"), cursors });

  const first = await reconcileNotificationEvents({ db, now: NOW, batchSize: 2 });
  assert.equal(first.considered, 2);
  assert.equal(cursors.rows.get("inquiries"), "inq-0002", "koht salvestati andmebaasi");

  const second = await reconcileNotificationEvents({ db, now: NOW, batchSize: 2 });
  assert.equal(second.considered, 2);
  assert.deepEqual(
    db.created.map((row) => row.sourceId),
    ["inq-0001", "inq-0002", "inq-0003", "inq-0004"],
    "vana kuju oleks lugenud teisel jooksul uuesti inq-0001 ja inq-0002"
  );
});

test("allika lõpp salvestab NULL-i ja järgmine jooks alustab ringiga otsast", async () => {
  const cursors = cursorStore();
  const db = reconcilerDb({ inquiries: pagedSource(3, "inq-"), cursors });

  await reconcileNotificationEvents({ db, now: NOW, batchSize: 2 });
  await reconcileNotificationEvents({ db, now: NOW, batchSize: 2 });
  assert.equal(cursors.rows.get("inquiries"), null, "allikas sai otsa");

  db.created.length = 0;
  await reconcileNotificationEvents({ db, now: NOW, batchSize: 2 });
  assert.deepEqual(
    db.created.map((row) => row.sourceId),
    ["inq-0001", "inq-0002"],
    "ring otsast: hiljem sobivaks muutuv vana rida ei jää igaveseks vesimärgi taha"
  );
});

test("dryRun ei liiguta kohta", async () => {
  const cursors = cursorStore();
  const db = reconcilerDb({ inquiries: pagedSource(5, "inq-"), cursors });
  await reconcileNotificationEvents({ db, now: NOW, batchSize: 2, dryRun: true });
  assert.equal(cursors.rows.size, 0, "proovijooks ei varasta ridu päris jooksult");
});

test("selge kursor (jooksu sees) ei loe andmebaasist", async () => {
  const cursors = cursorStore({ inquiries: "inq-0004" });
  const db = reconcilerDb({ inquiries: pagedSource(5, "inq-"), cursors });
  const result = await reconcileNotificationEvents({
    db,
    now: NOW,
    batchSize: 2,
    cursor: Buffer.from(JSON.stringify({ inquiries: "inq-0001" }), "utf8").toString("base64url")
  });
  assert.equal(result.considered, 2);
  assert.deepEqual(db.created.map((row) => row.sourceId), ["inq-0002", "inq-0003"]);
});

test("kursoriteenused katavad kõik seitse allikat", async () => {
  const cursors = cursorStore();
  await saveReconcileCursors(cursors, { inquiries: "a", rooms: "b" });
  assert.equal(cursors.rows.size, RECONCILE_SOURCES.length);
  const loaded = await loadReconcileCursors(cursors);
  assert.deepEqual(loaded, { inquiries: "a", rooms: "b" }, "NULL tähendab „alusta algusest“, mitte „jäta vahele“");
});

/* SOL-NOTIF-03 ja -04 */

function roomDb({ authors, latestAt, members }) {
  const created = [];
  return {
    created,
    ...cursorStore(),
    preInquiry: emptySource(),
    invite: emptySource(),
    roomMessage: {
      async findMany({ distinct }) {
        if (distinct) return authors.map((authorId) => ({ authorId }));
        return [{ id: "msg-1", roomId: "room-1", authorId: authors[0] }];
      },
      async aggregate() { return { _max: { createdAt: latestAt } }; }
    },
    roomMember: {
      async findMany({ where }) {
        const excluded = where?.userId?.notIn || [];
        return members.filter((userId) => !excluded.includes(userId)).map((userId) => ({ userId }));
      },
      async findFirst() { return { id: "member-row" }; }
    },
    helpMatch: emptySource(),
    effectivePracticeReviewAssignment: emptySource(),
    serviceProviderService: emptySource(),
    user: { async findUnique() { return { notificationEmailEnabled: false }; } },
    notificationEvent: {
      async create({ data }) { created.push(data); return { id: `n${created.length}`, ...data }; },
      async findUnique() { return null; }
    }
  };
}

test("KANDEV: autorid välistatakse kogu akna pealt, mitte hetkeleheküljelt", async () => {
  // Lehel on ainult author-1, aga aknas kirjutas ka member-2.
  const db = roomDb({
    authors: ["author-1", "member-2"],
    latestAt: new Date("2026-08-12T11:00:00.000Z"),
    members: ["author-1", "member-2", "member-3"]
  });
  await reconcileNotificationEvents({ db, now: NOW, batchSize: 1 });
  const recipients = db.created.map((row) => row.userId);
  assert.deepEqual(recipients, ["member-3"], "keegi ei saa teadet aktiivsusest, mille ta ise tekitas");
});

test("KANDEV: dedupe-aken tuleb sündmuse ajast, mitte worker'i kellast", async () => {
  const latestAt = new Date("2026-08-12T11:00:00.000Z");
  const build = () => roomDb({ authors: ["author-1"], latestAt, members: ["member-3"] });

  const before = build();
  await reconcileNotificationEvents({ db: before, now: new Date("2026-08-12T11:59:00.000Z"), batchSize: 1 });
  const after = build();
  // Sama sõnum, aga job jookseb kuue tunni piiri TEISEL pool.
  await reconcileNotificationEvents({ db: after, now: new Date("2026-08-12T12:01:00.000Z"), batchSize: 1 });

  assert.equal(before.created[0].dedupeKey, after.created[0].dedupeKey,
    "sama aktiivsus → sama võti, ükskõik millal job jookseb");
  assert.match(before.created[0].dedupeKey, /2026-08-12T06:00:00\.000Z/);
});

test("uus sõnum järgmises ämbris annab ausalt uue teate", async () => {
  const first = roomDb({
    authors: ["author-1"],
    latestAt: new Date("2026-08-12T11:00:00.000Z"),
    members: ["member-3"]
  });
  const second = roomDb({
    authors: ["author-1"],
    latestAt: new Date("2026-08-12T13:00:00.000Z"),
    members: ["member-3"]
  });
  await reconcileNotificationEvents({ db: first, now: NOW, batchSize: 1 });
  await reconcileNotificationEvents({ db: second, now: new Date("2026-08-12T13:30:00.000Z"), batchSize: 1 });
  assert.notEqual(first.created[0].dedupeKey, second.created[0].dedupeKey);
});

test("leping: kursor on püsiv ja aken tuleb sündmusest", async () => {
  const source = await readFile(new URL("../../lib/notificationReconciler.js", import.meta.url), "utf8");
  assert.match(source, /loadReconcileCursors/);
  assert.match(source, /saveReconcileCursors/);
  assert.match(source, /distinct: \["authorId"\]/);
  assert.match(source, /roomWindow\(latestActivityAt\)/);
  assert.ok(!/dedupeSuffix: roomWindow\(now\)/.test(source), "vana kellapõhine aken on tagasi");
});
