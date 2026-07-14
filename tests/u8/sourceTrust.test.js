import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceAttribution, getSourceAttributionId } from "../../lib/chat/sourceAttribution.js";
import { CHECKED_AT_ALIASES, normalizeSourceTrust, serializeDisplayedSourceTrust } from "../../lib/chat/sourceTrust.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

test("all checked-at aliases normalize to the same trusted ISO value", () => {
  for (const alias of CHECKED_AT_ALIASES) {
    const result = normalizeSourceTrust({ [alias]: "2026-07-01", source_type: "state_guide" }, { now: NOW });
    assert.equal(result.checked_at, "2026-07-01T00:00:00.000Z", alias);
    assert.equal(result.freshness, "fresh", alias);
  }
});

test("missing, malformed and future dates remain unknown instead of inventing today", () => {
  assert.deepEqual(normalizeSourceTrust({}, { now: NOW }).checked_at, null);
  assert.equal(normalizeSourceTrust({ last_checked: "not-a-date" }, { now: NOW }).freshness, "unknown");
  assert.equal(normalizeSourceTrust({ last_checked: "2027-01-01" }, { now: NOW }).checked_at, null);
});

test("historical, inactive and expired sources expose explicit warnings", () => {
  assert.equal(normalizeSourceTrust({ historical: true }, { now: NOW }).warning, "historical");
  assert.equal(normalizeSourceTrust({ source_status: "inactive" }, { now: NOW }).warning, "inactive");
  assert.equal(normalizeSourceTrust({ valid_to: "2025-01-01" }, { now: NOW }).warning, "expired");
});

test("displayed source trust serialization does not change attribution decisions or ids", () => {
  const source = {
    source_id: "guide-1",
    source_type: "state_guide",
    title: "Toetuse juhend",
    text: "Toetuse taotlemise tingimused ja vajalikud dokumendid.",
    last_checked: "2026-07-01",
    evidence_strength: "official_current"
  };
  const result = buildSourceAttribution("Toetuse taotlemise tingimused ja vajalikud dokumendid.", [source], { query: "toetuse taotlemise tingimused" });
  assert.equal(result.displayedSourceIds[0], "guide-1");
  assert.equal(result.displayedSources[0].source_id, "guide-1");
  assert.equal(result.displayedSources[0].source_checked_at, "2026-07-01T00:00:00.000Z");
  assert.equal(result.attributionDecisions[0].decision, "display");
});

test("trust serialization preserves attribution identity for every supported source shape", () => {
  const cases = [
    { name: "plain doc", source: { source_id: "doc-1", id: "B", source_type: "guide" } },
    { name: "source_id and id", source: { source_id: "A", id: "B" } },
    { name: "legal type fallback", source: { source_id: "A", id: "B", type: "riigiteataja_regulation" } },
    { name: "legal origin fallback", source: { source_id: "A", id: "B", origin: "riigiteataja_regulation" } },
    { name: "legal source_type", source: { source_id: "A", id: "B", source_type: "riigiteataja_regulation" } },
    { name: "url only", source: { url: "https://x.ee/u" } }
  ];

  for (const { name, source } of cases) {
    const shownId = getSourceAttributionId(source, 0);
    const serialized = serializeDisplayedSourceTrust(source, shownId, { now: NOW });
    assert.equal(getSourceAttributionId(serialized, 0), shownId, name);
    assert.equal(serialized.source_type, source.source_type, `${name}: identity-bearing source_type is unchanged`);
  }
});
