import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_SNAPSHOT_FIELDS,
  sanitizeSnapshot,
  toRecipientView
} from "../../lib/org/supportShare.js";
import {
  EXPORT_EXCLUSIONS,
  FORBIDDEN_EXPORT_KEYS,
  assertExportIsClean
} from "../../lib/org/export.js";
import { toPublicProfileProjection } from "../../lib/org/serviceProfile.js";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "prisma", "migrations", "20260802090000_org_profile_support_v1", "migration.sql"),
  "utf8"
);

function schemaCodeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, "");
}
const SCHEMA_CODE = schemaCodeOnly(SCHEMA);

/* -------------------------------------------------------------------------
   §D8 — lähtekirje ei muutu organisatsiooni varaks.
   ------------------------------------------------------------------------- */

test("WellbeingRecord still has no organisation key after viil C", () => {
  const model = SCHEMA_CODE.match(/model WellbeingRecord \{([\s\S]*?)\n\}/u)[1];
  assert.equal(model.includes("organizationId"), false);
  assert.equal(model.includes("Organization"), false);
  assert.equal(model.includes("SupportShare"), false);
});

test("the support share has no foreign key into wellbeing tables", () => {
  const model = SCHEMA_CODE.match(/model WellbeingSupportShare \{([\s\S]*?)\n\}/u)[1];
  // Viide on olemas, aga AINULT stringina — ilma @relation-ita.
  assert.match(model, /sourceRecordId\s+String\?/u);
  assert.match(model, /sourceDraftId\s+String\?/u);
  assert.equal(/WellbeingRecord/u.test(model), false);
  assert.equal(/WellbeingOutputDraft/u.test(model), false);
});

test("the snapshot whitelist is short and contains no scoring field", () => {
  assert.deepEqual([...ALLOWED_SNAPSHOT_FIELDS], [
    "summary",
    "needs",
    "proposedAgreements",
    "supportRequested",
    "periodLabel"
  ]);
  for (const scoring of ["computedSignal", "riskMarkers", "loadFactors", "standardizedFields", "scoringVersion"]) {
    assert.equal(ALLOWED_SNAPSHOT_FIELDS.includes(scoring), false, `${scoring} must never be shareable`);
  }
});

test("sanitizeSnapshot drops everything outside the whitelist", () => {
  const clean = sanitizeSnapshot({
    summary: "Vajan tuge",
    computedSignal: { red: 3 },
    riskMarkers: ["burnout"],
    secretField: "x"
  });
  assert.deepEqual(Object.keys(clean), ["summary"]);
});

test("sanitizeSnapshot refuses empty or non-object input", () => {
  for (const bad of [null, undefined, "text", [], {}, { unknown: "x" }]) {
    assert.throws(() => sanitizeSnapshot(bad), (error) => {
      assert.equal(error.status, 400);
      return true;
    });
  }
});

test("the recipient view exposes no route back to the source record", () => {
  const view = toRecipientView({
    id: "s1",
    status: "SENT",
    sentAt: new Date(),
    openedAt: null,
    correctedAt: null,
    closedAt: null,
    sharedSnapshotJson: { summary: "x" },
    snapshotSchemaVersion: "1.0",
    supersedesShareId: null,
    // Saatja NIMI tohib läbi tulla — vt järgmine test.
    owner: { email: "saatja@example.invalid", profile: { firstName: "Mari", lastName: "Maasikas" } },
    // Need EI TOHI läbi tulla:
    ownerUserId: "user_owner",
    sourceRecordId: "wb_1",
    sourceDraftId: "draft_1",
    supportContactId: "c1",
    organizationId: "org_1",
    recipientMembershipId: "mem_1"
  });
  const keys = Object.keys(view).sort();
  assert.deepEqual(keys, [
    "closedAt",
    "correctedAt",
    "id",
    "isCorrection",
    "openedAt",
    "sender",
    "sentAt",
    "snapshot",
    "snapshotSchemaVersion",
    "status"
  ]);
  const blob = JSON.stringify(view);
  for (const leak of ["wb_1", "draft_1", "user_owner", "mem_1", "c1", "org_1"]) {
    assert.equal(blob.includes(leak), false, `recipient view leaks ${leak}`);
  }
});

/*
 * Saatja identiteet ja saatja VÕTI on eri asjad. Nime nägemine on saaja jaoks
 * eeldus, et üldse vastata saaks; `ownerUserId` oleks aga võti kasutaja teiste
 * objektideni. Need kaks testi hoiavad seda piiri kummaltki poolt.
 */
test("the recipient learns who sent it — by name, never by user id", () => {
  const named = toRecipientView({
    id: "s1",
    sharedSnapshotJson: { summary: "x" },
    ownerUserId: "user_owner",
    owner: { email: "saatja@example.invalid", profile: { firstName: "Mari", lastName: "Maasikas" } }
  });
  assert.deepEqual(named.sender, { firstName: "Mari", lastName: "Maasikas", email: null });
  assert.equal(JSON.stringify(named).includes("user_owner"), false);
  // Nimega saatja e-posti me kaasa ei anna — tuvastamiseks piisab nimest.
  assert.equal(named.sender.email, null);
});

test("a nameless sender is identified by email, so the request is never anonymous", () => {
  const nameless = toRecipientView({
    id: "s1",
    sharedSnapshotJson: { summary: "x" },
    ownerUserId: "user_owner",
    owner: { email: "saatja@example.invalid", profile: null }
  });
  assert.equal(nameless.sender.email, "saatja@example.invalid");
  assert.equal(JSON.stringify(nameless).includes("user_owner"), false);
});

/* -------------------------------------------------------------------------
   E8 — omandirežiim.
   ------------------------------------------------------------------------- */

test("the migration replaces the global owner unique with a partial one", () => {
  assert.match(MIGRATION, /DROP INDEX "ServiceProviderProfile_ownerId_key"/u);
  assert.match(
    MIGRATION,
    /ServiceProviderProfile_solo_owner_uniq[\s\S]*?WHERE "ownershipMode" = 'SOLO' AND "ownerId" IS NOT NULL/u
  );
});

test("account deletion no longer destroys the profile", () => {
  assert.match(
    MIGRATION,
    /ServiceProviderProfile_ownerId_fkey" FOREIGN KEY \("ownerId"\) REFERENCES "User"\("id"\) ON DELETE SET NULL/u
  );
  assert.equal(
    /ServiceProviderProfile_ownerId_fkey"[^\n]*ON DELETE CASCADE/u.test(MIGRATION),
    false,
    "the owner relation must not be Cascade any more"
  );
});

test("the ownership mode is guarded by a CHECK, not only by service code", () => {
  assert.match(MIGRATION, /ServiceProviderProfile_ownership_chk/u);
  assert.match(MIGRATION, /"ownershipMode" = 'ORGANIZATION' AND "organizationId" IS NOT NULL/u);
});

test("the migration destroys no data", () => {
  assert.equal(/^\s*DELETE\s+FROM/mu.test(MIGRATION), false);
  assert.equal(/DROP TABLE/u.test(MIGRATION.split("OSA 3")[0]), false);
  assert.match(MIGRATION, /"ownershipMode" "ServiceProviderOwnershipMode" NOT NULL DEFAULT 'SOLO'/u);
});

test("the rollback section states ALL THREE mandatory gates, not just the org count", () => {
  /* Varem kontrollis see test ainult ORGANIZATION-loendust — sama auk, mis oli
     migratsioonis endas. `SET NOT NULL` kukub `ownerId IS NULL` ridade peal ja
     täielik unikaalindeks põrkab topeltomanikel; mõlemad tekivad tavakasutuses. */
  assert.match(MIGRATION, /ownershipMode" = 'ORGANIZATION'/u);
  assert.match(MIGRATION, /"ownerId" IS NULL/u);
  assert.match(MIGRATION, /HAVING count\(\*\) > 1/u);
});

test("the rollback gate is RUNNABLE, not just a comment", () => {
  // Kommentaari ei jookse keegi. Migratsioon peab viitama skriptile ja skript
  // peab olemas olema.
  assert.match(MIGRATION, /org-profile-support-preflight\.mjs/u);
  const preflight = fs.readFileSync(path.join(process.cwd(), "scripts", "org-profile-support-preflight.mjs"), "utf8");
  // Kolm väravat ka skriptis, mitte ainult kommentaaris.
  assert.match(preflight, /ownershipMode: "ORGANIZATION"/u);
  assert.match(preflight, /ownerId: null/u);
  assert.match(preflight, /_count: \{ gt: 1 \}/u);
  // Ohtlik tulemus peab andma nullist erineva väljundkoodi.
  assert.match(preflight, /process\.exit\(code\)/u);
});

test("the rollback runbook exists and names what rollback does NOT restore", () => {
  const runbook = fs.readFileSync(path.join(process.cwd(), "ops", "runbooks", "org-profile-support-rollback.md"), "utf8");
  assert.match(runbook, /WellbeingSupportShare/u);
  assert.match(runbook, /varukoopia/iu);
});

test("the public profile projection hides ownership and organisation", () => {
  const projection = toPublicProfileProjection({
    id: "p1",
    organizationName: "X",
    ownershipMode: "ORGANIZATION",
    organizationId: "org_1",
    ownerId: "user_1",
    publicSlug: "x"
  });
  assert.equal("ownershipMode" in projection, false);
  assert.equal("organizationId" in projection, false);
  assert.equal("ownerId" in projection, false);
  assert.equal(projection.publicSlug, "x");
});

/* -------------------------------------------------------------------------
   E10 — eksport.
   ------------------------------------------------------------------------- */

test("the export guard names every field that would be a leak", () => {
  for (const key of [
    "sharedSnapshotJson",
    "sourceDraftId",
    "sourceRecordId",
    "situation",
    "computedSignal",
    "tokenHash",
    "passwordHash"
  ]) {
    assert.ok(FORBIDDEN_EXPORT_KEYS.includes(key), `${key} must be guarded`);
  }
});

test("the export guard rejects a payload that carries a snapshot", () => {
  assert.throws(
    () => assertExportIsClean({ shares: [{ sharedSnapshotJson: { summary: "x" } }] }),
    (error) => {
      assert.equal(error.code, "ORG_EXPORT_LEAK");
      return true;
    }
  );
});

test("the export guard rejects a payload that carries inquiry content", () => {
  assert.throws(() => assertExportIsClean({ items: [{ situation: "midagi" }] }), (error) => {
    assert.equal(error.code, "ORG_EXPORT_LEAK");
    return true;
  });
});

test("a clean administrative payload passes the guard", () => {
  assert.doesNotThrow(() =>
    assertExportIsClean({
      organization: { id: "o1", displayName: "X" },
      memberships: [{ id: "m1", seatRole: "SOCIAL_WORKER" }],
      inboxItems: [{ id: "i1", status: "RECEIVED", sourceId: "pi_1" }]
    })
  );
});

test("the exclusion list names the private classes explicitly", () => {
  for (const excluded of [
    "wellbeing_support_share_snapshots",
    "wellbeing_records",
    "pre_inquiry_content",
    "conversations",
    "user_gdpr_copies",
    "usage_metrics"
  ]) {
    assert.ok(EXPORT_EXCLUSIONS.includes(excluded), `${excluded} must be declared as excluded`);
  }
});
