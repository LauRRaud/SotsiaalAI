import test from "node:test";
import assert from "node:assert/strict";

import { buildImmediateChatResponse } from "../../lib/chat/responseFinalizer.js";

function source(id, title) {
  return {
    source_id: id,
    title,
    url: `https://example.test/${id}`
  };
}

async function readSseEvents(response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const event = block.match(/^event:\s*(.+)$/m)?.[1] || "";
      const dataRaw = block.match(/^data:\s*(.+)$/m)?.[1] || "{}";
      return {
        event,
        data: JSON.parse(dataRaw)
      };
    });
}

test("non-stream response exposes displayed_sources separately from legacy sources", async () => {
  const retrieved = [source("used", "Used source"), source("unused", "Unused source")];
  const displayed = [source("used", "Used source")];
  const ragTrace = {
    retrieved_count: 2,
    selected_context_count: 2,
    displayed_source_ids: ["used"],
    filtered_out_source_ids: ["unused"]
  };

  const response = buildImmediateChatResponse({
    wantStream: false,
    reply: "Vastus",
    sources: retrieved,
    displayedSources: displayed,
    ragContract: {
      rag_contract_version: "v1",
      source_display_mode: "displayed_sources_enforced"
    },
    ragTrace,
    attributionDecisions: [{ source_id: "used", decision: "display", reason: "reply_overlap_validated" }]
  });
  const payload = await response.json();

  assert.equal(payload.ok, true);
  assert.equal(payload.sources.length, 2);
  assert.equal(payload.displayed_sources.length, 1);
  assert.equal(payload.displayed_sources[0].source_id, "used");
  assert.equal(payload.rag_contract_version, "v1");
  assert.equal(payload.source_display_mode, "displayed_sources_enforced");
  assert.deepEqual(payload.rag_trace.displayed_source_ids, ["used"]);
  assert.equal(payload.attribution_decisions.length, 1);
});

test("stream response includes displayed_sources in meta and done events", async () => {
  const retrieved = [source("used", "Used source"), source("unused", "Unused source")];
  const displayed = [source("used", "Used source")];
  const response = buildImmediateChatResponse({
    wantStream: true,
    reply: "Vastus",
    sources: retrieved,
    displayedSources: displayed,
    ragContract: {
      rag_contract_version: "v1",
      source_display_mode: "displayed_sources_enforced"
    },
    ragTrace: {
      retrieved_count: 2,
      selected_context_count: 2,
      displayed_source_ids: ["used"],
      filtered_out_source_ids: ["unused"]
    }
  });

  const events = await readSseEvents(response);
  const meta = events.find(item => item.event === "meta")?.data;
  const done = events.find(item => item.event === "done")?.data;

  assert.equal(meta.sources.length, 2);
  assert.equal(meta.displayed_sources.length, 1);
  assert.equal(meta.displayed_sources[0].source_id, "used");
  assert.equal(meta.rag_contract_version, "v1");
  assert.equal(meta.source_display_mode, "displayed_sources_enforced");
  assert.equal(done.sources.length, 2);
  assert.equal(done.displayed_sources.length, 1);
  assert.equal(done.displayed_sources[0].source_id, "used");
  assert.equal(done.rag_contract_version, "v1");
  assert.equal(done.source_display_mode, "displayed_sources_enforced");
});
