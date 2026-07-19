import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CHECKPOINT_FOLLOW_UP_STATES } from "../../lib/wellbeing/checkpoint.js";

/**
 * `npm run i18n:check` proves only that et/en/ru are in sync WITH EACH OTHER, so
 * a key missing from ALL THREE passes it and renders to the user as a raw key.
 * That is exactly what happened here: `wellbeing.errors` carried 8 keys while the
 * code could throw 37, including keys on the already-deployed records path.
 *
 * Same hole, same fix as tests/i18n/fieldKeys.test.js (T24).
 */

const LOCALES = ["et", "en", "ru"];
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_ROOTS = ["lib/wellbeing", "app/api/wellbeing"];

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

function thrownErrorKeys() {
  const keys = new Set();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/wellbeing\.errors\.([a-z_]+)/gu)) {
      keys.add(`wellbeing.errors.${match[1]}`);
    }
  }
  return [...keys].sort();
}

test("every wellbeing.errors.* key the server can throw resolves in et, en and ru", () => {
  const keys = thrownErrorKeys();
  assert.ok(keys.length > 30, `expected a real key set, saw ${keys.length}`);
  assertResolves(keys, "wellbeing.errors.*");
});

test("the checkpoint notification label resolves in every locale", () => {
  assertResolves(["notifications.events.wellbeing_checkpoint_due"], "checkpoint notification");
});

/* Kolm ausat olekut on tooteotsus (TO-2): kui keegi lisab neljanda, peab ta
   lisama ka tõlke — muidu näeks kasutaja toorest võtit. */
test("every checkpoint follow-up state has a label in every locale", () => {
  assert.equal(CHECKPOINT_FOLLOW_UP_STATES.length, 3);
  assertResolves(
    CHECKPOINT_FOLLOW_UP_STATES.map((state) => `wellbeing.checkpoint.follow_up.${state}`),
    "wellbeing.checkpoint.follow_up.*"
  );
});
