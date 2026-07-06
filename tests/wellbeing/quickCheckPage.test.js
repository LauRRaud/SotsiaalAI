import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("quick check route renders a dedicated workflow instead of the generic placeholder", () => {
  const source = readFileSync(new URL("../../components/wellbeing/WellbeingPage.jsx", import.meta.url), "utf8");

  assert.match(source, /import QuickCheckWorkflow from "\.\/QuickCheckWorkflow"/);
  assert.match(source, /activeTool\?\.id === "quick-check"/);
  assert.match(source, /<QuickCheckWorkflow/);
});
