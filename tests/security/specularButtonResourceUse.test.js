import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shared Button does not allocate SpecularButton resources", async () => {
  const source = await readFile(
    new URL("../../components/ui/Button.jsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /SpecularButton/,
    "common buttons must not create a WebGL context and animation loop per instance"
  );
  assert.match(source, /<Component ref=\{ref\} \{\.\.\.sharedProps\}>/);
});
