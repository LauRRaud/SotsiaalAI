import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { requireMentoringMember, requireMentoringAdmin } from "../../lib/mentoring/shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

test("CLIENT and unauthenticated cannot use mentoring; ADMIN cannot use member surface", () => {
  assert.throws(() => requireMentoringMember(null), (e) => e.status === 401);
  assert.throws(
    () => requireMentoringMember({ user: { id: "u1", role: "CLIENT" } }),
    (e) => e.status === 403
  );
  // Admin account is not a mentoring member (I5: acts on a separate procedural rail).
  assert.throws(
    () => requireMentoringMember({ user: { id: "a1", role: "ADMIN" } }),
    (e) => e.status === 403
  );
  for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
    const actor = requireMentoringMember({ user: { id: "u", role } });
    assert.equal(actor.role, role);
  }
});

test("non-admin hitting admin surface gets 404 (existence not confirmed)", () => {
  assert.throws(
    () => requireMentoringAdmin({ user: { id: "u1", role: "SOCIAL_WORKER" } }),
    (e) => e.status === 404
  );
  const admin = requireMentoringAdmin({ user: { id: "a1", role: "ADMIN" } });
  assert.equal(admin.role, "ADMIN");
});

test("mentoring i18n keys exist and match across et/en/ru", () => {
  const locales = ["et", "en", "ru"].map((locale) => ({
    locale,
    data: JSON.parse(readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"))
  }));
  const flatten = (node, prefix = "") => {
    const keys = new Set();
    for (const [key, value] of Object.entries(node)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const nested of flatten(value, full)) keys.add(nested);
      } else {
        keys.add(full);
      }
    }
    return keys;
  };
  const base = flatten(locales[0].data.mentoring);
  assert.ok(base.has("home.title"));
  assert.ok(base.has("relation.close_confirm_action"));
  assert.ok(base.has("admin.import_seed"));
  for (const { locale, data } of locales.slice(1)) {
    const keys = flatten(data.mentoring);
    for (const key of base) {
      assert.ok(keys.has(key), `${locale} missing mentoring.${key}`);
    }
  }
});
