import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { OWN_NAME_MAX, getOwnName, saveOwnName } from "../lib/homeCare/ownName.js";

const ENV = { ORG_WORKSPACE_ENABLED: "1", HOME_CARE_ENABLED: "1" };

function context({ module = true } = {}) {
  return {
    organization: { id: "org-1" },
    membership: { id: "m-1" },
    activeModules: module ? ["HOME_CARE"] : [],
    capabilities: []
  };
}

function fakeDb({ profile = null, membership = { userId: "u-1" } } = {}) {
  const state = { lookups: [], upserts: [] };
  return {
    state,
    organizationMembership: {
      findFirst: async (args) => {
        state.lookups.push(args.where);
        return membership ? { ...membership, user: { profile } } : null;
      }
    },
    profile: {
      upsert: async (args) => {
        state.upserts.push(args);
        return { firstName: args.update.firstName, lastName: args.update.lastName };
      }
    }
  };
}

test("nimeta inimese nimi on poolik, nimega inimese oma täielik", async () => {
  assert.deepEqual(await getOwnName(context(), { db: fakeDb(), env: ENV }), { firstName: "", lastName: "", complete: false });
  assert.deepEqual(await getOwnName(context(), { db: fakeDb({ profile: { firstName: "Mari", lastName: null } }), env: ENV }), {
    firstName: "Mari",
    lastName: "",
    complete: false
  });
  assert.equal((await getOwnName(context(), { db: fakeDb({ profile: { firstName: "Mari", lastName: "Maasikas" } }), env: ENV })).complete, true);
});

test("inimene salvestab OMA nime: rida leitakse sessiooni liikmesuse järgi", async () => {
  const db = fakeDb();
  const saved = await saveOwnName(context(), { firstName: "  Mari-Liis ", lastName: "  O’Brien   Tamm ", userId: "keegi-teine" }, { db, env: ENV });

  assert.deepEqual(saved, { firstName: "Mari-Liis", lastName: "O’Brien Tamm", complete: true });
  assert.deepEqual(db.state.lookups, [{ id: "m-1", organizationId: "org-1" }]);
  const write = db.state.upserts[0];
  assert.deepEqual(write.where, { userId: "u-1" }, "kehas antud võõras kasutaja ei loe");
  assert.deepEqual(write.create, { userId: "u-1", firstName: "Mari-Liis", lastName: "O’Brien Tamm" });
  assert.deepEqual(write.update, { firstName: "Mari-Liis", lastName: "O’Brien Tamm" });
});

test("mõlemad nimeosad on vajalikud ja kuju peab olema nime oma", async () => {
  const reject = async (input, key) => {
    const db = fakeDb();
    await assert.rejects(saveOwnName(context(), input, { db, env: ENV }), (error) => error?.messageKey === key || error?.message === key);
    assert.equal(db.state.upserts.length, 0, "vigane nimi ei jõua andmebaasi");
  };
  await reject({ firstName: "", lastName: "Maasikas" }, "home_care.errors.own_name_first");
  await reject({ firstName: "Mari", lastName: "   " }, "home_care.errors.own_name_last");
  await reject({ firstName: "Mari2", lastName: "Maasikas" }, "home_care.errors.own_name_first");
  await reject({ firstName: "<b>Mari</b>", lastName: "Maasikas" }, "home_care.errors.own_name_first");
  await reject({ firstName: "-Mari", lastName: "Maasikas" }, "home_care.errors.own_name_first");
  await reject({ firstName: "Mari", lastName: "a".repeat(OWN_NAME_MAX + 1) }, "home_care.errors.own_name_last");
  await reject({ firstName: 42, lastName: "Maasikas" }, "home_care.errors.own_name_first");
});

test("ilma koduteenuse moodulita nime ei loeta ega kirjutata", async () => {
  const db = fakeDb();
  await assert.rejects(getOwnName(context({ module: false }), { db, env: ENV }));
  await assert.rejects(saveOwnName(context({ module: false }), { firstName: "Mari", lastName: "Maasikas" }, { db, env: ENV }));
  assert.equal(db.state.lookups.length, 0);
});

test("kui liikmesust ei leita, midagi ei kirjutata", async () => {
  const db = fakeDb({ membership: null });
  await assert.rejects(saveOwnName(context(), { firstName: "Mari", lastName: "Maasikas" }, { db, env: ENV }));
  assert.equal(db.state.upserts.length, 0);
});

test("nimevormi tekstid on olemas kõigis kolmes keeles", () => {
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of ["missing", "edit_hint", "first", "last", "save", "cancel", "line", "change"]) {
      assert.equal(typeof messages.home_care.own_name[key], "string", `${locale}: puudub home_care.own_name.${key}`);
    }
    for (const key of ["own_name_first", "own_name_last"]) {
      assert.equal(typeof messages.home_care.errors[key], "string", `${locale}: puudub home_care.errors.${key}`);
    }
  }
});
