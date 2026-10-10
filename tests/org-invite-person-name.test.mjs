// ORGANISATSIOONI KUTSE — nimi kutsega.
//
// Kutsuja saab kutsele kaasa panna inimese nime. Liitumisel täidab see profiili AINULT siis,
// kui inimesel endal nime ei ole; suletud kutselt nimi kustutatakse.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { acceptInvite, createInvite, declineInvite, revokeInvite } from "../lib/org/inviteService.js";
import { createInviteToken, toInvitePreview } from "../lib/org/invites.js";
import { PERSON_NAME_MAX, cleanPersonName, hasPersonName } from "../lib/org/personName.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

/* Võltsandmebaas: vastab neile päringutele, mida kutse loomine ja sulgemine teevad; ülejäänud
   (auditirida, õiguste read) saavad tühja vastuse. */
function fakeDb({ invite = null, profile = null } = {}) {
  const state = { created: null, claims: [], profileWrites: [], profileReads: 0 };
  const handlers = {
    organization: { findUnique: async () => ({ id: "org-1", status: "ACTIVE" }) },
    organizationMembership: { findFirst: async () => null, create: async ({ data }) => ({ id: "m-1", ...data }) },
    organizationInvite: {
      findFirst: async () => (invite ? { id: invite.id, status: invite.status, email: invite.email } : null),
      findUnique: async () => invite,
      create: async ({ data }) => {
        state.created = data;
        return { id: "inv-1", ...data };
      },
      updateMany: async ({ data }) => {
        state.claims.push(data);
        return { count: 1 };
      }
    },
    profile: {
      findUnique: async () => {
        state.profileReads += 1;
        return profile;
      },
      upsert: async (args) => {
        state.profileWrites.push(args);
        return args.update;
      }
    }
  };
  const tx = new Proxy(
    {},
    {
      get: (_, model) =>
        new Proxy({}, { get: (__, method) => async (args) => (handlers[model]?.[method] ? handlers[model][method](args) : { id: "x" }) })
    }
  );
  return { state, $transaction: async (fn) => fn(tx) };
}

const INPUT = { actorUserId: "u-1", email: "uus.tootaja@example.test", seatRole: "SOCIAL_WORKER", capabilityTemplate: "MEMBER" };
const NOW = new Date("2026-10-11T08:00:00Z");
const pending = (patch = {}) => ({
  id: "inv-1",
  organizationId: "org-1",
  email: "uus.tootaja@example.test",
  status: "PENDING",
  seatRole: "SOCIAL_WORKER",
  capabilityTemplate: "MEMBER",
  jobTitle: null,
  firstName: "Mari",
  lastName: "Maasikas",
  primaryUnitId: null,
  expiresAt: new Date("2026-10-20T08:00:00Z"),
  organization: { id: "org-1", status: "ACTIVE" },
  ...patch
});
const WHO = { userId: "u-9", userEmail: "uus.tootaja@example.test" };

test("nimeosa reegel: tähed, tühik, sidekriips, ülakoma ja punkt; piir kehtib", () => {
  assert.equal(cleanPersonName("  Mari-Liis  "), "Mari-Liis");
  assert.equal(cleanPersonName("O’Brien   Tamm"), "O’Brien Tamm");
  assert.equal(cleanPersonName("J. K."), "J. K.");
  for (const bad of ["", "   ", "Mari2", "<b>Mari</b>", "-Mari", "a".repeat(PERSON_NAME_MAX + 1), 42, null, undefined]) {
    assert.equal(cleanPersonName(bad), null, JSON.stringify(bad));
  }
  assert.equal(hasPersonName(null), false);
  assert.equal(hasPersonName({ firstName: "  ", lastName: null }), false);
  assert.equal(hasPersonName({ firstName: "Mari", lastName: null }), true);
  assert.equal(hasPersonName({ firstName: null, lastName: "Maasikas" }), true);
});

test("kutse kannab nime puhastatud kujul; nimeta kutse jääb nimeta", async () => {
  const db = fakeDb();
  await createInvite("org-1", { ...INPUT, firstName: "  Mari-Liis ", lastName: " O’Brien   Tamm " }, { db });
  assert.deepEqual([db.state.created.firstName, db.state.created.lastName], ["Mari-Liis", "O’Brien Tamm"]);

  for (const empty of [{}, { firstName: "", lastName: "" }, { firstName: "   ", lastName: null }]) {
    const plain = fakeDb();
    await createInvite("org-1", { ...INPUT, ...empty }, { db: plain });
    assert.deepEqual([plain.state.created.firstName, plain.state.created.lastName], [null, null], JSON.stringify(empty));
  }
});

test("pool nime või nimeks mittesobiv tekst lükatakse tagasi enne andmebaasi", async () => {
  const reject = async (name, key) => {
    const db = fakeDb();
    await assert.rejects(createInvite("org-1", { ...INPUT, ...name }, { db }), (error) => error.status === 400 && error.messageKey === key, JSON.stringify(name));
    assert.equal(db.state.created, null);
  };
  await reject({ firstName: "Mari", lastName: "" }, "org.errors.invite_name_incomplete");
  await reject({ firstName: null, lastName: "Maasikas" }, "org.errors.invite_name_incomplete");
  await reject({ firstName: "Mari2", lastName: "Maasikas" }, "org.errors.invite_name_invalid");
  await reject({ firstName: "Mari", lastName: "a".repeat(PERSON_NAME_MAX + 1) }, "org.errors.invite_name_invalid");
  /* Lause kohatäide saab väärtuse kaasa. */
  await assert.rejects(createInvite("org-1", { ...INPUT, firstName: "<i>", lastName: "x" }, { db: fakeDb() }), (error) => error.details?.limit === PERSON_NAME_MAX);
});

test("liitumisel täidab kutse nimi profiili ainult siis, kui inimesel endal nime ei ole", async () => {
  const token = createInviteToken();
  /* Profiili ei ole või on see nimeta: nimi pannakse kirja. */
  for (const profile of [null, { firstName: null, lastName: null }, { firstName: "  ", lastName: "" }]) {
    const db = fakeDb({ invite: pending(), profile });
    const result = await acceptInvite(token.raw, WHO, { db, now: NOW });
    assert.equal(result.nameApplied, true, JSON.stringify(profile));
    assert.deepEqual(db.state.profileWrites, [
      { where: { userId: "u-9" }, create: { userId: "u-9", firstName: "Mari", lastName: "Maasikas" }, update: { firstName: "Mari", lastName: "Maasikas" } }
    ]);
  }
  /* Inimesel on oma nimi (kas või üks osa): kutse seda üle ei kirjuta. */
  for (const profile of [{ firstName: "Maria", lastName: "Maasik" }, { firstName: "Maria", lastName: null }, { firstName: null, lastName: "Maasik" }]) {
    const db = fakeDb({ invite: pending(), profile });
    const result = await acceptInvite(token.raw, WHO, { db, now: NOW });
    assert.equal(result.nameApplied, false, JSON.stringify(profile));
    assert.deepEqual(db.state.profileWrites, []);
  }
  /* Nimeta kutse ei loe ega kirjuta profiili. */
  const plain = fakeDb({ invite: pending({ firstName: null, lastName: null }), profile: null });
  assert.equal((await acceptInvite(token.raw, WHO, { db: plain, now: NOW })).nameApplied, false);
  assert.deepEqual([plain.state.profileReads, plain.state.profileWrites.length], [0, 0]);
});

test("suletud kutse ei hoia nime: vastuvõtt, keeldumine ja tühistamine kustutavad selle", async () => {
  const token = createInviteToken();
  const accepted = fakeDb({ invite: pending() });
  await acceptInvite(token.raw, WHO, { db: accepted, now: NOW });
  const declined = fakeDb({ invite: pending() });
  await declineInvite(token.raw, WHO, { db: declined, now: NOW });
  const revoked = fakeDb({ invite: pending() });
  await revokeInvite("org-1", "inv-1", { actorUserId: "u-1" }, { db: revoked, now: NOW });
  for (const [db, status] of [[accepted, "ACCEPTED"], [declined, "DECLINED"], [revoked, "REVOKED"]]) {
    assert.equal(db.state.claims.length, 1, status);
    assert.deepEqual([db.state.claims[0].status, db.state.claims[0].firstName, db.state.claims[0].lastName], [status, null, null]);
  }
});

test("eelvaade näitab kutsutule nime, mis talle pakutakse", () => {
  assert.deepEqual(toInvitePreview(pending()).name, { firstName: "Mari", lastName: "Maasikas" });
  assert.equal(toInvitePreview(pending({ firstName: null, lastName: null })).name, null);
});

test("andmebaasi kontroll, vorm ja tekstid", () => {
  const sql = read("../prisma/migrations/20261013190000_org_invite_person_name/migration.sql");
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
  /* Mõlemad osad koos või mitte kumbki; NULL-i juhtum on kirjas otse; piir on sama mis koodis. */
  assert.match(sql, /"firstName" IS NULL AND "lastName" IS NULL/);
  assert.match(sql, /"firstName" IS NOT NULL\s+AND "lastName" IS NOT NULL/);
  assert.equal([...sql.matchAll(new RegExp(`BETWEEN 1 AND ${PERSON_NAME_MAX}\\b`, "g"))].length, 2);

  const form = read("../components/org/OrgInvitesClient.jsx");
  assert.match(form, /firstName: firstName\.trim\(\) \|\| null/);
  assert.match(form, /lastName: lastName\.trim\(\) \|\| null/);
  assert.match(form, /disabled=\{busy \|\| \(templateNeedsUnit && !primaryUnitId\) \|\| nameHalf\}/, "pool nime ei lähe teele");
  assert.match(read("../components/org/OrgJoinClient.jsx"), /t\("org\.invites\.previewName"/);

  for (const locale of ["et", "en", "ru"]) {
    const org = JSON.parse(read(`../messages/${locale}.json`)).org;
    for (const key of ["firstName", "lastName", "nameHint", "previewName"]) assert.equal(typeof org.invites[key], "string", `${locale} invites.${key}`);
    assert.match(org.invites.previewName, /\{name\}/, locale);
    assert.equal(typeof org.errors.invite_name_incomplete, "string", locale);
    assert.match(org.errors.invite_name_invalid, /\{limit\}/, locale);
  }
});
