import { prisma as defaultPrisma } from "../prisma.js";

const DEFAULT_RAG_BASE_URL = normalizeRagBaseUrl(
  process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000"
);

const SOCIAL_KEYWORDS = [
  "sotsiaal",
  "hoolekan",
  "hooldus",
  "laste",
  "perede",
  "heaolu",
  "lastekaitse",
  "tugi",
  "puue",
  "erivajad",
  "toimetulek",
  "eluaseme",
  "turvakodu",
  "varjupaik"
];

function clean(value) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized || null;
}

function cleanDate(value) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRagBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/u, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  return /^https?:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function buildKovRagDocId(slug) {
  return `kov::${String(slug || "").trim().toLowerCase()}::bundle`;
}

function resolveKovRagDocId(row = {}) {
  const storedDocId = clean(row?.ragDocId);
  if (storedDocId?.startsWith("kov::")) return storedDocId;
  return buildKovRagDocId(row?.municipality?.slug || storedDocId?.replace(/^kov-/u, ""));
}

function legacyKovRagDocIdCandidates(row = {}) {
  const primary = resolveKovRagDocId(row);
  const slug = clean(row?.municipality?.slug)?.toLowerCase();
  const candidates = [primary];
  if (slug?.includes("-")) candidates.push(buildKovRagDocId(slug.replace(/-/gu, "_")));
  return [...new Set(candidates.filter(Boolean))];
}

function metadataOf(chunk = {}) {
  return chunk.metadata && typeof chunk.metadata === "object"
    ? chunk.metadata
    : chunk.metadatas && typeof chunk.metadatas === "object"
      ? chunk.metadatas
      : {};
}

function valueFrom(metadata, ...keys) {
  for (const key of keys) {
    const value = clean(metadata?.[key]);
    if (value) return value;
  }
  return null;
}

function isSocialContact(metadata = {}) {
  const haystack = [
    metadata.title,
    metadata.contact_name,
    metadata.contact_role,
    metadata.contact_department,
    metadata.section,
    metadata.official_url,
    metadata.source_url
  ]
    .join(" ")
    .toLocaleLowerCase("et");
  return SOCIAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function descriptionForRagContact(chunk = {}) {
  const metadata = metadataOf(chunk);
  const lines = [
    valueFrom(metadata, "summary", "description"),
    valueFrom(metadata, "contact_role", "role") ? `Roll: ${valueFrom(metadata, "contact_role", "role")}` : null,
    valueFrom(metadata, "contact_department", "department") ? `Osakond: ${valueFrom(metadata, "contact_department", "department")}` : null
  ].filter(Boolean);
  return lines.join("\n").slice(0, 8_000) || null;
}

function stableKovRagContactEntryId(metadata = {}, chunk = {}) {
  const docId = valueFrom(metadata, "doc_id", "docId") || valueFrom(chunk, "doc_id", "docId") || "kov";
  const itemId = valueFrom(metadata, "item_id", "itemId", "source_id", "sourceId") || valueFrom(chunk, "id") || "contact";
  return `kov-contact-${normalizeSlug(docId)}-${normalizeSlug(itemId)}`.slice(0, 180);
}

export function mapKovRagContactChunkToServiceMapEntry(chunk = {}, { municipality = null } = {}) {
  const metadata = metadataOf(chunk);
  const address = valueFrom(metadata, "contact_address", "address", "normalized_address", "normalizedAddress");
  const website = valueFrom(metadata, "official_url", "officialUrl", "source_url", "sourceUrl", "url");
  const sourceDocId = valueFrom(metadata, "doc_id", "docId");

  return {
    id: stableKovRagContactEntryId(metadata, chunk),
    type: isSocialContact(metadata) ? "KOV_SOCIAL_CONTACT" : "KOV_GENERAL_CONTACT",
    title: valueFrom(metadata, "title", "contact_name", "name") || "KOV kontakt",
    description: descriptionForRagContact(chunk),
    municipalityId: municipality?.id || null,
    municipalityName:
      valueFrom(metadata, "municipality_name", "municipalityName", "municipality") ||
      clean(municipality?.displayName),
    county: valueFrom(metadata, "county") || clean(municipality?.county),
    address,
    normalizedAddress: valueFrom(metadata, "normalized_address", "normalizedAddress") || address,
    phone: valueFrom(metadata, "contact_phone", "phone"),
    email: valueFrom(metadata, "contact_email", "email")?.toLowerCase() || null,
    website,
    sourceUrl: website,
    sourceDocId,
    checkedAt: cleanDate(valueFrom(metadata, "checked_at", "checkedAt", "last_checked", "lastChecked")),
    status: "NEEDS_REVIEW",
    geocodingStatus: address ? "PENDING" : "FAILED"
  };
}

function isServiceProviderRagDocument(document = {}) {
  const sourceType = valueFrom(document, "source_type", "sourceType");
  const organizationType = valueFrom(document, "organization_type", "organizationType", "type");
  return sourceType === "organization_profile" && organizationType === "service_provider";
}

function stableServiceProviderRagEntryId(document = {}) {
  const docId = valueFrom(document, "doc_id", "docId", "id") || valueFrom(document, "organization_slug", "slug") || "provider";
  return `service-provider-rag-${normalizeSlug(docId)}`.slice(0, 180);
}

export function mapServiceProviderRagDocumentToServiceMapEntry(document = {}) {
  const address = valueFrom(document, "contact_address", "address", "normalized_address", "normalizedAddress");
  const website = valueFrom(
    document,
    "official_website",
    "officialWebsite",
    "official_url",
    "officialUrl",
    "source_url",
    "sourceUrl",
    "url"
  );
  const sourceDocId = valueFrom(document, "doc_id", "docId", "id");

  return {
    id: stableServiceProviderRagEntryId(document),
    type: "SERVICE_PROVIDER",
    title: valueFrom(document, "organization_name", "organizationName", "title") || "Teenuseosutaja",
    description: valueFrom(document, "description", "focus", "scope"),
    municipalityId: null,
    municipalityName: null,
    county: valueFrom(document, "county", "region"),
    address,
    normalizedAddress: valueFrom(document, "normalized_address", "normalizedAddress") || address,
    phone: valueFrom(document, "contact_phone", "phone"),
    email: valueFrom(document, "contact_email", "email")?.toLowerCase() || null,
    website,
    sourceUrl: website,
    sourceDocId,
    checkedAt: cleanDate(valueFrom(document, "checked_at", "checkedAt", "last_checked", "lastChecked")),
    status: "NEEDS_REVIEW",
    geocodingStatus: address ? "PENDING" : "FAILED"
  };
}

export function createRagServiceMapClient({
  baseUrl = DEFAULT_RAG_BASE_URL,
  apiKey = process.env.RAG_SERVICE_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  const normalizedBaseUrl = normalizeRagBaseUrl(baseUrl);
  const normalizedApiKey = clean(apiKey);
  return {
    async listDocumentChunks(docId, { itemType = "", sourceType = "" } = {}) {
      if (!normalizedApiKey) {
        const error = new Error("RAG_SERVICE_API_KEY is required for RAG service-map sync");
        error.status = 503;
        throw error;
      }
      const url = new URL(`${normalizedBaseUrl}/documents/${encodeURIComponent(docId)}/chunks`);
      if (itemType) url.searchParams.set("item_type", itemType);
      if (sourceType) url.searchParams.set("source_type", sourceType);
      const response = await fetchImpl(url, {
        headers: {
          "X-API-Key": normalizedApiKey
        }
      });
      if (!response.ok) {
        const error = new Error(`RAG chunk request failed: HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const payload = await response.json();
      return Array.isArray(payload?.chunks) ? payload.chunks : [];
    },
    async listDocuments({ pageSize = 100, maxPages = 100 } = {}) {
      if (!normalizedApiKey) {
        const error = new Error("RAG_SERVICE_API_KEY is required for RAG service-map sync");
        error.status = 503;
        throw error;
      }
      const documents = [];
      const safePageSize = Math.max(1, Math.min(Number(pageSize) || 100, 100));
      const safeMaxPages = Math.max(1, Math.min(Number(maxPages) || 100, 1000));
      for (let page = 0; page < safeMaxPages; page += 1) {
        const url = new URL(`${normalizedBaseUrl}/documents`);
        url.searchParams.set("limit", String(safePageSize));
        url.searchParams.set("offset", String(page * safePageSize));
        const response = await fetchImpl(url, {
          headers: {
            "X-API-Key": normalizedApiKey
          }
        });
        if (!response.ok) {
          const error = new Error(`RAG documents request failed: HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : Array.isArray(payload?.documents) ? payload.documents : [];
        documents.push(...items);
        if (items.length < safePageSize) break;
      }
      return documents;
    }
  };
}

async function upsertEntry(prisma, entry) {
  const existing = await prisma.serviceMapEntry.findUnique({
    where: { id: entry.id },
    select: {
      normalizedAddress: true,
      status: true,
      geocodingStatus: true
    }
  });
  const canPreserveGeocode =
    existing?.normalizedAddress === entry.normalizedAddress &&
    ["MATCHED", "MANUALLY_CONFIRMED"].includes(existing?.geocodingStatus);
  const nextStatus = canPreserveGeocode ? existing.status || "PUBLISHED" : entry.status;
  const nextGeocodingStatus = canPreserveGeocode ? existing.geocodingStatus : entry.geocodingStatus;

  return prisma.serviceMapEntry.upsert({
    where: { id: entry.id },
    create: entry,
    update: {
      type: entry.type,
      title: entry.title,
      description: entry.description,
      municipalityId: entry.municipalityId,
      municipalityName: entry.municipalityName,
      county: entry.county,
      address: entry.address,
      normalizedAddress: entry.normalizedAddress,
      phone: entry.phone,
      email: entry.email,
      website: entry.website,
      sourceUrl: entry.sourceUrl,
      sourceDocId: entry.sourceDocId,
      checkedAt: entry.checkedAt,
      status: nextStatus,
      geocodingStatus: nextGeocodingStatus
    }
  });
}

export async function syncKovContactsFromRagToServiceMap({
  prisma = defaultPrisma,
  ragClient = createRagServiceMapClient(),
  dryRun = false
} = {}) {
  const rows = await prisma.municipalityKovAdmin.findMany({
    where: {
      ingestStatus: "INGESTED",
      municipality: {
        is: {
          isActive: true
        }
      }
    },
    include: {
      municipality: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          county: true,
          isActive: true
        }
      }
    }
  });

  const result = {
    scannedDocuments: 0,
    scannedContacts: 0,
    skipped: 0,
    upserted: 0,
    failedDocuments: 0,
    errors: [],
    entries: []
  };

  for (const row of rows) {
    const docIds = legacyKovRagDocIdCandidates(row);
    const docId = docIds[0];
    if (!docIds.length) continue;
    result.scannedDocuments += 1;

    let chunks = [];
    let lastError = null;
    for (const candidateDocId of docIds) {
      try {
        chunks = await ragClient.listDocumentChunks(candidateDocId, {
          itemType: "contact"
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      result.failedDocuments += 1;
      result.errors.push({
        docId,
        message: String(lastError?.message || "RAG chunk read failed").slice(0, 300)
      });
      continue;
    }

    for (const chunk of chunks) {
      result.scannedContacts += 1;
      const entry = mapKovRagContactChunkToServiceMapEntry(chunk, {
        municipality: row.municipality
      });
      if (!entry.email && !entry.phone && !entry.address) {
        result.skipped += 1;
        continue;
      }
      result.entries.push(entry);
      if (dryRun) continue;
      await upsertEntry(prisma, entry);
      result.upserted += 1;
    }
  }

  return result;
}

export async function syncServiceProviderDocumentsFromRagToServiceMap({
  prisma = defaultPrisma,
  ragClient = createRagServiceMapClient(),
  dryRun = false
} = {}) {
  const documents = await ragClient.listDocuments();
  const result = {
    scannedDocuments: documents.length,
    scannedProviders: 0,
    skipped: 0,
    upserted: 0,
    entries: []
  };

  for (const document of documents) {
    if (!isServiceProviderRagDocument(document)) continue;
    result.scannedProviders += 1;
    const entry = mapServiceProviderRagDocumentToServiceMapEntry(document);
    if (!entry.email && !entry.phone && !entry.website && !entry.address) {
      result.skipped += 1;
      continue;
    }
    result.entries.push(entry);
    if (dryRun) continue;
    await upsertEntry(prisma, entry);
    result.upserted += 1;
  }

  return result;
}

export async function syncServiceMapEntriesFromRag(options = {}) {
  const kov = await syncKovContactsFromRagToServiceMap(options);
  const serviceProviders = await syncServiceProviderDocumentsFromRagToServiceMap(options);
  return {
    kov,
    serviceProviders,
    entries: [...kov.entries, ...serviceProviders.entries],
    upserted: Number(kov.upserted || 0) + Number(serviceProviders.upserted || 0)
  };
}
