import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ragDir = path.join(root, "docs", "Andmebaas", "RAG");
const readJson = async (...parts) =>
  JSON.parse(await fs.readFile(path.join(root, ...parts), "utf8"));

const coverage = await readJson("docs", "Andmebaas", "RAG", "rag_local_coverage_report.json");
const downloads = await readJson("docs", "Andmebaas", "RAG", "master_sources_pdf_report.json");
const inventory = await readJson("docs", "Andmebaas", "RAG", "master_sources_server.state.json");
const master = await readJson(
  "docs",
  "Andmebaas",
  "allikaregister",
  "master_sources_final.json",
);

const masterById = new Map(master.map((source) => [source.source_id, source]));
const downloadById = new Map(downloads.results.map((result) => [result.source_id, result]));
const inventorySources = Object.values(inventory.sources);
const fullStatuses = new Set([
  "LOCAL_ORIGINAL_ID",
  "LOCAL_STRUCTURED_ID",
  "LOCAL_ORIGINAL_URL",
  "LOCAL_ORIGINAL_TITLE",
  "LOCAL_STRUCTURED_TITLE",
  "LOCAL_STRUCTURED_URL_TITLE",
]);
const secondaryStatuses = new Set([
  "LOCAL_ORIGINAL_URL",
  "LOCAL_ORIGINAL_TITLE",
  "LOCAL_STRUCTURED_TITLE",
  "LOCAL_STRUCTURED_URL_TITLE",
]);

const localGaps = coverage.documents.filter((document) => !fullStatuses.has(document.status));
const idDrift = coverage.documents.filter((document) => secondaryStatuses.has(document.status));
const missingFromServer = inventorySources.filter((source) => source.match_status === "missing");
const zeroChunks = inventorySources.filter((source) => source.match_status === "incomplete");
const zeroChunkDocuments = coverage.documents.filter((document) => document.chunks === 0);
const multipleMatches = inventorySources.filter((source) =>
  source.anomalies.includes("multiple_rag_matches"),
);
const missingMasterIdentity = inventorySources.filter((source) =>
  source.anomalies.includes("rag_match_missing_source_master_identity"),
);
const failedDownloads = downloads.results.filter((result) => result.status === "DOWNLOAD_FAILED");

const asText = (value) => (Array.isArray(value) ? value.join(" | ") : String(value ?? ""));
const escapeCell = (value) => asText(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (value) => `\`${String(value ?? "").replaceAll("`", "\\`")}\``;
const sourceDetails = (inventorySource) => {
  const source = masterById.get(inventorySource.source_id) ?? {};
  const download = downloadById.get(inventorySource.source_id);
  return {
    source_id: inventorySource.source_id,
    title: source.title ?? "",
    format: source.source_format ?? "",
    url: source.url ?? inventorySource.registry_identity_url ?? "",
    server_status: inventorySource.match_status,
    matched_document_ids: inventorySource.evidence?.matched_document_ids ?? [],
    local_status:
      source.source_format === "html"
        ? "NO_RAW_HTML_SNAPSHOT"
        : download?.status ?? "NOT_CHECKED",
    details: download?.error ?? "",
  };
};

const categories = [
  {
    category: "CONFIRMED_MISSING_LOCAL",
    severity: "high",
    rows: localGaps
      .filter((document) => document.status === "NOT_FOUND")
      .map((document) => ({
        id: document.docId,
        title: document.title,
        format: document.source_type,
        url: document.url,
        server_status: "PRESENT",
        local_status: document.status,
        details: document.matchedBy,
      })),
  },
  {
    category: "LOCAL_METADATA_ONLY",
    severity: "high",
    rows: localGaps
      .filter((document) => document.status === "LOCAL_METADATA_ONLY")
      .map((document) => ({
        id: document.docId,
        title: document.title,
        format: document.source_type,
        url: document.url,
        server_status: "PRESENT",
        local_status: document.status,
        details: `${document.matchedBy}; ${document.localPaths.join(" | ")}`,
      })),
  },
  {
    category: "SERVER_ZERO_CHUNK_SOURCES",
    severity: "high",
    rows: zeroChunks.map((item) => {
      const detail = sourceDetails(item);
      return {
        id: detail.source_id,
        title: detail.title,
        format: detail.format,
        url: detail.url,
        server_status: "ZERO_CHUNKS",
        local_status: detail.local_status,
        details: `server docs: ${asText(detail.matched_document_ids)}`,
      };
    }),
  },
  {
    category: "PDF_DOWNLOAD_FAILED",
    severity: "high",
    rows: failedDownloads.map((item) => ({
      id: item.source_id,
      title: item.title,
      format: "pdf",
      url: item.url,
      server_status:
        inventory.sources[item.source_id]?.match_status === "missing" ? "MISSING" : "UNKNOWN",
      local_status: item.status,
      details: item.error,
    })),
  },
  {
    category: "SERVER_DUPLICATE_SOURCE_MATCH",
    severity: "medium",
    rows: multipleMatches.map((item) => {
      const detail = sourceDetails(item);
      return {
        id: detail.source_id,
        title: detail.title,
        format: detail.format,
        url: detail.url,
        server_status: "MULTIPLE_DOCUMENT_IDS",
        local_status: detail.local_status,
        details: asText(detail.matched_document_ids),
      };
    }),
  },
  {
    category: "MASTER_MISSING_FROM_SERVER",
    severity: "info",
    rows: missingFromServer.map((item) => {
      const detail = sourceDetails(item);
      return {
        id: detail.source_id,
        title: detail.title,
        format: detail.format,
        url: detail.url,
        server_status: "MISSING",
        local_status: detail.local_status,
        details: detail.details,
      };
    }),
  },
  {
    category: "ID_DRIFT_STRONG_CONTENT_MATCH",
    severity: "medium",
    rows: idDrift.map((document) => ({
      id: document.docId,
      title: document.title,
      format: document.source_type,
      url: document.url,
      server_status: "PRESENT",
      local_status: document.status,
      details: `${document.matchedBy}; ${document.localPaths.join(" | ")}`,
    })),
  },
  {
    category: "SOURCE_MASTER_IDENTITY_NOT_PROVEN_IN_EXPORT",
    severity: "not_proven",
    rows: missingMasterIdentity.map((item) => {
      const detail = sourceDetails(item);
      return {
        id: detail.source_id,
        title: detail.title,
        format: detail.format,
        url: detail.url,
        server_status: "IDENTITY_FIELD_ABSENT_FROM_EXPORT",
        local_status: detail.local_status,
        details: `server docs: ${asText(detail.matched_document_ids)}`,
      };
    }),
  },
];

const allRows = categories.flatMap(({ category, severity, rows }) =>
  rows.map((row) => ({ category, severity, ...row })),
);

const summary = {
  generated_at: new Date().toISOString(),
  server_documents: coverage.summary.serverDocuments,
  confirmed_local_full_content: coverage.summary.localFullContent,
  confirmed_missing_local: categories[0].rows.length,
  local_metadata_only: categories[1].rows.length,
  server_zero_chunk_sources: zeroChunks.length,
  server_zero_chunk_documents: zeroChunkDocuments.length,
  failed_pdf_downloads: failedDownloads.length,
  duplicate_source_matches: multipleMatches.length,
  master_entries_missing_from_server: missingFromServer.length,
  master_html_missing_from_server: missingFromServer.filter(
    (item) => masterById.get(item.source_id)?.source_format === "html",
  ).length,
  master_pdf_missing_from_server: missingFromServer.filter(
    (item) => masterById.get(item.source_id)?.source_format === "pdf",
  ).length,
  missing_html_referenced_only: missingFromServer.filter((item) => {
    const source = masterById.get(item.source_id);
    return source?.source_format === "html" && source?.ingest_status === "referenced_only";
  }).length,
  missing_html_ingest_candidate: missingFromServer.filter((item) => {
    const source = masterById.get(item.source_id);
    return source?.source_format === "html" && source?.ingest_status === "ingest_candidate";
  }).length,
  missing_pdf_needs_review: missingFromServer.filter((item) => {
    const source = masterById.get(item.source_id);
    return source?.source_format === "pdf" && source?.ingest_status === "needs_review";
  }).length,
  missing_pdf_ingest_candidate: missingFromServer.filter((item) => {
    const source = masterById.get(item.source_id);
    return source?.source_format === "pdf" && source?.ingest_status === "ingest_candidate";
  }).length,
  strong_content_matches_with_id_drift: idDrift.length,
  server_matches_master_identity_not_proven: missingMasterIdentity.length,
  master_matches_freshness_not_proven: inventory.summary.unknown_freshness_evidence,
  raw_html_snapshots: 0,
  note:
    "Categories overlap and must not be added together. Source-master identity and freshness are not proven because the normalized server export omits those fields.",
};

const report = { summary, categories };
await fs.writeFile(
  path.join(ragDir, "rag_missing_and_broken_report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const csvColumns = [
  "category",
  "severity",
  "id",
  "title",
  "format",
  "url",
  "server_status",
  "local_status",
  "details",
];
const csvCell = (value) => `"${asText(value).replaceAll('"', '""')}"`;
await fs.writeFile(
  path.join(ragDir, "rag_missing_and_broken_report.csv"),
  `${[
    csvColumns.map(csvCell).join(","),
    ...allRows.map((row) => csvColumns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n")}\n`,
  "utf8",
);

const table = (rows) => [
  "| ID | Pealkiri | Vorming | Server | Lokaalne | Detail |",
  "|---|---|---|---|---|---|",
  ...rows.map(
    (row) =>
      `| ${code(row.id)} | ${escapeCell(row.title)} | ${escapeCell(row.format)} | ${escapeCell(row.server_status)} | ${escapeCell(row.local_status)} | ${escapeCell(row.details)} |`,
  ),
];

const sections = categories.map(({ category, severity, rows }) => [
  `## ${category} (${rows.length}, ${severity})`,
  "",
  ...table(rows),
  "",
]);
const markdown = [
  "# RAG: kõik puuduvad ja vigased kirjed",
  "",
  `Koostatud: ${summary.generated_at}`,
  "",
  "Kategooriad võivad kattuda. Näiteks katkise lingiga PDF võib olla korraga nii serverist puudu kui ka lokaalselt allalaadimata.",
  "Serveri normaliseeritud eksport ei sisalda source-master päritolu-ID ega last_checked välja. Nende puudumist ekspordis ei käsitleta kinnitatud serveriveana.",
  "",
  "## Kokkuvõte",
  "",
  `- Serveri dokumente: **${summary.server_documents}**`,
  `- Kohalik täissisu: **${summary.confirmed_local_full_content}**`,
  `- Serveris olemas, lokaalselt täiesti puudu: **${summary.confirmed_missing_local}**`,
  `- Serveris olemas, lokaalselt ainult metaandmed: **${summary.local_metadata_only}**`,
  `- Serveris null sisutükiga: **${summary.server_zero_chunk_documents} dokumenti / ${summary.server_zero_chunk_sources} unikaalset allikat**`,
  `- PDF allalaadimine ebaõnnestus: **${summary.failed_pdf_downloads}**`,
  `- Sama allikas mitme serveri dokumendi-ID all: **${summary.duplicate_source_matches}**`,
  `- 323-kirjelisest master-listist serveris puudu: **${summary.master_entries_missing_from_server}** (${summary.master_html_missing_from_server} HTML + ${summary.master_pdf_missing_from_server} PDF)`,
  `  - HTML: ${summary.missing_html_referenced_only} ainult viitena + ${summary.missing_html_ingest_candidate} ingest-kandidaati`,
  `  - PDF: ${summary.missing_pdf_needs_review} ülevaatust vajavat kohalikku faili + ${summary.missing_pdf_ingest_candidate} ingest-kandidaati, mille allalaadimine ebaõnnestus`,
  `- Kohalik sisu olemas, kuid ID ei kattu täpselt: **${summary.strong_content_matches_with_id_drift}**`,
  `- Master-listi päritolu-ID pole ekspordist tõendatav: **${summary.server_matches_master_identity_not_proven}**`,
  `- Värskus pole ekspordist tõendatav: **${summary.master_matches_freshness_not_proven}** master-listi vastel`,
  `- Toor-HTML arhiivifaile: **${summary.raw_html_snapshots}**`,
  "",
  ...sections.flat(),
].join("\n");
await fs.writeFile(path.join(ragDir, "rag_missing_and_broken_report.md"), markdown, "utf8");

console.log(JSON.stringify({ summary, rows: allRows.length }, null, 2));
