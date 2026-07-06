export const KOV_ADMIN_STATUS_VALUES = Object.freeze([
  "NOT_STARTED",
  "DRAFT",
  "READY_FOR_INGEST",
  "INGESTED",
  "NEEDS_REVIEW"
]);

export const KOV_RT_STATUS_VALUES = Object.freeze([
  "NOT_STARTED",
  "DRAFT",
  "NEEDS_REVIEW",
  "READY"
]);

export const KOV_INGEST_STATUS_VALUES = Object.freeze([
  "NOT_INGESTED",
  "READY",
  "INGESTING",
  "INGESTED",
  "ERROR"
]);

export const KOV_FILE_ROLE_META = Object.freeze({
  sourcesJson: {
    dbRole: "SOURCES_JSON",
    paramRole: "sources-json",
    fileNamePattern: "{slug}.sources.json",
    label: "sources.json",
    layer: "KOV_WEB"
  },
  dataJson: {
    dbRole: "DATA_JSON",
    paramRole: "data-json",
    fileNamePattern: "{slug}.json",
    label: "json",
    layer: "KOV_WEB"
  },
  metaJson: {
    dbRole: "META_JSON",
    paramRole: "meta-json",
    fileNamePattern: "{slug}.meta.json",
    label: "meta.json",
    layer: "KOV_WEB"
  },
  ragMd: {
    dbRole: "RAG_MD",
    paramRole: "rag-md",
    fileNamePattern: "{slug}.rag.md",
    label: "rag.md",
    layer: "KOV_WEB"
  },
  rtJson: {
    dbRole: "RT_JSON",
    paramRole: "rt-json",
    fileNamePattern: "{slug}.rt.json",
    label: "rt.json",
    layer: "RT"
  },
  rtMd: {
    dbRole: "RT_MD",
    paramRole: "rt-md",
    fileNamePattern: "{slug}.rt.md",
    label: "rt.md",
    layer: "RT"
  },
  rtXml: {
    dbRole: "RT_XML",
    paramRole: "rt-xml",
    fileNamePattern: "{slug}.rt.xml",
    label: "rt.xml",
    layer: "RT"
  }
});

export const KOV_FILE_KEYS = Object.freeze(Object.keys(KOV_FILE_ROLE_META));
export const KOV_WEB_FILE_KEYS = Object.freeze(KOV_FILE_KEYS.filter(key => KOV_FILE_ROLE_META[key].layer === "KOV_WEB"));
export const KOV_RT_FILE_KEYS = Object.freeze(["rtXml"]);

const KOV_PARAM_ROLE_TO_KEY = Object.freeze(
  Object.fromEntries(KOV_FILE_KEYS.map(key => [KOV_FILE_ROLE_META[key].paramRole, key]))
);

export const KOV_DB_ROLE_TO_KEY = Object.freeze(
  Object.fromEntries(KOV_FILE_KEYS.map(key => [KOV_FILE_ROLE_META[key].dbRole, key]))
);

export function resolveKovFileKeyFromParam(paramRole = "") {
  return KOV_PARAM_ROLE_TO_KEY[String(paramRole || "").trim()] || null;
}

export function resolveKovFileKeyFromDbRole(dbRole = "") {
  return KOV_DB_ROLE_TO_KEY[String(dbRole || "").trim()] || null;
}
