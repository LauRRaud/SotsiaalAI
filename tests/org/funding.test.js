import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS,
  INBOX_STATUS_TRANSITIONS,
  LIVE_WORK_ASSIGNMENT_STATUSES,
  ORGANIZATION_SEAT_ROLES,
  SEAT_ROLE_REFERENCE_PRICE_CENTS,
  canTransitionInboxStatus,
  priceDiffersFromReference
} from "../../lib/org/constants.js";
import {
  DEFAULT_CLIENT_AMOUNT,
  DEFAULT_SERVICE_PROVIDER_AMOUNT,
  DEFAULT_SOCIAL_WORKER_AMOUNT
} from "../../lib/subscriptionPlans.js";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "prisma", "migrations", "20260801120000_org_funding_inbox_v1", "migration.sql"),
  "utf8"
);

/* -------------------------------------------------------------------------
   D5/D6: hind, roll ja maksja on ERI TELJED.
   ------------------------------------------------------------------------- */


/**
 * Skeemi KOOD ilma kommentaarideta.
 *
 * MIKS: allolevad testid otsivad keelatud mudelinimesid. Ilma selleta kukuks
 * test kommentaari peale, mis SELGITAB, et viidet ei ole („ei viita
 * `WellbeingRecord`-ile") — ehk just seal, kus invariant on kõige selgemini
 * kirja pandud. Kontrollida tuleb koodi, mitte proosat.
 */
function schemaCodeOnly(source) {
  /* `[^\n]*`, MITTE `.*$`: fail on CRLF ja JS-regexis on `\r` REAVAHETUS —
     `.` ei sobita teda ning `$` (ilma `m`-ita) nõuab stringi lõppu, seega
     `//.*$` ei sobitunud ÜHTEGI rida ja kommentaarid jäid alles. */
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, "");
}

const SCHEMA_CODE = schemaCodeOnly(SCHEMA);

/**
 * Viil B mudeliplokid NIMELISELT — vt sama parandust `contracts.test.js`-is
 * (06.08). Vana `slice(indexOf(...))` võttis kaasa faili lõpuni KÕIK mudelid,
 * seega keeld kehtis ainult seni, kuni viil B juhtus olema faili lõpus.
 */
function organizationModelCode(source, fromModelName) {
  const blocks = [...source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/gu)];
  const start = blocks.findIndex((block) => block[1] === fromModelName);
  assert.notEqual(start, -1, `model ${fromModelName} must exist in the schema`);
  return blocks
    .slice(start)
    .filter((block) => block[1].startsWith("Organization"))
    .map((block) => `model ${block[1]} {${block[2]}\n}`)
    .join("\n");
}

test("seat reference prices are exactly the platform's role prices — one pricing truth", () => {
  assert.equal(SEAT_ROLE_REFERENCE_PRICE_CENTS.SOCIAL_WORKER, Math.round(DEFAULT_SOCIAL_WORKER_AMOUNT * 100));
  assert.equal(
    SEAT_ROLE_REFERENCE_PRICE_CENTS.SERVICE_PROVIDER,
    Math.round(DEFAULT_SERVICE_PROVIDER_AMOUNT * 100)
  );
  assert.equal(CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS, Math.round(DEFAULT_CLIENT_AMOUNT * 100));
});

test("the three default prices are 14.99 / 19.99 / 7.99", () => {
  assert.equal(SEAT_ROLE_REFERENCE_PRICE_CENTS.SOCIAL_WORKER, 1499);
  assert.equal(SEAT_ROLE_REFERENCE_PRICE_CENTS.SERVICE_PROVIDER, 1999);
  assert.equal(CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS, 799);
});

/* O-E0-1: pöörduja ei ole koharoll. Testime seda KOLMEL tasandil. */

test("a client seat does not exist — not in the constant, not in the schema enum", () => {
  assert.equal(ORGANIZATION_SEAT_ROLES.includes("CLIENT"), false);
  assert.equal(SEAT_ROLE_REFERENCE_PRICE_CENTS.CLIENT, undefined);

  const seatPlan = SCHEMA.match(/model OrganizationSeatPlan \{([\s\S]*?)\n\}/u)[1];
  assert.match(seatPlan, /seatRole\s+OrganizationSeatRole/u);
  assert.equal(seatPlan.includes("CLIENT"), false);
});

test("client sponsorship is a separate model that never touches seats or membership", () => {
  const model = SCHEMA.match(/model OrganizationClientSponsorship \{([\s\S]*?)\n\}/u)[1];
  assert.equal(model.includes("OrganizationSeatPlan"), false);
  assert.equal(model.includes("OrganizationSeatAssignment"), false);
  assert.equal(model.includes("OrganizationMembership"), false);
  assert.equal(model.includes("seatRole"), false);
});

/* O-E0-1: sponsorlus ei tohi nõuda ruumi. */

test("the sponsorship rail carries no room reference at all", () => {
  const model = SCHEMA.match(/model OrganizationClientSponsorship \{([\s\S]*?)\n\}/u)[1];
  assert.equal(/roomId/u.test(model), false, "sponsorship must not be room-bound");
  assert.equal(/Room/u.test(model), false);
});

test("the pre-existing room invite is left untouched — roomId is still required", () => {
  const invite = SCHEMA.match(/model Invite \{([\s\S]*?)\n\}/u)[1];
  // `String` ilma `?`-ta = NOT NULL. Just see sunnib org-sponsorluse eraldi rajale.
  assert.match(invite, /roomId\s+String(?!\?)/u, "Invite.roomId must stay NOT NULL");
  assert.match(invite, /room\s+Room\s+@relation/u);
});

test("a discount without a stated reason is impossible", () => {
  assert.equal(priceDiffersFromReference("SOCIAL_WORKER", 1499), false);
  assert.equal(priceDiffersFromReference("SOCIAL_WORKER", 999), true);
  assert.equal(priceDiffersFromReference("SERVICE_PROVIDER", 1999), false);
  assert.equal(priceDiffersFromReference("SERVICE_PROVIDER", 0), true);
});

/* -------------------------------------------------------------------------
   Migratsiooni invariandid.
   ------------------------------------------------------------------------- */

test("the migration only adds nullable columns to pre-existing tables", () => {
  const alters = MIGRATION.split("\n").filter((line) => line.trim().startsWith("ALTER TABLE"));
  const touched = alters.filter(
    (line) => line.includes('"Subscription"') || line.includes('"PreInquiry"')
  );
  assert.ok(touched.length > 0, "viil B does touch these two tables");
  for (const line of touched) {
    const isAddColumn = line.includes("ADD COLUMN");
    const isAddConstraint = line.includes("ADD CONSTRAINT");
    assert.ok(isAddColumn || isAddConstraint, `unexpected alteration: ${line}`);
    assert.equal(line.includes("DROP"), false, `viil B must never drop: ${line}`);
    assert.equal(line.includes("NOT NULL"), false, `new columns must be nullable: ${line}`);
  }
});

test("no pre-existing row is rewritten — the migration contains no UPDATE or DELETE", () => {
  assert.equal(/^\s*UPDATE\s/mu.test(MIGRATION), false);
  assert.equal(/^\s*DELETE\s+FROM/mu.test(MIGRATION), false);
});

test("seat limits are enforced by a partial unique index, not only by service code", () => {
  assert.match(MIGRATION, /OrganizationSeatAssignment_active_membership_uniq[\s\S]*?WHERE "status" = 'ACTIVE'/u);
  assert.match(MIGRATION, /OrganizationSeatPlan_active_org_role_uniq[\s\S]*?WHERE "status" = 'ACTIVE'/u);
});

test("one live work assignment per inbox item is a database rule", () => {
  assert.match(
    MIGRATION,
    /OrganizationWorkAssignment_live_inbox_uniq[\s\S]*?WHERE "status" IN \('PENDING', 'ACCEPTED'\)/u
  );
});

test("negative money is impossible", () => {
  assert.match(MIGRATION, /OrganizationSeatPlan_amounts_chk[\s\S]*?"seatLimit" >= 0 AND "unitPriceCents" >= 0/u);
  assert.match(MIGRATION, /OrgClientSponsorship_price_chk[\s\S]*?"unitPriceCents" >= 0/u);
});

test("the rollback note admits that enum values cannot be removed", () => {
  assert.match(MIGRATION, /SPONSORED_BY_ORGANIZATION[\s\S]*?ORGANIZATION_INBOX[\s\S]*?JÄÄVAD/u);
});

/* -------------------------------------------------------------------------
   Postkasti seisumasin.
   ------------------------------------------------------------------------- */

test("closed, rejected and recalled are terminal", () => {
  for (const terminal of ["CLOSED", "REJECTED", "RECALLED"]) {
    assert.deepEqual([...INBOX_STATUS_TRANSITIONS[terminal]], [], `${terminal} must be terminal`);
  }
});

/**
 * Tagasivõtmine on saatja õigus ja ainult ENNE avamist (arenduskava §5.7).
 * Seepärast on `RECALLED` kättesaadav varastest seisudest, aga MITTE siis, kui
 * töötaja on töö juba vastu võtnud — siis on parandusjälg, mitte kadumine.
 * Lisaks keelab teenusekiht organisatsioonil selle siirde valimise üldse
 * (`transitionInboxItem` → `org.errors.inbox_recall_is_sender_right`).
 */
test("recall is reachable while the work is untouched, but not after acceptance", () => {
  for (const from of ["RECEIVED", "REVIEWING", "ASSIGNMENT_PENDING", "ASSIGNED"]) {
    assert.equal(canTransitionInboxStatus(from, "RECALLED"), true, `${from} should allow recall`);
  }
  assert.equal(
    canTransitionInboxStatus("ACCEPTED", "RECALLED"),
    false,
    "accepted work cannot silently vanish"
  );
});

test("work cannot be accepted before it is assigned", () => {
  assert.equal(canTransitionInboxStatus("RECEIVED", "ACCEPTED"), false);
  assert.equal(canTransitionInboxStatus("ASSIGNED", "ACCEPTED"), true);
});

test("only PENDING and ACCEPTED count as live work", () => {
  assert.deepEqual([...LIVE_WORK_ASSIGNMENT_STATUSES], ["PENDING", "ACCEPTED"]);
  for (const dead of ["REJECTED", "HANDED_OVER", "ENDED"]) {
    assert.equal(LIVE_WORK_ASSIGNMENT_STATUSES.includes(dead), false);
  }
});

/* -------------------------------------------------------------------------
   §4 kõvad keelud kehtivad ka viilus B.
   ------------------------------------------------------------------------- */

test("no viil B model references a private object", () => {
  /* Nihe TULEB arvutada samast stringist, mida lõigatakse — kommentaaride
     eemaldamine muudab pikkused ja segamini nihe lõikaks vale koha. */
  const block = organizationModelCode(SCHEMA_CODE, "OrganizationSeatPlan");
  for (const forbidden of [
    "WellbeingRecord",
    "WellbeingOutputDraft",
    "Conversation",
    "UserDocument",
    "PracticeReflection",
    "SupervisionProcess",
    "MentoringRelation",
    "CovisionCase"
  ]) {
    assert.equal(block.includes(forbidden), false, `viil B must not reference ${forbidden}`);
  }
});

test("the inbox item stores a reference, never the source content", () => {
  const model = SCHEMA.match(/model OrganizationInboxItem \{([\s\S]*?)\n\}/u)[1];
  for (const contentField of ["situation", "generatedDraft", "userEditedDraft", "assessmentState", "topic"]) {
    assert.equal(model.includes(contentField), false, `inbox item must not copy ${contentField}`);
  }
  assert.match(model, /sourceId\s+String/u);
});

test("the journey is never an inbox source — there is no share-whole-journey path", () => {
  const model = SCHEMA.match(/model OrganizationInboxItem \{([\s\S]*?)\n\}/u)[1];
  assert.equal(model.includes("Journey"), false);
  const sourceEnum = SCHEMA.match(/enum OrganizationInboxSourceType \{([^}]*)\}/u)[1];
  assert.deepEqual(
    sourceEnum.split("\n").map((line) => line.trim()).filter(Boolean),
    ["PRE_INQUIRY"]
  );
});
