import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("each answer exposes its own native source disclosure with openable links", () => {
  const source = readFileSync(
    new URL("../../components/alalehed/chat/ChatMessageItem.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /<details\s+data-chat-message-sources/);
  assert.match(source, /<summary[^>]*aria-label=\{sourcesLabel\}/);
  assert.match(source, /href=\{url\}/);
  assert.match(source, /target="_blank"/);
});
