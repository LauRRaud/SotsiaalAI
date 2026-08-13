import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { listNotificationEvents } from "../../lib/notifications.js";

/* SOL-NOTIF-06 ja -07.

   -06: kuus etappi olid ühes `try` plokis ja ohutuskriitilised sweep'id (välitöö
   dead-man kontroll, kiire abi aegumine) olid viimased. Ükskõik millise varasema
   etapi viga hüppas ühisesse `catch`-i ja need kaks jäid käivitamata.
   -07: teavituste loend luges `limit × 2` uusimat rida ja kontrollis nähtavust
   alles pärast seda — piisav hulk nähtamatuid uusi ridu peitis vanemad KEHTIVAD
   teated ära. */

const ROUTE_URL = new URL("../../app/api/jobs/notifications/route.js", import.meta.url);

test("KANDEV: ohutusetapid on eraldi ja käivituvad ka pärast varasema etapi viga", async () => {
  const source = await readFile(ROUTE_URL, "utf8");

  // Iga etapp jookseb oma veapiiri sees.
  assert.match(source, /async function runStage\(/);
  for (const stage of ["mentoring", "supervision", "reconcile", "projector", "delivery", "fieldSafety", "urgentExpiry"]) {
    assert.match(source, new RegExp(`runStage\\("${stage}"`), stage);
  }

  // Ohutusetapid EI TOHI olla sama `try` sees, mis kannab varasemaid etappe.
  assert.ok(
    !/try \{[\s\S]*runFieldSafetySweep[\s\S]*\} catch/.test(source),
    "välitöö sweep on tagasi ühises try-plokis"
  );
  assert.ok(
    !/try \{[\s\S]*runUrgentExpirySweep[\s\S]*\} catch/.test(source),
    "kiire abi sweep on tagasi ühises try-plokis"
  );

  // Vastus peab ütlema, MIS kukkus — muidu on „ok" vaikne vale.
  assert.match(source, /failedStages/);
  assert.match(source, /safetyOk/);
  assert.match(source, /stages\.fieldSafety\?\.ok === true && stages\.urgentExpiry\?\.ok === true/);
});

test("iga etapp jookseb TÄPSELT ÜKS kord ja viga ei nakata teisi", async () => {
  /* `runStage` on väike ja puhas — mudeldame ta siin ümber, et mõõta lepingut
     ennast: viga läheb kirja, aga järgmised etapid käivituvad. */
  const source = await readFile(ROUTE_URL, "utf8");
  const body = source.slice(source.indexOf("async function runStage("));
  const runStage = new Function(
    "safeError",
    "console",
    `${body.slice(0, body.indexOf("\n}") + 2)}; return runStage;`
  )(() => ({}), { error() {} });

  const statuses = {};
  const calls = [];
  await runStage("first", statuses, async () => {
    calls.push("first");
    throw Object.assign(new Error("boom"), { code: "STAGE_BOOM" });
  });
  const second = await runStage("fieldSafety", statuses, async () => {
    calls.push("fieldSafety");
    return { checked: 1 };
  });

  assert.deepEqual(calls, ["first", "fieldSafety"], "ohutusetapp käivitus hoolimata varasemast veast");
  assert.equal(statuses.first.ok, false);
  assert.equal(statuses.first.code, "STAGE_BOOM");
  assert.equal(statuses.fieldSafety.ok, true);
  assert.deepEqual(second, { checked: 1 });
});

/* SOL-NOTIF-07 */

test("KANDEV: vanem kehtiv teade ei kao uute nähtamatute taha", async () => {
  const total = 120;
  const rows = Array.from({ length: total }, (_, index) => ({
    id: `n${String(total - index).padStart(4, "0")}`,
    userId: "user-1",
    type: "ROOM_ACTIVITY",
    sourceType: "ROOM",
    sourceId: index === total - 1 ? "room-visible" : "room-gone",
    targetKind: "ROOM",
    targetId: index === total - 1 ? "room-visible" : "room-gone",
    readAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: new Date(Date.now() - index * 1000),
    emailPolicy: "NONE"
  }));
  let pages = 0;
  const db = {
    notificationEvent: {
      async findMany({ take, cursor, skip }) {
        pages += 1;
        const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + (skip || 0) : 0;
        return rows.slice(start, start + take).map((row) => ({ ...row }));
      }
    },
    roomMember: {
      async findFirst({ where }) {
        return where.roomId === "room-visible" ? { id: "member" } : null;
      }
    }
  };

  const visible = await listNotificationEvents("user-1", { db, limit: 5 });

  assert.equal(visible.length, 1, "ainus kehtiv teade leitakse üles");
  assert.ok(pages > 1, "päring liikus lehekülgede kaupa edasi, mitte ei jäänud ühte eelvalikusse");
});

test("nähtavaid ridu ei loeta rohkem kui limiit", async () => {
  const total = 40;
  const rows = Array.from({ length: total }, (_, index) => ({
    id: `n${String(total - index).padStart(4, "0")}`,
    userId: "user-1",
    type: "ROOM_ACTIVITY",
    sourceType: "ROOM",
    sourceId: "room-visible",
    targetKind: "ROOM",
    targetId: "room-visible",
    readAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: new Date(Date.now() - index * 1000),
    emailPolicy: "NONE"
  }));
  const db = {
    notificationEvent: {
      async findMany({ take, cursor, skip }) {
        const start = cursor ? rows.findIndex((row) => row.id === cursor.id) + (skip || 0) : 0;
        return rows.slice(start, start + take).map((row) => ({ ...row }));
      }
    },
    roomMember: { async findFirst() { return { id: "member" }; } }
  };

  const visible = await listNotificationEvents("user-1", { db, limit: 5 });
  assert.equal(visible.length, 5);
});

test("tühi allikas ei jää lehekülgi lappama", async () => {
  let pages = 0;
  const db = {
    notificationEvent: {
      async findMany() {
        pages += 1;
        return [];
      }
    },
    roomMember: { async findFirst() { return null; } }
  };
  const visible = await listNotificationEvents("user-1", { db, limit: 5 });
  assert.equal(visible.length, 0);
  assert.equal(pages, 1);
});
