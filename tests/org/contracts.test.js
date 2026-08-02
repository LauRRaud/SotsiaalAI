import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CAPABILITY_TEMPLATES,
  MAX_UNIT_DEPTH,
  ORGANIZATION_CAPABILITIES,
  ORGANIZATION_LEGAL_KINDS,
  ORGANIZATION_MODULE_KEYS,
  ORGANIZATION_ONLY_CAPABILITIES,
  ORGANIZATION_SEAT_ROLES,
  ORGANIZATION_STATUS_TRANSITIONS,
  RESERVED_ORGANIZATION_CAPABILITIES,
  canTransitionOrganizationStatus,
  requiredModulesForCapability
} from "../../lib/org/constants.js";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "prisma", "migrations", "20260801000000_org_foundation_v1", "migration.sql"),
  "utf8"
);

/* -------------------------------------------------------------------------
   D3: organisatsioonisisene roll EI OLE globaalne kasutajaroll.
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

test("global Role enum stays exactly the four priced product personas", () => {
  const match = SCHEMA.match(/enum Role \{([^}]*)\}/u);
  assert.ok(match, "Role enum must exist");
  const values = match[1].split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(values, ["ADMIN", "SOCIAL_WORKER", "SERVICE_PROVIDER", "CLIENT"]);
});

test("no organisation-internal role leaks into the global Role enum", () => {
  const match = SCHEMA.match(/enum Role \{([^}]*)\}/u);
  const values = match[1];
  for (const forbidden of ["MANAGER", "ORG_ADMIN", "TEAM_LEAD", "ORG_OWNER", "UNIT_LEAD"]) {
    assert.equal(values.includes(forbidden), false, `${forbidden} must not be a global role`);
  }
});

/* -------------------------------------------------------------------------
   D6 / O-E0-1: koharollis ei ole CLIENT-i.
   ------------------------------------------------------------------------- */

test("seat roles are exactly the two worker personas — a client is never a seat", () => {
  assert.deepEqual(ORGANIZATION_SEAT_ROLES, ["SOCIAL_WORKER", "SERVICE_PROVIDER"]);
  assert.equal(ORGANIZATION_SEAT_ROLES.includes("CLIENT"), false);
});

test("the OrganizationSeatRole database enum matches the application constant", () => {
  const match = SCHEMA.match(/enum OrganizationSeatRole \{([^}]*)\}/u);
  assert.ok(match);
  const values = match[1].split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(values, ORGANIZATION_SEAT_ROLES);
  assert.equal(values.includes("CLIENT"), false);
});

/* -------------------------------------------------------------------------
   Capability-kataloog ja moodulid.
   ------------------------------------------------------------------------- */

test("capability catalog matches the schema enum exactly", () => {
  const match = SCHEMA.match(/enum OrganizationCapability \{([^}]*)\}/u);
  const values = match[1].split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(values, ORGANIZATION_CAPABILITIES);
});

test("reserved capabilities are named but deliberately absent from the database enum", () => {
  const match = SCHEMA.match(/enum OrganizationCapability \{([^}]*)\}/u);
  for (const reserved of RESERVED_ORGANIZATION_CAPABILITIES) {
    assert.equal(match[1].includes(reserved), false, `${reserved} must not be in the DB enum yet`);
    assert.equal(ORGANIZATION_CAPABILITIES.includes(reserved), false);
  }
  assert.deepEqual(RESERVED_ORGANIZATION_CAPABILITIES, [
    "AGGREGATE_VIEWER",
    "REPORT_APPROVER",
    "SCHEDULER",
    "ON_CALL_COORDINATOR"
  ]);
});

test("CORE-V1 modules exclude the ones that need their own activation gate", () => {
  assert.deepEqual(ORGANIZATION_MODULE_KEYS, [
    "KOV_INTAKE",
    "SERVICE_DELIVERY",
    "PROFESSIONAL_SUPPORT",
    "ORG_KNOWLEDGE"
  ]);
  const match = SCHEMA.match(/enum OrganizationModuleKey \{([^}]*)\}/u);
  assert.equal(match[1].includes("WELLBEING_AGGREGATE"), false);
  assert.equal(match[1].includes("ON_CALL"), false);
});

test("legal kind is independent of product modules — no exclusive KOV-or-provider choice", () => {
  assert.deepEqual(ORGANIZATION_LEGAL_KINDS, [
    "MUNICIPALITY",
    "PUBLIC_AGENCY",
    "COMPANY",
    "NGO",
    "FOUNDATION",
    "SOLE_PROPRIETOR",
    "OTHER"
  ]);
  // Sama organisatsioon peab saama korraga vastuvõtu JA teenuse osutamise.
  assert.ok(ORGANIZATION_MODULE_KEYS.includes("KOV_INTAKE"));
  assert.ok(ORGANIZATION_MODULE_KEYS.includes("SERVICE_DELIVERY"));
});

test("module-dependent capabilities name their module; admin capabilities need none", () => {
  assert.deepEqual(requiredModulesForCapability("INBOX_COORDINATOR"), ["KOV_INTAKE"]);
  assert.deepEqual(requiredModulesForCapability("WORK_ASSIGNER"), ["KOV_INTAKE"]);
  assert.deepEqual(requiredModulesForCapability("SERVICE_PROFILE_EDITOR"), ["SERVICE_DELIVERY"]);
  assert.deepEqual(requiredModulesForCapability("MEMBER_ADMIN"), []);
  assert.deepEqual(requiredModulesForCapability("ORG_OWNER"), []);
});

test("organisation-wide capabilities can never be narrowed to a unit", () => {
  for (const capability of ["ORG_OWNER", "BILLING_MANAGER", "AUDIT_VIEWER"]) {
    assert.ok(ORGANIZATION_ONLY_CAPABILITIES.includes(capability));
  }
});

/* -------------------------------------------------------------------------
   Mallid: kiirvalik, mitte uus õigusklass.
   ------------------------------------------------------------------------- */

test("the unit-lead template grants leadership and assignment — never aggregates or private content", () => {
  const template = CAPABILITY_TEMPLATES.UNIT_LEAD;
  assert.equal(template.scope, "UNIT");
  assert.deepEqual([...template.capabilities], ["UNIT_LEAD", "WORK_ASSIGNER"]);
  for (const capability of template.capabilities) {
    assert.equal(RESERVED_ORGANIZATION_CAPABILITIES.includes(capability), false);
  }
});

test("the plain member template grants nothing — membership alone opens no administration", () => {
  assert.deepEqual([...CAPABILITY_TEMPLATES.MEMBER.capabilities], []);
});

test("every template only references capabilities that exist in the catalog", () => {
  for (const template of Object.values(CAPABILITY_TEMPLATES)) {
    for (const capability of template.capabilities) {
      assert.ok(ORGANIZATION_CAPABILITIES.includes(capability), `${capability} is not in the catalog`);
    }
  }
});

/* -------------------------------------------------------------------------
   Elutsükkel.
   ------------------------------------------------------------------------- */

test("archived is terminal — an archived organisation is never revived", () => {
  assert.deepEqual([...ORGANIZATION_STATUS_TRANSITIONS.ARCHIVED], []);
  assert.equal(canTransitionOrganizationStatus("ARCHIVED", "ACTIVE"), false);
  assert.equal(canTransitionOrganizationStatus("ARCHIVED", "DRAFT"), false);
});

test("a draft organisation cannot jump straight to active", () => {
  assert.equal(canTransitionOrganizationStatus("DRAFT", "ACTIVE"), false);
  assert.equal(canTransitionOrganizationStatus("DRAFT", "PENDING_VERIFICATION"), true);
  assert.equal(canTransitionOrganizationStatus("PENDING_VERIFICATION", "ACTIVE"), true);
});

/* -------------------------------------------------------------------------
   Migratsiooni invariandid. Need on DB-tasemel lukud — kui keegi need
   migratsioonist eemaldab, peab test kukkuma.
   ------------------------------------------------------------------------- */

test("migration is purely additive — it never alters a pre-existing table", () => {
  const alters = MIGRATION.split("\n").filter((line) => line.trim().startsWith("ALTER TABLE"));
  const preExisting = ["User", "Municipality", "Invite", "Subscription", "ServiceProviderProfile", "PreInquiry"];
  for (const line of alters) {
    for (const table of preExisting) {
      assert.equal(
        line.includes(`ALTER TABLE "${table}"`),
        false,
        `viil A must not alter ${table}: ${line}`
      );
    }
  }
});

test("partial unique indexes carry the invariants Prisma cannot express", () => {
  assert.match(MIGRATION, /OrganizationMembership_active_org_user_uniq[\s\S]*?WHERE "status" = 'ACTIVE'/u);
  assert.match(MIGRATION, /OrganizationModule_active_org_key_uniq[\s\S]*?WHERE "status" = 'ACTIVE'/u);
  assert.match(MIGRATION, /OrganizationMembershipUnit_active_primary_uniq[\s\S]*?"isPrimary" = true AND "endedAt" IS NULL/u);
  assert.match(MIGRATION, /OrganizationInvite_pending_org_email_uniq[\s\S]*?lower\("email"\)[\s\S]*?WHERE "status" = 'PENDING'/u);
});

test("database CHECK constraints enforce scope XOR, depth limit and verified activation", () => {
  assert.match(MIGRATION, /OrganizationCapabilityGrant_scope_xor_chk/u);
  assert.match(MIGRATION, /OrganizationUnit_depth_chk[\s\S]*?"depth" >= 1 AND "depth" <= 3/u);
  assert.match(MIGRATION, /Organization_active_requires_verification_chk[\s\S]*?"verifiedAt" IS NOT NULL/u);
  assert.equal(MAX_UNIT_DEPTH, 3);
});

/* -------------------------------------------------------------------------
   §4 kõvad keelud: org-kiht ei puuduta ühtegi privaatobjekti.
   ------------------------------------------------------------------------- */

test("no organisation model carries a foreign key into any private object", () => {
  const orgBlock = SCHEMA_CODE.slice(SCHEMA_CODE.indexOf("model Organization {"));
  for (const forbidden of [
    "WellbeingRecord",
    "WellbeingOutputDraft",
    "Conversation",
    "ConversationMessage",
    "UserDocument",
    "PracticeReflection",
    "SupervisionProcess",
    "MentoringRelation",
    "CovisionCase",
    "Journey"
  ]) {
    assert.equal(
      orgBlock.includes(forbidden),
      false,
      `organisation layer must not reference ${forbidden}`
    );
  }
});

test("WellbeingRecord still has no organisation ownership key (D8 is schema truth)", () => {
  const match = SCHEMA.match(/model WellbeingRecord \{([\s\S]*?)\n\}/u);
  assert.ok(match);
  assert.equal(match[1].includes("organizationId"), false);
  assert.equal(match[1].includes("Organization"), false);
});
