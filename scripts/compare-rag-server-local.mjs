import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const serverFile = path.join(root, "docs", "Andmebaas", "RAG", "rag_server_documents.json");
const outputDir = path.dirname(serverFile);

const localRoots = [
  path.join(root, "docs", "Andmebaas", "ajakiri_sotsiaaltoo"),
  path.join(root, "docs", "Andmebaas", "allikaregister"),
  path.join(root, "docs", "Andmebaas", "KOV"),
  path.join(root, "docs", "Andmebaas", "organisatsioonid"),
  path.join(root, "docs", "Andmebaas", "RAG", "legacy_metadata"),
  path.join(root, "docs", "Andmebaas", "RAG", "master_sources_pdf"),
  path.join(root, "docs", "Andmebaas", "Seadused_rt"),
  path.join(root, "docs", "Andmebaas", "uuringud ja juhendid"),
];

const toRelative = (value) => path.relative(root, value).replaceAll("\\", "/");
const normalizeUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
};
const normalizeTitle = (value) =>
  typeof value === "string"
    ? value.normalize("NFKC").toLocaleLowerCase("et").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    : "";
const unique = (values) => [...new Set(values.filter(Boolean))].sort();

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const result = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(full)));
    else result.push(full);
  }
  return result;
}

function addToIndex(index, key, evidence) {
  if (!key) return;
  const list = index.get(key) ?? [];
  list.push(evidence);
  index.set(key, list);
}

const allFiles = (await Promise.all(localRoots.map(walk))).flat();
const filesByName = new Map();
for (const file of allFiles) {
  const key = path.basename(file).toLocaleLowerCase("et");
  addToIndex(filesByName, key, file);
}

const idIndex = new Map();
const urlIndex = new Map();
const titleIndex = new Map();
const jsonCache = new Map();

function directStrings(object, names) {
  return unique(names.map((name) => object?.[name]).filter((value) => typeof value === "string"));
}

async function relatedContentPaths(object, jsonFile) {
  const candidates = [];
  const siblingNames = directStrings(object, [
    "source_path",
    "sourcePath",
    "ragTextFile",
    "content_file",
    "contentFile",
    "xml_file",
  ]);
  for (const name of siblingNames) {
    const sibling = path.resolve(path.dirname(jsonFile), name);
    if (await exists(sibling)) candidates.push(sibling);
    const byName = filesByName.get(path.basename(name).toLocaleLowerCase("et")) ?? [];
    candidates.push(...byName);
  }
  if (jsonFile.endsWith(".metadata.json")) {
    const pdf = jsonFile.slice(0, -".metadata.json".length) + ".pdf";
    if (await exists(pdf)) candidates.push(pdf);
  }
  return unique(candidates.map(toRelative));
}

async function indexObject(value, jsonFile, registryOnly = false) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) await indexObject(item, jsonFile, registryOnly);
    return;
  }

  const ids = directStrings(value, ["docId", "document_id", "source_id", "sourceId"]);
  const urls = directStrings(value, [
    "url",
    "source_url",
    "sourceUrl",
    "url_canonical",
    "urlCanonical",
    "officialUrl",
    "act_url",
  ]).map(normalizeUrl);
  const titles = directStrings(value, ["title", "name", "act_title", "organization_name"]).map(
    normalizeTitle,
  );
  const contentPaths = registryOnly ? [] : await relatedContentPaths(value, jsonFile);
  const evidence = {
    recordPath: toRelative(jsonFile),
    contentPaths,
    registryOnly,
    titles,
  };
  for (const id of ids) addToIndex(idIndex, id, evidence);
  for (const url of urls) addToIndex(urlIndex, url, evidence);
  for (const title of titles) addToIndex(titleIndex, title, evidence);

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") await indexObject(child, jsonFile, registryOnly);
  }
}

for (const jsonFile of allFiles.filter((file) => file.toLowerCase().endsWith(".json"))) {
  try {
    const parsed = JSON.parse(await fs.readFile(jsonFile, "utf8"));
    jsonCache.set(jsonFile, parsed);
    const registryOnly = path.basename(jsonFile) === "master_sources_final.json";
    await indexObject(parsed, jsonFile, registryOnly);
  } catch {
    // Invalid or non-JSON files are irrelevant to this source comparison.
  }
}

const specialized = new Map();
const journalTitleEvidence = new Map();
function addSpecialized(docId, kind, matchedBy, localPaths) {
  if (!docId) return;
  specialized.set(docId, {
    kind,
    matchedBy,
    localPaths: unique(localPaths),
  });
}

// Sotsiaaltöö server IDs combine issue docId and articleId.
for (const [jsonFile, value] of jsonCache) {
  if (!toRelative(jsonFile).startsWith("docs/Andmebaas/ajakiri_sotsiaaltoo/")) continue;
  if (!value?.docId || !value?.articleId) continue;
  const content = await relatedContentPaths(value, jsonFile);
  const evidence = {
    kind: content.length ? "original" : "structured",
    matchedBy: "journal_issue_and_article_id",
    localPaths: unique([toRelative(jsonFile), ...content]),
  };
  specialized.set(`${value.docId}-${value.articleId}`, evidence);
  const titleKey = normalizeTitle(value.title);
  if (titleKey) {
    const matches = journalTitleEvidence.get(titleKey) ?? [];
    matches.push(evidence);
    journalTitleEvidence.set(titleKey, matches);
  }
}

// KOV server IDs wrap each local package item ID in kov::<slug>::item::<id>.
for (const [jsonFile, value] of jsonCache) {
  const relative = toRelative(jsonFile);
  const match = relative.match(/^docs\/Andmebaas\/KOV\/([^/]+)\/\1\.json$/);
  if (!match || !Array.isArray(value?.items)) continue;
  const prefixes = unique([match[1], value.municipality_id]);
  for (const topLevelId of unique([value.docId, value.document_id])) {
    addSpecialized(topLevelId, "structured", "kov_package_document_id", [relative]);
  }
  for (const prefix of prefixes) {
    addSpecialized(
      `kov::${prefix}::bundle`,
      "structured",
      "kov_local_bundle",
      [relative],
    );
  }
  for (const item of value.items) {
    const itemIds = unique([
      item?.id,
      item?.document_id,
      item?.source_id,
      item?.canonical_item_id,
    ]);
    for (const itemId of itemIds) {
      for (const prefix of prefixes) {
        addSpecialized(
          `kov::${prefix}::item::${itemId}`,
          "structured",
          "kov_package_and_item_id",
          [relative],
        );
      }
    }
  }
}

// KOV legal documents map directly from the local RT manifest to their XML originals.
const kovManifestFile = path.join(root, "docs", "Andmebaas", "KOV", "kov_rt", "kov_rt_manifest.json");
if (jsonCache.has(kovManifestFile)) {
  for (const entry of jsonCache.get(kovManifestFile).entries ?? []) {
    const xmlMatches = filesByName.get(String(entry.xml_file ?? "").toLocaleLowerCase("et")) ?? [];
    addSpecialized(
      entry.rt_doc_id,
      xmlMatches.length ? "original" : "metadata",
      "kov_rt_manifest_doc_id",
      [toRelative(kovManifestFile), ...xmlMatches.map(toRelative)],
    );
  }
}

// The organization profile is ingested from the local RAG text file.
const astanguRag = path.join(root, "docs", "Andmebaas", "organisatsioonid", "astangu.rag.md");
if (await exists(astanguRag)) {
  addSpecialized("organization-astangu", "structured", "organization_ingest_id", [
    toRelative(astanguRag),
  ]);
}

// National RT IDs include the act reference; require a local XML/AKT file with that basename.
for (const [name, matches] of filesByName) {
  const reference = name.match(/^(\d{12})\.(?:xml|akt)$/i)?.[1];
  if (reference) {
    addSpecialized(
      `national-rt-${reference}`,
      "original",
      "national_rt_reference",
      matches.map(toRelative),
    );
  }
}

const serverPayload = JSON.parse(await fs.readFile(serverFile, "utf8"));
const allServerDocuments = serverPayload.documents ?? serverPayload;
const isDeletedDocument = (document) =>
  String(document?.lifecycleState ?? document?.status ?? "").trim().toUpperCase() === "DELETED";
const deletedServerDocuments = allServerDocuments.filter(isDeletedDocument);
const serverDocuments = allServerDocuments.filter((document) => !isDeletedDocument(document));

function pathsFromEvidence(evidence) {
  return unique(evidence.flatMap((item) => [item.recordPath, ...item.contentPaths]));
}

function classify(document) {
  const special = specialized.get(document.docId);
  if (special) {
    return {
      status:
        special.kind === "original"
          ? "LOCAL_ORIGINAL_ID"
          : special.kind === "structured"
            ? "LOCAL_STRUCTURED_ID"
            : "LOCAL_METADATA_ONLY",
      matchedBy: special.matchedBy,
      localPaths: special.localPaths,
    };
  }

  if (document.collection_id === "sotsiaaltoo_articles") {
    const journalMatches = journalTitleEvidence.get(normalizeTitle(document.title)) ?? [];
    if (journalMatches.length === 1) {
      return {
        status:
          journalMatches[0].kind === "original"
            ? "LOCAL_ORIGINAL_TITLE"
            : "LOCAL_STRUCTURED_TITLE",
        matchedBy: "unique_journal_title",
        localPaths: journalMatches[0].localPaths,
      };
    }
  }

  const exact = idIndex.get(document.docId) ?? [];
  const exactWithContent = exact.filter((item) => item.contentPaths.length > 0);
  if (exactWithContent.length) {
    return {
      status: "LOCAL_ORIGINAL_ID",
      matchedBy: "exact_document_or_source_id",
      localPaths: pathsFromEvidence(exactWithContent),
    };
  }
  const urlMatches = urlIndex.get(normalizeUrl(document.url)) ?? [];
  if (document.collection_id === "kov_services") {
    const documentTitle = normalizeTitle(document.title);
    const structuredUrlTitleMatches = urlMatches.filter(
      (item) =>
        !item.registryOnly &&
        item.titles.includes(documentTitle) &&
        (/^docs\/Andmebaas\/KOV\/([^/]+)\/\1\.json$/.test(item.recordPath) ||
          item.recordPath === "docs/Andmebaas/KOV/kov_kontaktid_loplik.json"),
    );
    if (structuredUrlTitleMatches.length) {
      return {
        status: "LOCAL_STRUCTURED_URL_TITLE",
        matchedBy: "kov_normalized_url_and_title",
        localPaths: pathsFromEvidence(structuredUrlTitleMatches),
      };
    }
  }
  const urlWithContent = urlMatches.filter((item) => item.contentPaths.length > 0);
  if (urlWithContent.length) {
    return {
      status: "LOCAL_ORIGINAL_URL",
      matchedBy: "normalized_url",
      localPaths: pathsFromEvidence(urlWithContent),
    };
  }
  if (exact.length) {
    return {
      status: "LOCAL_METADATA_ONLY",
      matchedBy: "exact_id_without_local_source_content",
      localPaths: pathsFromEvidence(exact),
    };
  }
  if (urlMatches.length) {
    return {
      status: "LOCAL_METADATA_ONLY",
      matchedBy: "normalized_url_without_local_source_content",
      localPaths: pathsFromEvidence(urlMatches),
    };
  }

  return { status: "NOT_FOUND", matchedBy: "none", localPaths: [] };
}

const rows = serverDocuments.map((document) => ({
  ...document,
  ...classify(document),
  byteIdenticalToServerProven: false,
}));

const fullStatuses = new Set([
  "LOCAL_ORIGINAL_ID",
  "LOCAL_STRUCTURED_ID",
  "LOCAL_ORIGINAL_URL",
  "LOCAL_ORIGINAL_TITLE",
  "LOCAL_STRUCTURED_TITLE",
  "LOCAL_STRUCTURED_URL_TITLE",
]);
const summary = {
  generatedAt: new Date().toISOString(),
  serverInventory: toRelative(serverFile),
  serverDocuments: rows.length,
  serverRegistryDocuments: allServerDocuments.length,
  deletedTombstonesExcluded: deletedServerDocuments.length,
  localFullContent: rows.filter((row) => fullStatuses.has(row.status)).length,
  localMetadataOnly: rows.filter((row) => row.status === "LOCAL_METADATA_ONLY").length,
  notFound: rows.filter((row) => row.status === "NOT_FOUND").length,
  byteIdenticalToServerProven: 0,
  limitation:
    "Server inventory has no content hashes or full text, so ID/URL matches do not prove byte-identical content.",
};

const collections = [...new Set(rows.map((row) => row.collection_id))]
  .map((collectionId) => {
    const collectionRows = rows.filter((row) => row.collection_id === collectionId);
    return {
      collection_id: collectionId,
      server: collectionRows.length,
      local_full_content: collectionRows.filter((row) => fullStatuses.has(row.status)).length,
      metadata_only: collectionRows.filter((row) => row.status === "LOCAL_METADATA_ONLY").length,
      not_found: collectionRows.filter((row) => row.status === "NOT_FOUND").length,
    };
  })
  .sort((a, b) => b.server - a.server || a.collection_id.localeCompare(b.collection_id));

const report = { summary, collections, documents: rows };
await fs.writeFile(
  path.join(outputDir, "rag_local_coverage_report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const csvColumns = [
  "docId",
  "title",
  "collection_id",
  "source_type",
  "chunks",
  "url",
  "status",
  "matchedBy",
  "localPaths",
];
const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
};
const csv = [
  csvColumns.map(csvCell).join(","),
  ...rows.map((row) => csvColumns.map((column) => csvCell(row[column])).join(",")),
].join("\n");
await fs.writeFile(path.join(outputDir, "rag_local_coverage_report.csv"), `${csv}\n`, "utf8");

const missing = rows.filter((row) => !fullStatuses.has(row.status));
const markdown = [
  "# RAG serveri ja kohalike allikate võrdlus",
  "",
  `Koostatud: ${summary.generatedAt}`,
  "",
  `- Serveris: **${summary.serverDocuments}** dokumenti`,
  `- Kohalik täissisu või struktureeritud algsisu: **${summary.localFullContent}**`,
  `- Ainult kohalik metaandmevaste: **${summary.localMetadataOnly}**`,
  `- Kohalikku vastet ei leitud: **${summary.notFound}**`,
  "- Baithaaval identsus serveriga: **tõendamata**, sest serveriloendis pole räsi ega täisteksti.",
  "",
  "## Kogude kaupa",
  "",
  "| Kogu | Serveris | Kohalik täissisu | Ainult metaandmed | Vasteta |",
  "|---|---:|---:|---:|---:|",
  ...collections.map(
    (item) =>
      `| ${item.collection_id} | ${item.server} | ${item.local_full_content} | ${item.metadata_only} | ${item.not_found} |`,
  ),
  "",
  "## Puuduvad või ainult metaandmetega kirjed",
  "",
  ...(missing.length
    ? missing.map(
        (row) =>
          `- \`${row.docId}\` — ${row.title} — **${row.status}** (${row.matchedBy})`,
      )
    : ["Puuduvad kirjed puuduvad."]),
  "",
].join("\n");
await fs.writeFile(path.join(outputDir, "rag_local_coverage_report.md"), markdown, "utf8");

console.log(JSON.stringify({ summary, collections, unresolved: missing.length }, null, 2));
