#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const CSV_HEADERS = [
  "timestamp_eest",
  "measurement_group",
  "target_idle_bucket",
  "accepted_for_target_bucket",
  "request_order",
  "query_variant",
  "rag_call_index",
  "request_id",
  "observability_stage",
  "frontend_pid",
  "frontend_uptime_ms",
  "time_since_previous_rag_request_ms",
  "embedding_duration_ms",
  "retriever_duration_ms",
  "retrieval_total_ms",
  "retrieval_timeout_ms",
  "aborted_stage",
  "http_status",
  "outcome",
  "source_count",
  "journal_embedding_ms",
  "journal_retrieval_ms",
  "journal_total_ms",
  "journal_stage_count",
  "journal_duplicate_count",
  "journal_upstream_stage",
  "timings_match_journal",
  "notes"
];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted && char === "\"" && line[index + 1] === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  if (headers.join(",") !== CSV_HEADERS.join(",")) throw new Error("CSV_SCHEMA_MISMATCH");
  return lines.slice(1).map(line => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
  });
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function maxValue(values) {
  const filtered = values.filter(Number.isFinite);
  return filtered.length ? Math.max(...filtered) : null;
}

function formatNumber(value) {
  return value === null || value === undefined ? "—" : String(Math.round(value * 100) / 100);
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.measurement_group) continue;
    if (!groups.has(row.measurement_group)) groups.set(row.measurement_group, []);
    groups.get(row.measurement_group).push(row);
  }
  return [...groups.entries()].map(([id, group]) => ({ id, rows: group }));
}

function nativeRow(group, order) {
  return group.rows.find(row =>
    Number(row.request_order) === order
    && row.observability_stage === "rag_search"
  ) || null;
}

function groupSummary(group) {
  const first = nativeRow(group, 1);
  const second = nativeRow(group, 2);
  const accepted = group.rows.some(row => row.accepted_for_target_bucket === "true");
  const notes = [...new Set(group.rows.flatMap(row => String(row.notes || "").split("|").filter(Boolean)))];
  return {
    id: group.id,
    rows: group.rows,
    first,
    second,
    accepted,
    bucket: first?.target_idle_bucket || "unknown",
    notes
  };
}

function values(groups, order, field) {
  return groups
    .map(group => finiteNumber((order === "first" ? group.first : group.second)?.[field]))
    .filter(value => value !== null);
}

function orderReport(bucketGroups, order) {
  const runs = bucketGroups
    .map(group => order === "first" ? group.first : group.second)
    .filter(Boolean);
  const totals = runs.map(row => finiteNumber(row.retrieval_total_ms)).filter(value => value !== null);
  const successful = runs.filter(row => row.outcome === "ok" && row.http_status === "200").length;
  const aborts = runs.filter(row => row.aborted_stage).length;
  const httpErrors = runs.filter(row => {
    const status = finiteNumber(row.http_status);
    return status !== null && status !== 200;
  }).length;
  const sourceCountZero = runs.filter(row => finiteNumber(row.source_count) === 0).length;
  const over10s = runs.filter(row => (finiteNumber(row.retrieval_total_ms) || 0) > 10_000).length;
  const atOrOver12s = runs.filter(row => (finiteNumber(row.retrieval_total_ms) || 0) >= 12_000).length;
  const embeddingShare = runs.map(row => {
    const embedding = finiteNumber(row.embedding_duration_ms);
    const total = finiteNumber(row.retrieval_total_ms);
    return embedding !== null && total > 0 ? embedding / total : null;
  }).filter(value => value !== null);
  const retrievalShare = runs.map(row => {
    const retrieval = finiteNumber(row.retriever_duration_ms);
    const total = finiteNumber(row.retrieval_total_ms);
    return retrieval !== null && total > 0 ? retrieval / total : null;
  }).filter(value => value !== null);
  const correlationErrors = runs.filter(row => row.timings_match_journal !== "true").length;
  return {
    runs: runs.length,
    successful,
    aborts,
    httpErrors,
    sourceCountZero,
    embeddingP50: median(runs.map(row => finiteNumber(row.embedding_duration_ms)).filter(value => value !== null)),
    embeddingMax: maxValue(runs.map(row => finiteNumber(row.embedding_duration_ms)).filter(value => value !== null)),
    retrievalP50: median(runs.map(row => finiteNumber(row.retriever_duration_ms)).filter(value => value !== null)),
    retrievalMax: maxValue(runs.map(row => finiteNumber(row.retriever_duration_ms)).filter(value => value !== null)),
    totalP50: median(totals),
    totalMax: maxValue(totals),
    over10s,
    atOrOver12s,
    embeddingShareP50: median(embeddingShare),
    retrievalShareP50: median(retrievalShare),
    correlationErrors
  };
}

function bucketReport(groups, bucket) {
  const bucketGroups = groups.filter(group => group.bucket === bucket && group.accepted);
  const totalDiffs = bucketGroups
    .filter(group => finiteNumber(group.first?.retrieval_total_ms) !== null
      && finiteNumber(group.second?.retrieval_total_ms) !== null)
    .map(group => finiteNumber(group.second.retrieval_total_ms) - finiteNumber(group.first.retrieval_total_ms));
  return {
    bucket,
    groups: bucketGroups.length,
    first: orderReport(bucketGroups, "first"),
    second: orderReport(bucketGroups, "second"),
    firstVsSecondMedianMs: median(totalDiffs)
  };
}

function markdownTable(rows, headers) {
  const line = values => "| " + values.join(" | ") + " |";
  return [
    line(headers),
    line(headers.map(() => "---")),
    ...rows.map(row => line(row))
  ].join("\n");
}

function renderAnalysis(rows, inputPath) {
  const allGroups = groupRows(rows).map(groupSummary);
  const setupGroups = allGroups.filter(group => group.id.startsWith("setup-smoke-"));
  const groups = allGroups.filter(group => !group.id.startsWith("setup-smoke-"));
  const accepted = groups.filter(group => group.accepted);
  const rejected = groups.filter(group => !group.accepted);
  const buckets = ["15-30m", "60-120m", ">=6h"];
  const reports = buckets.map(bucket => bucketReport(accepted, bucket));
  const bucketCounts = Object.fromEntries(buckets.map(bucket => [
    bucket,
    accepted.filter(group => group.bucket === bucket).length
  ]));
  const enough =
    accepted.length >= 8
    && accepted.length <= 12
    && bucketCounts["15-30m"] >= 2
    && bucketCounts["60-120m"] >= 3
    && bucketCounts[">=6h"] >= 2;
  const status = enough ? "sufficient_evidence" : "insufficient_evidence";
  const individualRows = allGroups.flatMap(group => group.rows.map(row => [
    group.id,
    group.id.startsWith("setup-smoke-") ? "setup_smoke" : (group.accepted ? "accepted" : "rejected"),
    row.target_idle_bucket || "unknown",
    row.request_order || "—",
    row.query_variant || "—",
    row.rag_call_index || "0",
    row.observability_stage || "—",
    row.request_id || "—",
    row.outcome || "—",
    row.retrieval_total_ms || "—",
    row.aborted_stage || "—",
    row.notes || "—"
  ]));
  const summaryRows = reports.flatMap(report => [
    [report.bucket, "esimene", report.groups, report.first],
    [report.bucket, "järgmine", report.groups, report.second]
  ]).map(([bucket, order, groupCount, result]) => [
    bucket,
    order,
    groupCount,
    result.runs,
    result.successful,
    result.aborts,
    result.httpErrors,
    result.sourceCountZero,
    formatNumber(result.embeddingP50),
    formatNumber(result.embeddingMax),
    formatNumber(result.retrievalP50),
    formatNumber(result.retrievalMax),
    formatNumber(result.totalP50),
    formatNumber(result.totalMax),
    result.over10s,
    result.atOrOver12s,
    formatNumber(result.embeddingShareP50),
    formatNumber(result.retrievalShareP50),
    result.correlationErrors
  ]);
  const dateValues = allGroups.flatMap(group => group.rows.map(row => row.timestamp_eest).filter(Boolean)).sort();
  const lines = [
    "# B0 idle-RAG mõõtmisakna analüüs",
    "",
    "Staatus: " + status,
    "",
    "Sisend: " + inputPath + ".",
    "Analüüs kasutab ainult CSV tehnilisi välju; päringu- ega allikasisu ei ole kaasatud.",
    "",
    "## Valim",
    "",
    "- Mõõtmisperiood: " + (dateValues[0] || "—") + " kuni " + (dateValues.at(-1) || "—") + ".",
    "- Setup-smoke mõõtegrupid: " + setupGroups.length,
    "- Kõik mõõtegrupid: " + groups.length,
    "- Aktsepteeritud mõõtegrupid: " + accepted.length,
    "- Tagasilükatud mõõtegrupid: " + rejected.length,
    "- Bucketid: 15–30 min " + bucketCounts["15-30m"] + ", 60–120 min "
      + bucketCounts["60-120m"] + ", vähemalt 6 h " + bucketCounts[">=6h"] + ".",
    "",
    "Setup-smoke ridu ei loeta valimisse. Tagasilükatud grupid jäävad alles ning nende põhjused",
    "on tehniliste märkmetena tabelis.",
    "",
    "## Bucketite kokkuvõte",
    "",
    markdownTable(summaryRows, [
      "Bucket", "Jooks", "Grupid", "Jookse", "Edukad", "Abordid", "HTTP errorid", "Allikaid 0",
      "Emb p50", "Emb max", "Ret p50", "Ret max", "Total p50", "Total max",
      ">10 s", ">=12 s", "Emb/total p50", "Ret/total p50", "Korrelatsioonivead"
    ]),
    "",
    "Kestused on millisekundites; osakaalud on suhtarvud.",
    "Esimese ja järgmise native päringu total-aja mediaanne erinevus (järgmine miinus esimene): "
      + reports.map(report => report.bucket + " " + formatNumber(report.firstVsSecondMedianMs) + " ms").join(", ") + ".",
    "",
    "## Individuaalsed tehnilised jooksud",
    "",
    markdownTable(individualRows, [
      "Grupp", "Liik", "Bucket", "Järjekord", "Variant", "RAG indeks",
      "Stage", "Request-ID", "Outcome", "Total", "Abort", "Märkmed"
    ]),
    "",
    "## Tõlgenduse piirid",
    "",
    "- Esimese päringu idle-väärtus pärineb native rag_search timingust.",
    "- P95 ei ole väikese valimi tõttu tugev statistiline tõend.",
    "- Tulemust ei üldistata kõigile kasutajatele.",
    "- Setup-smoke, tagasilükatud ja aktsepteeritud grupid on eristatud.",
    "- B0 otsus tehakse eraldi otsusefailis pärast selle analüüsi ülevaatamist.",
    ""
  ];
  return lines.join("\n");
}

async function main() {
  const inputPath = argValue("--input", "docs/internal/b0-idle-rag-measurements.csv");
  const outputPath = argValue("--output", "docs/internal/b0-idle-rag-analysis.md");
  const rows = parseCsv(await readFile(inputPath, "utf8"));
  await writeFile(outputPath, renderAnalysis(rows, inputPath));
  console.log(JSON.stringify({
    event: "b0_idle_analysis_written",
    input_rows: rows.length,
    output_path: outputPath
  }));
}

main().catch(error => {
  console.error(JSON.stringify({
    event: "b0_idle_analysis_failed",
    error_code: error?.message || "ANALYSIS_FAILED"
  }));
  process.exitCode = 1;
});
