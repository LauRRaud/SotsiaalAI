const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])

function required(value, name) {
  const normalized = String(value || "").trim()
  if (!normalized) throw new Error(`${name} is required for the live probe`)
  return normalized
}

function parseUrl(value, name, defaultProtocol = null) {
  const normalized = required(value, name)
  try {
    return new URL(defaultProtocol && !/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
      ? `${defaultProtocol}://${normalized}`
      : normalized)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
}

function assertLoopback(url, name) {
  if (!LOOPBACK_HOSTS.has(String(url.hostname || "").toLowerCase())) {
    throw new Error(`${name} must use a loopback host`)
  }
}

export function assertLocalDocumentRagProbeConfig({
  databaseUrl,
  ragHost,
  ragServiceKey
} = {}) {
  const missing = [
    !String(databaseUrl || "").trim() && "DATABASE_URL",
    !String(ragHost || "").trim() && "RAG_INTERNAL_HOST or RAG_API_BASE",
    !String(ragServiceKey || "").trim() && "RAG_SERVICE_API_KEY"
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`${missing.join(", ")} required for the live probe`)
  }

  const database = parseUrl(databaseUrl, "DATABASE_URL")
  if (!new Set(["postgres:", "postgresql:"]).has(database.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL")
  }
  assertLoopback(database, "DATABASE_URL")

  const rag = parseUrl(ragHost, "RAG_INTERNAL_HOST or RAG_API_BASE", "http")
  if (!new Set(["http:", "https:"]).has(rag.protocol)) {
    throw new Error("RAG_INTERNAL_HOST or RAG_API_BASE must use HTTP")
  }
  assertLoopback(rag, "RAG_INTERNAL_HOST or RAG_API_BASE")
  const serviceKey = required(ragServiceKey, "RAG_SERVICE_API_KEY")
  if (serviceKey.length < 32) {
    throw new Error("RAG_SERVICE_API_KEY must be at least 32 characters")
  }

  return {
    databaseHost: database.hostname,
    ragBaseUrl: rag.toString().replace(/\/$/, "")
  }
}
