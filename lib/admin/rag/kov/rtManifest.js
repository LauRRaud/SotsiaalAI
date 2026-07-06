import fs from "node:fs/promises";
import path from "node:path";

import { parseRtRegulationXml } from "./rtXml.js";

const REQUIRED_METADATA_FIELDS = Object.freeze([
  "docId",
  "municipality_id",
  "municipality_name",
  "slug",
  "collection_id",
  "source_type",
  "source_format",
  "jurisdiction_level",
  "legal_basis",
  "act_reference",
  "act_title",
  "act_url",
  "xml_file",
  "source_status",
  "historical",
  "is_current_version"
]);

function clean(value) {
  return String(value || "").trim();
}

function slugToMunicipalityId(slug) {
  return clean(slug).toLowerCase().replace(/-/g, "_");
}

async function pathExists(filePath) {
  try {
    await fs.access(/*turbopackIgnore: true*/ filePath);
    return true;
  } catch {
    return false;
  }
}

async function listXmlFiles(dirPath) {
  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ dirPath, { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".xml")).map(entry => entry.name).sort();
  } catch {
    return [];
  }
}

function resolveKovRtManifestPath(root = "KOV") {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), root, "kov_rt", "kov_rt_manifest.json");
}

export async function readKovRtManifest(root = "KOV") {
  const manifestPath = resolveKovRtManifestPath(root);
  let manifest;
  try {
    const text = await fs.readFile(/*turbopackIgnore: true*/ manifestPath, "utf8");
    manifest = JSON.parse(text);
  } catch {
    // KOV/kov_rt manifest puudub (nt KOV eemaldatud) -> tuhi manifest, mitte throw.
    manifest = { entries: [] };
  }
  return {
    manifestPath,
    manifest,
    entries: Array.isArray(manifest.entries) ? manifest.entries : []
  };
}

export function findKovRtManifestEntry(manifest, slug) {
  const normalizedSlug = clean(slug).toLowerCase();
  return (Array.isArray(manifest?.entries) ? manifest.entries : []).find(entry => clean(entry.slug).toLowerCase() === normalizedSlug) || null;
}

function buildGeneratedKovRtMetadata(entry = {}, parsedAct = null) {
  const slug = clean(entry.slug).toLowerCase();
  const actReference = clean(entry.act_reference || parsedAct?.actReference);
  const actUrl = clean(entry.act_url) || (actReference ? `https://www.riigiteataja.ee/akt/${actReference}?leiaKehtiv` : "");
  return {
    docId: clean(entry.rt_doc_id) || `kov-rt-${slug}`,
    municipality_id: clean(entry.municipality_id) || slugToMunicipalityId(slug),
    municipality_name: clean(entry.municipality_name || parsedAct?.municipality),
    slug,
    collection_id: clean(entry.collection_id || entry.generated_metadata?.collection_id) || "kov_legal",
    source_type: clean(entry.source_type || entry.generated_metadata?.source_type) || "kov_regulation",
    source_format: clean(entry.source_format || entry.generated_metadata?.source_format) || "xml",
    jurisdiction_level: clean(entry.jurisdiction_level || entry.generated_metadata?.jurisdiction_level) || "MUNICIPALITY",
    legal_basis: entry.legal_basis ?? entry.generated_metadata?.legal_basis ?? true,
    act_reference: actReference,
    act_title: clean(entry.act_title || parsedAct?.actTitle),
    act_url: actUrl,
    xml_file: clean(entry.xml_file),
    source_status: clean(entry.source_status || entry.generated_metadata?.source_status) || (parsedAct?.isCurrentVersion === false ? "inactive" : "active"),
    historical: entry.historical ?? entry.generated_metadata?.historical ?? false,
    is_current_version: entry.is_current_version ?? entry.generated_metadata?.is_current_version ?? parsedAct?.isCurrentVersion ?? true
  };
}

function validateGeneratedKovRtMetadata(metadata = {}) {
  const errors = [];
  for (const field of REQUIRED_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "boolean") continue;
    if (!clean(value)) errors.push(`${field} missing`);
  }
  if (metadata.docId && metadata.slug && metadata.docId !== `kov-rt-${metadata.slug}`) errors.push("docId must be kov-rt-<slug>");
  if (metadata.collection_id !== "kov_legal") errors.push("collection_id must be kov_legal");
  if (metadata.source_type !== "kov_regulation") errors.push("source_type must be kov_regulation");
  if (metadata.source_format !== "xml") errors.push("source_format must be xml");
  if (metadata.jurisdiction_level !== "MUNICIPALITY") errors.push("jurisdiction_level must be MUNICIPALITY");
  if (metadata.legal_basis !== true) errors.push("legal_basis must be true");
  if (metadata.historical !== false) errors.push("historical must be false");
  if (metadata.is_current_version !== true) errors.push("is_current_version must be true");
  if (metadata.act_url && !/^https:\/\/www\.riigiteataja\.ee\/akt\//.test(metadata.act_url)) errors.push("act_url must be Riigi Teataja akt URL");
  return {
    ok: errors.length === 0,
    errors
  };
}

export async function resolveKovRtXmlFile(root = "KOV", entry = {}) {
  const rootPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);
  const slug = clean(entry.slug).toLowerCase();
  const folder = path.join(/*turbopackIgnore: true*/ rootPath, slug);
  const rtFolder = path.join(/*turbopackIgnore: true*/ folder, "rt");
  const sharedRtFolder = path.join(/*turbopackIgnore: true*/ rootPath, "kov_rt");
  const xmlFile = clean(entry.xml_file);
  const warnings = [];
  const errors = [];
  const kovFolderExists = await pathExists(folder);
  if (!kovFolderExists) warnings.push(`KOV folder missing: ${slug}`);

  if (xmlFile) {
    if (kovFolderExists) {
      const flatPath = path.join(/*turbopackIgnore: true*/ folder, xmlFile);
      if (await pathExists(flatPath)) return { status: "ready", xml_found: true, xml_path: flatPath, xml_file: xmlFile, warnings, errors };
      const nestedPath = path.join(/*turbopackIgnore: true*/ rtFolder, xmlFile);
      if (await pathExists(nestedPath)) return { status: "ready", xml_found: true, xml_path: nestedPath, xml_file: xmlFile, warnings, errors };
    }
    const sharedPath = path.join(/*turbopackIgnore: true*/ sharedRtFolder, xmlFile);
    if (await pathExists(sharedPath)) return { status: "ready", xml_found: true, xml_path: sharedPath, xml_file: xmlFile, warnings, errors };
  }

  const flatXml = kovFolderExists ? await listXmlFiles(folder) : [];
  const nestedXml = kovFolderExists ? await listXmlFiles(rtFolder) : [];
  const all = [
    ...flatXml.map(name => ({ name, filePath: path.join(/*turbopackIgnore: true*/ folder, name) })),
    ...nestedXml.map(name => ({ name, filePath: path.join(/*turbopackIgnore: true*/ rtFolder, name) }))
  ];

  if (xmlFile) {
    warnings.push(`Manifest XML not found: ${xmlFile}`);
    if (all.length > 0) warnings.push(`Other XML files present: ${all.map(item => item.name).join(", ")}`);
    return { status: "skipped", xml_found: false, xml_path: null, xml_file: xmlFile, warnings, errors };
  }
  if (all.length === 1) {
    warnings.push("Manifest xml_file missing; single local XML was found but not selected automatically for ingest.");
    return { status: "needs_review", xml_found: true, xml_path: all[0].filePath, xml_file: all[0].name, warnings, errors: ["manifest xml_file missing"] };
  }
  if (all.length > 1) {
    return { status: "needs_review", xml_found: false, xml_path: null, xml_file: "", warnings, errors: [`Multiple XML files found: ${all.map(item => item.name).join(", ")}`] };
  }
  return { status: "skipped", xml_found: false, xml_path: null, xml_file: xmlFile, warnings, errors };
}

export async function auditKovRtManifestEntry(root = "KOV", entry = {}) {
  const xmlResolution = await resolveKovRtXmlFile(root, entry);
  let parsedAct = null;
  const warnings = [...xmlResolution.warnings];
  const errors = [...xmlResolution.errors];

  if (xmlResolution.xml_found && xmlResolution.xml_path) {
    try {
      const xmlText = await fs.readFile(/*turbopackIgnore: true*/ xmlResolution.xml_path, "utf8");
      parsedAct = parseRtRegulationXml(xmlText, {
        municipality: entry.municipality_name,
        sourceFile: xmlResolution.xml_file,
        sourcePath: xmlResolution.xml_path,
        sourceUrl: entry.act_url
      });
    } catch (error) {
      errors.push(`XML parse failed: ${error?.message || error}`);
    }
  }

  const generatedMetadata = buildGeneratedKovRtMetadata(entry, parsedAct);
  const metadataValidation = validateGeneratedKovRtMetadata(generatedMetadata);
  errors.push(...metadataValidation.errors);
  const ready = xmlResolution.status === "ready" && metadataValidation.ok && entry.auto_ingest !== false;
  const deferred = entry.auto_ingest === false && clean(entry.ingest_status).toLowerCase() === "deferred";
  const ingestStatus = deferred ? "deferred" : ready ? "ingest_ready" : errors.length ? "needs_review" : "skipped";

  return {
    municipality_id: generatedMetadata.municipality_id,
    municipality_name: generatedMetadata.municipality_name,
    slug: generatedMetadata.slug,
    web_doc_id: clean(entry.web_doc_id) || `kov-${generatedMetadata.slug}`,
    rt_doc_id: generatedMetadata.docId,
    act_title: generatedMetadata.act_title,
    act_url: generatedMetadata.act_url,
    act_reference: generatedMetadata.act_reference,
    xml_file: generatedMetadata.xml_file,
    xml_found: xmlResolution.xml_found,
    xml_path: xmlResolution.xml_path,
    generated_metadata_valid: metadataValidation.ok,
    generated_metadata: generatedMetadata,
    auto_ingest: entry.auto_ingest === true,
    ingest_status: ingestStatus,
    warnings,
    errors,
    rag_payload_preview: {
      doc_id: generatedMetadata.docId,
      metadata: generatedMetadata,
      xml_source: xmlResolution.xml_path || generatedMetadata.xml_file || null
    }
  };
}

export async function validateKovRtSlug(root = "KOV", slug = "") {
  const { manifest, manifestPath } = await readKovRtManifest(root);
  const entry = findKovRtManifestEntry(manifest, slug);
  const rootPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);
  const normalizedSlug = clean(slug).toLowerCase();
  const kovFolder = path.join(/*turbopackIgnore: true*/ rootPath, normalizedSlug);
  const coreFiles = ["sources.json", "json", "meta.json", "rag.md"].map(suffix => `${normalizedSlug}.${suffix}`);
  const coreFileResults = {};
  for (const fileName of coreFiles) coreFileResults[fileName] = await pathExists(path.join(/*turbopackIgnore: true*/ kovFolder, fileName));

  if (!entry) {
    return {
      ok: false,
      manifestPath,
      slug: normalizedSlug,
      kov_folder_exists: await pathExists(kovFolder),
      core_files: coreFileResults,
      manifest_entry_found: false,
      rt_ready_status: "needs_review",
      warnings: [],
      errors: ["RT manifest entry missing"]
    };
  }

  const audit = await auditKovRtManifestEntry(root, entry);
  return {
    ok: audit.errors.length === 0 && audit.xml_found && audit.generated_metadata_valid,
    manifestPath,
    slug: normalizedSlug,
    kov_folder_exists: await pathExists(kovFolder),
    core_files: coreFileResults,
    manifest_entry_found: true,
    xml_found: audit.xml_found,
    xml_path: audit.xml_path,
    generated_metadata_valid: audit.generated_metadata_valid,
    rt_ready_status: audit.ingest_status,
    audit
  };
}
