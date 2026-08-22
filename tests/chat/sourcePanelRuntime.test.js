import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("each answer opens its own sources in the established source panel", () => {
  const source = readFileSync(
    new URL("../../components/alalehed/chat/ChatMessageItem.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /onShowSources,/);
  assert.match(
    source,
    /<button[\s\S]*?aria-label=\{sourcesLabel\}[\s\S]*?onClick=\{\(\) => onShowSources\?\.\(messageSources\)\}/
  );
  assert.doesNotMatch(source, /<details\s+data-chat-message-sources/);
});
