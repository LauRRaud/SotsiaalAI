import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertAdmin } from "../../lib/authz.js";
import { UrgentDeskError } from "../../lib/urgent/deskAdmin.js";
import { statusForDeskError } from "../../lib/urgent/deskAdminRoutes.js";

const ROUTES = [
  "route.js",
  "[deskId]/route.js",
  "[deskId]/verify/route.js",
  "[deskId]/activation/route.js",
  "[deskId]/members/route.js"
];

async function readRoute(name) {
  return readFile(new URL(`../../app/api/admin/urgent-desks/${name}`, import.meta.url), "utf8");
}

test("admini kontroll annab mutatsioonile auditi tegija identiteedi", () => {
  const authz = assertAdmin({ user: { id: "admin-user-1", role: "ADMIN" } });

  assert.deepEqual(authz, { ok: true, status: 200, userId: "admin-user-1" });
});

test("iga laua-marsruut nõuab admini enne mistahes tööd", async () => {
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.match(source, /requireDeskAdmin\(\)/, `${name}: admini kontroll puudub`);
    assert.match(source, /if \(!authz\.ok\) return deskAuthError\(authz, request\)/, `${name}: varajane väljumine puudub`);
  }
});

test("laua saab luua ainult kinni — loomisrada ei tohi isActive't kehast võtta", async () => {
  const source = await readRoute("route.js");
  assert.doesNotMatch(source, /isActive: body/);
  assert.doesNotMatch(source, /lastVerifiedAt/);
});

test("sisselülitamine käib eraldi marsruuti ja eraldi otsust mööda", async () => {
  const activation = await readRoute("[deskId]/activation/route.js");
  assert.match(activation, /setUrgentDeskActive/);
  // Muutmisrada ei tohi lauda sisse lülitada — muidu saaks tingimuste
  // salvestamine piirkonna kogemata avada.
  const patch = await readRoute("[deskId]/route.js");
  assert.doesNotMatch(patch, /setUrgentDeskActive/);
});

test("valmiduse puudumine tuleb vastusesse koos põhjustega", () => {
  const error = new UrgentDeskError("urgent_desk.not_ready");
  error.reasons = ["urgent_desk.unstaffed"];
  const mapped = statusForDeskError(error);
  assert.equal(mapped.status, 409);
  assert.equal(mapped.message, "urgent_desk.not_ready");
});

test("veakoodid kaardistuvad õigetele staatustele", () => {
  const cases = [
    ["urgent_desk.not_found", 404],
    ["urgent_desk.municipality_not_found", 404],
    ["urgent_desk.member_not_a_user", 404],
    ["urgent_desk.already_exists", 409],
    ["urgent_desk.reading_time_required", 400]
  ];
  for (const [code, status] of cases) {
    assert.equal(statusForDeskError(new UrgentDeskError(code)).status, status, code);
  }
});

test("tundmatu viga ei leki admini vaatesse", () => {
  const mapped = statusForDeskError(new Error("prisma kukkus"));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.message, "api.common.server_error");
});
