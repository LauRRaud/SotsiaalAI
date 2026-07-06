import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsUrl = pathToFileURL(path.resolve(__dirname, "../../lib/chat/settings.js")).href;

function readFlags(env) {
  const code = `
    import {
      RAG_ATTRIBUTION_DECISIONS_ENABLED,
      RAG_DISPLAYED_SOURCES_ENFORCED,
      RAG_TRACE_V1_ENABLED
    } from ${JSON.stringify(settingsUrl)};
    console.log(JSON.stringify({
      trace: RAG_TRACE_V1_ENABLED,
      attribution: RAG_ATTRIBUTION_DECISIONS_ENABLED,
      displayed: RAG_DISPLAYED_SOURCES_ENFORCED
    }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", code], {
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim());
}

test("RAG V1 feature flags default to enabled", () => {
  const flags = readFlags({
    RAG_TRACE_V1_ENABLED: "",
    RAG_ATTRIBUTION_DECISIONS_ENABLED: "",
    RAG_DISPLAYED_SOURCES_ENFORCED: ""
  });

  assert.deepEqual(flags, {
    trace: true,
    attribution: true,
    displayed: true
  });
});

test("RAG V1 feature flags can be disabled for rollout safety", () => {
  const flags = readFlags({
    RAG_TRACE_V1_ENABLED: "0",
    RAG_ATTRIBUTION_DECISIONS_ENABLED: "false",
    RAG_DISPLAYED_SOURCES_ENFORCED: "off"
  });

  assert.deepEqual(flags, {
    trace: false,
    attribution: false,
    displayed: false
  });
});
