import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "components", "serviceLog", "ServiceLogRouteMap.jsx"),
  "utf8"
);

test("Teenuspäeviku kaardi hüpik käsitleb kliendi nime ja aadressi tekstina", () => {
  assert.match(source, /\.textContent\s*=\s*`[^`]*\$\{visit\.clientDisplayName/);
  assert.match(source, /\.textContent\s*=\s*visit\.address/);
  assert.doesNotMatch(source, /bindPopup\(`[^`]*\$\{visit\.(?:clientDisplayName|address)/);
});
