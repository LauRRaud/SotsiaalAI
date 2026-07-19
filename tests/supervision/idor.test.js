import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { adminSession } from "./harness.js";
import { setupBase, sv, os1, makeActiveProcess } from "./scenario.js";
import {
  createPrivateItem,
  listPrivateItems,
  updatePrivateItem,
  deletePrivateItem
} from "../../lib/supervision/privateItems.js";
import { getProcessDetail } from "../../lib/supervision/service.js";

test("test #7: SV ei näe osaleja eeskambri kirjet; kumbki näeb ainult oma; M6 ei kirjuta M13", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const auditsBefore = db.store.supervisionAuditEvent.length;

  await createPrivateItem(
    { processId, session: os1(), input: { kind: "PREP_TOPIC", title: "Minu teema", body: "salajane" } },
    { db }
  );
  await createPrivateItem(
    { processId, session: sv(), input: { kind: "PRIVATE_NOTE", body: "sv märge" } },
    { db }
  );

  const osList = await listPrivateItems({ processId, session: os1() }, { db });
  const svList = await listPrivateItems({ processId, session: sv() }, { db });
  assert.equal(osList.items.length, 1);
  assert.equal(svList.items.length, 1);
  assert.equal(osList.items[0].body, "salajane");
  assert.equal(svList.items[0].body, "sv märge");

  // Jagatud protsessivaates pole M6 välju ega osaleja privaatsisu
  const detail = await getProcessDetail({ processId, session: sv() }, { db });
  assert.ok(!("privateItems" in detail));
  assert.ok(!JSON.stringify(detail).includes("salajane"));

  // M6 toimingud EI loo M13 auditikirjet (Q2.4 rida 14–15)
  assert.equal(db.store.supervisionAuditEvent.length, auditsBefore);
});

test("test #6: ADMIN ei näe kellegi eeskambrit ega saa seda loendada (404, EI möödu)", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const created = await createPrivateItem(
    { processId, session: os1(), input: { kind: "PREP_TOPIC", body: "x" } }, { db }
  );
  const admin = adminSession("admin1");
  await assert.rejects(() => listPrivateItems({ processId, session: admin }, { db }), (e) => e.status === 404);
  await assert.rejects(
    () => updatePrivateItem({ itemId: created.item.id, session: admin, input: { body: "häkk", expectedVersion: 0 } }, { db }),
    (e) => e.status === 404
  );
  await assert.rejects(
    () => deletePrivateItem({ itemId: created.item.id, session: admin }, { db }),
    (e) => e.status === 404
  );
});

test("eeskambri kirje: omanik muudab CAS-iga ja kustutab; võõras → 404", async () => {
  const db = setupBase();
  const { processId } = await makeActiveProcess(db);
  const created = await createPrivateItem(
    { processId, session: os1(), input: { kind: "PREP_TOPIC", body: "v0" } }, { db }
  );
  const itemId = created.item.id;

  await assert.rejects(
    () => updatePrivateItem({ itemId, session: os1(), input: { body: "v1", expectedVersion: 99 } }, { db }),
    (e) => e.status === 409
  );
  const upd = await updatePrivateItem({ itemId, session: os1(), input: { body: "v1", expectedVersion: 0 } }, { db });
  assert.equal(upd.item.body, "v1");
  assert.equal(upd.item.version, 1);

  // võõras (SV) ei saa os1 kirjet muuta ega kustutada
  await assert.rejects(
    () => updatePrivateItem({ itemId, session: sv(), input: { body: "x", expectedVersion: 1 } }, { db }),
    (e) => e.status === 404
  );
  await assert.rejects(() => deletePrivateItem({ itemId, session: sv() }, { db }), (e) => e.status === 404);

  const del = await deletePrivateItem({ itemId, session: os1() }, { db });
  assert.equal(del.deleted, true);
  assert.equal(db.store.supervisionPrivateItem.length, 0);
});

test("invariant: jagatud vaated (service/serializers/topics/meetings/summaries) EI impordi serializersPrivate.js-i", () => {
  const root = path.resolve("lib/supervision");
  const sharedFiles = fs.readdirSync(root).filter((f) => {
    return f.endsWith(".js")
      && !["serializersPrivate.js", "privateItems.js", "closure.js", "outcomes.js"].includes(f);
  });
  // Match a real import/require specifier, not a comment mention.
  const importRe = /(?:from|require\()\s*["'][^"']*serializersPrivate/;
  for (const file of sharedFiles) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!importRe.test(src), `${file} ei tohi importida serializersPrivate.js-i`);
  }
});
