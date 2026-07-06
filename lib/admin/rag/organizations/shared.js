export const ORGANIZATION_FILE_ROLE_META = Object.freeze({
  sourcesJson: {
    dbRole: "SOURCES_JSON",
    paramRole: "sources-json",
    label: "sources.json",
    fileNamePattern: "{slug}.sources.json",
    accept: ".json,application/json"
  },
  dataJson: {
    dbRole: "DATA_JSON",
    paramRole: "data-json",
    label: "json",
    fileNamePattern: "{slug}.json",
    accept: ".json,application/json"
  },
  metaJson: {
    dbRole: "META_JSON",
    paramRole: "meta-json",
    label: "meta.json",
    fileNamePattern: "{slug}.meta.json",
    accept: ".json,application/json"
  },
  ragMd: {
    dbRole: "RAG_MD",
    paramRole: "rag-md",
    label: "rag.md",
    fileNamePattern: "{slug}.rag.md",
    accept: ".md,.txt,text/markdown,text/plain"
  },
  attachment: {
    dbRole: "ATTACHMENT",
    paramRole: "attachment",
    label: "attachment",
    fileNamePattern: "{slug}.attachment",
    accept: ".json,.md,.txt,.pdf,.docx,.csv"
  }
});

export const ORGANIZATION_CORE_FILE_KEYS = Object.freeze(["sourcesJson", "dataJson", "metaJson", "ragMd"]);

export function resolveOrganizationFileKeyFromParam(paramRole) {
  const normalized = String(paramRole || "").trim().toLowerCase();
  return Object.entries(ORGANIZATION_FILE_ROLE_META).find(([, meta]) => meta.paramRole === normalized)?.[0] || null;
}

export function resolveOrganizationFileKeyFromDbRole(dbRole) {
  const normalized = String(dbRole || "").trim().toUpperCase();
  return Object.entries(ORGANIZATION_FILE_ROLE_META).find(([, meta]) => meta.dbRole === normalized)?.[0] || null;
}
