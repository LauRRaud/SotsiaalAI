import test from "node:test";
import assert from "node:assert/strict";

import { parseAssistantMarkdownBlocks } from "../../lib/chat/messageMarkdown.js";

test("assistant markdown parser strips visible heading markers", () => {
  const blocks = parseAssistantMarkdownBlocks([
    "### 2) Praktiline juhendmaterjal",
    "2025. aasta hea tava juhend.",
    "",
    "### 3) Näide teenustest",
    "- koduhooldus",
    "- tugiisikuteenus"
  ].join("\n"));

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "2) Praktiline juhendmaterjal" },
    { type: "paragraph", text: "2025. aasta hea tava juhend." },
    { type: "paragraph", text: "3) Näide teenustest" },
    { type: "unordered", items: ["koduhooldus", "tugiisikuteenus"] }
  ]);
});
