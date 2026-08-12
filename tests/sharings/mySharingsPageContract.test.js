import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../../components/sharings/MySharingsPage.jsx", import.meta.url);
const routeUrl = new URL("../../app/api/mentoring/relations/[relationId]/preparation/route.js", import.meta.url);

test("My sharings offers a confirmed mentoring recall and refreshes stale state", async () => {
  const source = await fs.readFile(pageUrl, "utf8");
  assert.match(source, /openConfirmAction\(\{ kind: "mentoringRecall", item \}\)/);
  assert.match(source, /\/api\/mentoring\/relations\/\$\{encodeURIComponent\(action\.item\.relationId\)\}\/preparation/);
  assert.match(source, /\{ action: "recall", noteId: action\.item\.id \}/);
  assert.match(source, /response\.status === 409/);
  assert.match(source, /section: "mentoringPreparations"/);
  assert.match(source, /my_sharings\.mentoring\.action_unavailable/);
});

test("preparation route exposes the opened-before-recall conflict without leaking internals", async () => {
  const source = await fs.readFile(routeUrl, "utf8");
  assert.match(source, /error\?\.code === "PREPARATION_ALREADY_OPENED"/);
  assert.match(source, /errorJson\("mentoring\.errors\.preparation_already_opened", 409, locale\)/);
});
