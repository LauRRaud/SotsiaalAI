import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  canonicalizeNetworkUrl,
  canonicalizeSourceUrlPair,
  normalizeRegistryIdentityUrl
} from "../../scripts/lib/url-canonical.mjs";

const REGISTRY_PATH = path.resolve(
  "Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json"
);

test("network URL canonicalization is table-driven and keeps fetch URL separate from comparison aliases", () => {
  const cases = [
    {
      input: "HTTPS://WWW.Example.COM:443/A/%7e/?b=2&utm_source=news&a=1#section",
      canonical: "https://www.example.com/A/~/?a=1&b=2",
      comparison: "https://example.com/A/~?a=1&b=2",
      anomalies: ["default_port_removed", "fragment_removed", "tracking_query_removed", "trailing_slash_alias_in_comparison_key", "www_alias_in_comparison_key"]
    },
    {
      input: "http://example.com:8080/Case/Path",
      canonical: "http://example.com:8080/Case/Path",
      comparison: "http://example.com:8080/Case/Path",
      anomalies: []
    },
    {
      input: "https://näide.ee/õigus/%7e?q=tere%20maailm&q=algus",
      canonical: "https://xn--nide-loa.ee/%C3%B5igus/~?q=algus&q=tere%20maailm",
      comparison: "https://xn--nide-loa.ee/%C3%B5igus/~?q=algus&q=tere%20maailm",
      anomalies: []
    },
    {
      input: "https://example.ee/a//b/",
      canonical: "https://example.ee/a//b/",
      comparison: "https://example.ee/a//b",
      anomalies: ["duplicate_path_slashes_preserved", "trailing_slash_alias_in_comparison_key"]
    },
    {
      input: "https://example.ee/",
      canonical: "https://example.ee/",
      comparison: "https://example.ee/",
      anomalies: []
    }
  ];

  for (const item of cases) {
    const result = canonicalizeNetworkUrl(item.input);
    assert.equal(result.ok, true, item.input);
    assert.equal(result.canonical_url, item.canonical, item.input);
    assert.equal(result.fetch_url, item.canonical, item.input);
    assert.equal(result.comparison_key, item.comparison, item.input);
    assert.deepEqual(result.anomalies.map(entry => entry.code).sort(), [...item.anomalies].sort(), item.input);
  }
});

test("registry identity preserves legacy meanings while reproducing percent decoding and slash behavior", () => {
  const cases = [
    ["https://www.Example.ee:443/Case/", "https://www.Example.ee:443/Case"],
    ["https://example.ee/", "https://example.ee/"],
    ["https://example.ee/A%20B/%C3%B5igus.pdf", "https://example.ee/A B/õigus.pdf"],
    ["https://example.ee/file%2Bname.pdf", "https://example.ee/file+name.pdf"],
    ["https://example.ee/path/?b=2&a=1#fragment", "https://example.ee/path/?b=2&a=1#fragment"]
  ];
  for (const [input, expected] of cases) {
    const result = normalizeRegistryIdentityUrl(input);
    assert.equal(result.ok, true, input);
    assert.equal(result.normalized_url, expected, input);
  }
});

test("invalid schemes and credentialed URLs return structured errors", () => {
  for (const canonicalize of [normalizeRegistryIdentityUrl, canonicalizeNetworkUrl]) {
    const scheme = canonicalize("file:///etc/passwd");
    assert.equal(scheme.ok, false);
    assert.equal(scheme.error.code, "forbidden_scheme");

    const credentials = canonicalize("https://user:secret@example.ee/path");
    assert.equal(credentials.ok, false);
    assert.equal(credentials.error.code, "credentials_forbidden");
    assert.equal(credentials.input_redacted, true);
    assert.equal(JSON.stringify(credentials).includes("secret@example"), false);
  }
});

test("query sorting, fragments and percent encoding are deterministic", () => {
  const input = "https://www.example.ee/%7e?q=2&q=1&utm_medium=x#frag";
  const first = canonicalizeNetworkUrl(input);
  for (let index = 0; index < 20; index += 1) {
    assert.deepEqual(canonicalizeNetworkUrl(input), first);
  }
  assert.equal(first.canonical_url, "https://www.example.ee/~?q=1&q=2");
  assert.equal(first.comparison_key, "https://example.ee/~?q=1&q=2");
});

test("all 323 registry URLs reproduce normalized_url byte-for-byte without mutating the registry", async () => {
  const before = await fs.readFile(REGISTRY_PATH);
  const records = JSON.parse(before.toString("utf8"));
  assert.equal(records.length, 323);
  const anomalies = [];
  for (const record of records) {
    const result = normalizeRegistryIdentityUrl(record.url);
    assert.equal(result.ok, true, record.source_id);
    if (result.normalized_url !== record.normalized_url) {
      anomalies.push({ source_id: record.source_id, expected: record.normalized_url, actual: result.normalized_url });
    }
  }
  assert.deepEqual(anomalies, []);
  const after = await fs.readFile(REGISTRY_PATH);
  assert.deepEqual(after, before);
});

test("the paired contract reports legacy/network divergence without changing either value", () => {
  const pair = canonicalizeSourceUrlPair(
    "https://www.riha.ee/Infos%C3%BCsteemid/Vaata/mtr",
    "https://www.riha.ee/Infosüsteemid/Vaata/mtr"
  );
  assert.equal(pair.registry.normalized_url, "https://www.riha.ee/Infosüsteemid/Vaata/mtr");
  assert.equal(pair.network.canonical_url, "https://www.riha.ee/Infos%C3%BCsteemid/Vaata/mtr");
  assert.equal(pair.network.comparison_key, "https://riha.ee/Infos%C3%BCsteemid/Vaata/mtr");
  assert.ok(pair.anomalies.some(item => item.code === "registry_identity_differs_from_network_key"));
});
