// PROFIIL — inimene paneb oma nime kirja konto seadetes.
//
// Seni sai nime sisestada ainult koduteenuse avalehel või saada kutsega; kes koduteenust ei
// kasuta, ei saanud oma nime platvormil kirja panna ega parandada.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PERSON_NAME_MAX } from "../lib/org/personName.js";
import { profileNameView, saveProfileNameForUser } from "../lib/profile/ownName.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

function fakeDb() {
  const state = { upserts: [] };
  return {
    state,
    profile: {
      upsert: async (args) => {
        state.upserts.push(args);
        return { firstName: args.update.firstName, lastName: args.update.lastName };
      }
    }
  };
}

test("nimi salvestub inimese ENDA profiili puhastatud kujul", async () => {
  const db = fakeDb();
  const result = await saveProfileNameForUser({ db, userId: "u-1", firstName: "  Mari-Liis ", lastName: " O’Brien   Tamm " });
  assert.deepEqual(result, { ok: true, name: { firstName: "Mari-Liis", lastName: "O’Brien Tamm", complete: true } });
  assert.deepEqual(db.state.upserts, [
    {
      where: { userId: "u-1" },
      create: { userId: "u-1", firstName: "Mari-Liis", lastName: "O’Brien Tamm" },
      update: { firstName: "Mari-Liis", lastName: "O’Brien Tamm" },
      select: { firstName: true, lastName: true }
    }
  ]);
});

test("mõlemad nimeosad on vajalikud; vigane nimi ei jõua andmebaasi ja lause saab piiri kaasa", async () => {
  const refuse = async (input, key) => {
    const db = fakeDb();
    const result = await saveProfileNameForUser({ db, userId: "u-1", ...input });
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.deepEqual([result.error.status, result.error.messageKey, result.error.details], [400, key, { limit: PERSON_NAME_MAX }]);
    assert.equal(db.state.upserts.length, 0);
  };
  await refuse({ firstName: "", lastName: "Maasikas" }, "profile.name.error_first");
  await refuse({ firstName: "Mari", lastName: "   " }, "profile.name.error_last");
  await refuse({ firstName: "Mari2", lastName: "Maasikas" }, "profile.name.error_first");
  await refuse({ firstName: "<b>Mari</b>", lastName: "Maasikas" }, "profile.name.error_first");
  await refuse({ firstName: "Mari", lastName: "a".repeat(PERSON_NAME_MAX + 1) }, "profile.name.error_last");
  await refuse({ firstName: 42, lastName: "Maasikas" }, "profile.name.error_first");
  await refuse({ lastName: "Maasikas" }, "profile.name.error_first");
});

test("ilma kasutajata midagi ei kirjutata", async () => {
  for (const userId of ["", "   ", null, undefined]) {
    const db = fakeDb();
    const result = await saveProfileNameForUser({ db, userId, firstName: "Mari", lastName: "Maasikas" });
    assert.deepEqual([result.ok, result.error.status], [false, 401]);
    assert.equal(db.state.upserts.length, 0);
  }
});

test("nimi lehe jaoks: puuduv profiil ja tühikud annavad tühja nime", () => {
  assert.deepEqual(profileNameView(null), { firstName: "", lastName: "", complete: false });
  assert.deepEqual(profileNameView({ firstName: " Mari ", lastName: null }), { firstName: "Mari", lastName: "", complete: false });
  assert.deepEqual(profileNameView({ firstName: "Mari", lastName: "Maasikas" }), { firstName: "Mari", lastName: "Maasikas", complete: true });
});

test("marsruut: nimi tuleb sessiooni kasutajale, mitte päringu kehast; e-posti ja PIN-i rada jääb puutumata", () => {
  const route = read("../app/api/profile/name/route.js");
  assert.match(route, /getServerSession\(authConfig\)/);
  assert.match(route, /saveProfileNameForUser\(\{\s*db: prisma,\s*userId,/);
  assert.doesNotMatch(route, /body\?\.userId|body\.userId/, "kasutajat ei loeta päringu kehast");
  assert.doesNotMatch(route, /updateProfileForUser|currentPassword/);
  /* Profiili lugemine annab nime kaasa. */
  const profile = read("../app/api/profile/route.js");
  assert.match(profile, /profile: \{ select: \{ firstName: true, lastName: true \} \}/);
  assert.match(profile, /firstName: name\.firstName,\s*lastName: name\.lastName/);
});

test("vorm on konto seadete mõlemas vaates ja tekstid on kolmes keeles", () => {
  const page = read("../components/alalehed/ProfiilBody.jsx");
  assert.equal([...page.matchAll(/<ProfileNameForm\b/g)].length, 2, "rida konto lehel ja sama rida hüpikaknas");
  const form = read("../components/profile/ProfileNameForm.jsx");
  assert.match(form, /fetch\("\/api\/profile\/name", \{\s*method: "PUT"/);
  assert.match(form, /disabled=\{disabled \|\| busy \|\| !dirty \|\| !complete\}/);
  /* Poole nimega on nupp kinni ja rida ütleb, miks. */
  assert.match(form, /dirty && !complete \?[\s\S]*profile\.name\.incomplete/);
  for (const locale of ["et", "en", "ru"]) {
    const name = JSON.parse(read(`../messages/${locale}.json`)).profile.name;
    for (const key of ["hint", "first", "last", "save", "saved", "incomplete", "save_failed"]) assert.equal(typeof name[key], "string", `${locale} profile.name.${key}`);
    for (const key of ["error_first", "error_last"]) assert.match(name[key], /\{limit\}/, `${locale} profile.name.${key}`);
  }
});
