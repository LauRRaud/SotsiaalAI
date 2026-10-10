import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SETUP_HINT_VIEWER, coordinatorSetupHint } from "../lib/homeCare/setupHint.js";

const NOW = new Date("2026-10-10T18:00:00.000Z");

function fakeDb(count) {
  const calls = [];
  return {
    calls,
    organizationCapabilityGrant: {
      count: async (args) => {
        calls.push(args);
        return count;
      }
    }
  };
}

function context(capabilities = []) {
  return { organization: { id: "org-1" }, capabilities: capabilities.map((capability) => ({ capability })) };
}

test("hooldusjuhita organisatsioonis saab omanik juhise koos teega, teised juhise ilma", async () => {
  const owner = await coordinatorSetupHint(context(["ORG_OWNER", "MEMBER_ADMIN"]), { db: fakeDb(0), now: NOW });
  assert.deepEqual(owner, { viewer: SETUP_HINT_VIEWER.OWNER });

  /* Liikmete haldur näeb küll lehte „Liikmed", aga õigust anda ei saa: tema juhis on sama mis hooldajal. */
  const admin = await coordinatorSetupHint(context(["MEMBER_ADMIN"]), { db: fakeDb(0), now: NOW });
  assert.deepEqual(admin, { viewer: SETUP_HINT_VIEWER.OTHER });

  const worker = await coordinatorSetupHint(context([]), { db: fakeDb(0), now: NOW });
  assert.deepEqual(worker, { viewer: SETUP_HINT_VIEWER.OTHER });
});

test("kui kasvõi üks hooldusjuht on olemas, juhist ei ole", async () => {
  assert.equal(await coordinatorSetupHint(context(["ORG_OWNER"]), { db: fakeDb(1), now: NOW }), null);
});

test("hooldusjuht ise juhist ei saa ja päringut ei tehta", async () => {
  const db = fakeDb(0);
  assert.equal(await coordinatorSetupHint(context(["HOME_CARE_COORDINATOR"]), { db, now: NOW }), null);
  assert.equal(db.calls.length, 0);
});

test("loetakse ainult selle organisatsiooni kehtivaid õigusi aktiivsetel liikmetel", async () => {
  const db = fakeDb(0);
  await coordinatorSetupHint(context(["ORG_OWNER"]), { db, now: NOW });

  const where = db.calls[0].where;
  assert.equal(where.capability, "HOME_CARE_COORDINATOR");
  assert.equal(where.revokedAt, null, "tagasi võetud õigus ei loe");
  assert.deepEqual(where.validFrom, { lte: NOW }, "tulevikus algav õigus ei loe");
  assert.deepEqual(where.OR, [{ validUntil: null }, { validUntil: { gt: NOW } }], "lõppenud õigus ei loe");
  assert.deepEqual(where.membership, { organizationId: "org-1", status: "ACTIVE" }, "peatatud või lõpetatud liige ei loe");
});

test("organisatsioonita kontekst ei küsi midagi", async () => {
  const db = fakeDb(0);
  assert.equal(await coordinatorSetupHint({}, { db, now: NOW }), null);
  assert.equal(db.calls.length, 0);
});

test("juhise laused on olemas kõigis kolmes keeles", () => {
  /* Võti pannakse kokku vaataja järgi, seega staatiline võtmekontroll seda ei näe. */
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const texts = messages.home_care.home.no_coordinator;
    for (const key of [...Object.values(SETUP_HINT_VIEWER), "members_link"]) {
      assert.equal(typeof texts[key], "string", `${locale}: puudub home_care.home.no_coordinator.${key}`);
      assert.ok(texts[key].trim().length > 5, `${locale}: tühi ${key}`);
    }
  }
});
