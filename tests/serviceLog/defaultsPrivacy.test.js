import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("client names stay out of service-log defaults request URLs", () => {
  const ui = readFileSync("components/serviceLog/ServiceLogDay.jsx", "utf8");
  const route = readFileSync("app/api/service-entries/route.js", "utf8");

  assert.doesNotMatch(ui, /URLSearchParams\(\{ defaults: "1", clientDisplayName:/);
  assert.match(ui, /body: JSON\.stringify\(\{ operation: "defaults", clientDisplayName:/);
  assert.doesNotMatch(route, /searchParams\.get\("defaults"\)/);
  assert.match(route, /body\.operation === "defaults"/);
});
