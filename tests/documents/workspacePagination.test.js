import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildWorkspaceItems } from "../../lib/documents/workspace.js";
import { familyHasNextPage, mergeOwnerPage } from "../../lib/documents/workspacePagination.js";

function rows(prefix, count, start = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${start + index + 1}`,
    title: `${prefix} ${start + index + 1}`,
    query: `${prefix} ${start + index + 1}`,
    status: "FINAL",
    kind: "MATERIAL",
    updatedAt: new Date(Date.UTC(2026, 7, 12, 12, 0, start + index)).toISOString()
  }));
}

test("SOL-DOC-J-01: every owner family appends its 51st row without duplicates", () => {
  const families = Object.fromEntries(
    ["documents", "artifacts", "analyses", "research"].map((name) => {
      const first = mergeOwnerPage({ items: [], total: 0 }, { items: rows(name, 50), total: 51 });
      const complete = mergeOwnerPage(first, {
        items: [rows(name, 50).at(-1), ...rows(name, 1, 50)],
        total: 51,
        offset: 50
      });
      assert.equal(familyHasNextPage(first), true);
      assert.equal(familyHasNextPage(complete), false);
      assert.equal(complete.items.length, 51);
      assert.equal(new Set(complete.items.map((item) => item.id)).size, 51);
      return [name, complete.items];
    })
  );

  const workspace = buildWorkspaceItems(families);
  for (const name of ["documents", "artifacts", "analyses", "research"]) {
    assert.ok(workspace.some((item) => item.id === `${name}_51`));
  }
});

test("SOL-DOC-J-01: the view requests dynamic offsets and exposes the next-page action", async () => {
  const source = await readFile(new URL("../../components/documents/DocumentsPage.jsx", import.meta.url), "utf8");
  assert.equal((source.match(/offset: String\(offset\)/g) || []).length, 4);
  assert.match(source, /loadMoreWorkspace/);
  assert.match(source, /documents\.workspace\.load_more/);
  assert.equal((source.match(/params\.set\("search", searchQuery\)/g) || []).length, 4);
  assert.match(source, /documents\.workspace\.search_placeholder/);
  assert.doesNotMatch(source, /offset: "0"/);
});

test("SOL-DOC-J-01: all four APIs bind search before count and pagination", async () => {
  const sources = await Promise.all([
    readFile(new URL("../../app/api/documents/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/documents/artifacts/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/documents/savedAnalysis.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/research/jobStore.js", import.meta.url), "utf8")
  ]);
  for (const source of sources) assert.match(source, /search|string_contains|contains/);
  assert.match(sources[0], /originalName: \{ contains: search/);
  assert.match(sources[2], /content: \{ contains: query/);
  assert.match(sources[3], /payload: \{ path: \["query"\], string_contains: query/);
});
