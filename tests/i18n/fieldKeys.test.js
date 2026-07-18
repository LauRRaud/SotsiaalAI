import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FIELD_ATTACHMENT_ROLES,
  FIELD_CONSENT_KINDS,
  FIELD_ITEM_STATES,
  FIELD_NOTE_KINDS,
  FIELD_PROVENANCES,
  FIELD_VISIT_K1_PHASE,
  FIELD_VISIT_STATUSES
} from "../../lib/field/constants.js";

/**
 * npm run i18n:check only proves et/en/ru are in sync with each other, so a key
 * that is missing from ALL THREE passes it while rendering as a raw key to the
 * user. This registry test closes that hole for the field surfaces: every
 * message key the code can emit must resolve in every locale.
 */

const LOCALES = ["et", "en", "ru"];
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_ROOTS = ["lib/field", "components/field", "app/valitoo", "app/api/field"];

// DataAuditLog action names share the "field." prefix but are never rendered.
const AUDIT_ACTIONS = new Set([
  "field.attachment_deleted",
  "field.consent_withdrawn",
  "field.handover_artifact",
  "field.handover_pre_inquiry",
  "field.safety_escalated",
  "field.safety_escalation_failed",
  "field.safety_resolved_notice"
]);

// Values passed as `{ field: "…" }` into normalizeText/normalizeDate, which
// throw `field.errors.invalid_${field}`.
const DYNAMIC_INVALID_FIELDS = [
  "body",
  "date",
  "device_created",
  "field",
  "handover_note",
  "planned_end",
  "planned_start",
  "safety_contact",
  "safety_deadline"
];

function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
  };
  for (const root of SOURCE_ROOTS) walk(path.join(REPO, root));
  return files;
}

function referencedKeys() {
  const keys = new Set();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'`](field\.[A-Za-z0-9_.${}]+)["'`]/gu)) {
      const key = match[1];
      if (key.includes("$") || key.includes("{")) continue; // dynamic, covered below
      if (AUDIT_ACTIONS.has(key)) continue;
      keys.add(key);
    }
  }
  return [...keys].sort();
}

const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(path.join(REPO, "messages", `${locale}.json`), "utf8"))
  ])
);

const lookup = (locale, key) =>
  key.split(".").reduce((node, part) => (node == null ? node : node[part]), messages[locale]);

function assertResolves(keys, label) {
  const missing = [];
  for (const locale of LOCALES) {
    for (const key of keys) {
      if (typeof lookup(locale, key) !== "string") missing.push(`${locale}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], `${label} must resolve in every locale`);
}

test("every static field.* message key referenced in code resolves in et, en and ru", () => {
  const keys = referencedKeys();
  assert.ok(keys.length > 100, `expected a real key set, saw ${keys.length}`);
  assertResolves(keys, "static field keys");
});

test("every enum value rendered through a dynamic key has a translation", () => {
  const families = [
    ["field.status", FIELD_VISIT_STATUSES],
    ["field.provenance", FIELD_PROVENANCES],
    ["field.itemState", FIELD_ITEM_STATES],
    ["field.consent.kind", FIELD_CONSENT_KINDS],
    // Item labels cover both note kinds and attachment roles.
    ["field.item", [...FIELD_NOTE_KINDS, ...FIELD_ATTACHMENT_ROLES]]
  ];

  for (const [prefix, values] of families) {
    assert.ok(values.length > 0, `${prefix} has values`);
    assertResolves(values.map((value) => `${prefix}.${value}`), prefix);
  }

  // Phases carry their own labelKey, so assert exactly what the code renders.
  const phaseKeys = Object.values(FIELD_VISIT_K1_PHASE).map((phase) => phase.labelKey);
  assert.equal(phaseKeys.length, 3);
  assertResolves(phaseKeys, "field.phase.*");
});

test("every dynamic validation error key has a translation", () => {
  assertResolves(
    DYNAMIC_INVALID_FIELDS.map((field) => `field.errors.invalid_${field}`),
    "field.errors.invalid_*"
  );
});

test("the dynamic invalid_* list still matches what the code can throw", () => {
  const used = new Set(["field", "date"]); // the two defaults
  for (const file of sourceFiles()) {
    for (const match of readFileSync(file, "utf8").matchAll(/field:\s*"([a-z_]+)"/gu)) {
      used.add(match[1]);
    }
  }
  assert.deepEqual(
    [...used].sort(),
    [...DYNAMIC_INVALID_FIELDS].sort(),
    "a new { field: … } value needs a matching field.errors.invalid_* translation"
  );
});

test("audit action names are deliberately untranslated and stay out of the message files", () => {
  for (const action of AUDIT_ACTIONS) {
    for (const locale of LOCALES) {
      assert.equal(
        typeof lookup(locale, action),
        "undefined",
        `${action} is a DataAuditLog action, not a UI string`
      );
    }
  }
});
