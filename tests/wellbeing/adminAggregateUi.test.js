import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("admin wellbeing aggregate page is admin gated and renders the client", () => {
  const source = read("app/admin/wellbeing/page.jsx");

  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /callbackUrl:\s*localizePath\("\/admin\/wellbeing"/);
  assert.match(source, /isAdmin/);
  assert.match(source, /redirect\(localizePath\("\/"/);
  assert.match(source, /<AdminWellbeingClient/);
});

test("admin wellbeing client fetches aggregate JSON and offers CSV export", () => {
  const source = read("app/admin/wellbeing/AdminWellbeingClient.jsx");

  assert.match(source, /\/api\/admin\/wellbeing\/aggregate/);
  assert.match(source, /format:\s*"csv"/);
  assert.match(source, /<Button\s+as="a"\s+href=\{csvUrl\}/);
  assert.match(source, /roleGroup/);
  assert.match(source, /minimumGroupSize/);
  assert.match(source, /suppressed/);
  assert.match(source, /CSV/);
  assert.match(source, /Tööheaolu koondandmestik/);
  assert.match(source, /Valim/);
});
