import fs from "node:fs/promises";
import path from "node:path";
import { prisma as defaultPrisma } from "../prisma.js";

const CONTACT_ITEM_TYPES = new Set(["contact", "official_contact"]);
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
const MUNICIPALITY_OFFICE_ADDRESS_FALLBACKS = new Map([
  ["alutaguse-vald", "Tartu mnt 56, Iisaku alevik, Alutaguse vald, 41101"],
  ["voru-vald", "Võrumõisa tee 4a, Võru linn, Võru maakond, 65605"]
]);

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
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableEntryId(item, fallbackSlug, suffix = "") {
  const raw = clean(item?.id || item?.source_id || item?.document_id || item?.canonical_item_id);
  const rawWithSuffix = raw && suffix ? `${raw}-${suffix}` : raw;
  const fallback = [
    fallbackSlug,
    item?.name,
    item?.title,
    item?.role,
    item?.email,
    item?.phone,
    suffix,
    "contact"
  ].filter(Boolean).join("-");
  const safe = normalizeSlug(rawWithSuffix || fallback);
  return `kov-contact-${safe}`.slice(0, 180);
}

function isContactItem(item) {
  const itemType = String(item?.itemType || item?.item_type || item?.resource_type || "").trim().toLowerCase();
  if (CONTACT_ITEM_TYPES.has(itemType)) return true;
  if (clean(item?.slug) && (clean(item?.email) || clean(item?.phone) || clean(item?.address))) return true;
  return Boolean(item?.email || item?.phone) && Boolean(item?.role || item?.department);
}

function isSocialContact(item) {
  const haystack = [
    item?.title,
    item?.name,
    item?.summary,
    item?.role,
    item?.department,
    item?.contactType,
    item?.serviceArea,
    item?.officialUrl,
    ...(Array.isArray(item?.sourceKeys) ? item.sourceKeys : []),
    ...(Array.isArray(item?.source_keys) ? item.source_keys : [])
  ]
    .join(" ")
    .toLocaleLowerCase("et");
  return SOCIAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function descriptionForContact(item) {
  const lines = [
    clean(item?.summary),
    clean(item?.role) ? `Roll: ${clean(item.role)}` : null,
    clean(item?.department) ? `Osakond: ${clean(item.department)}` : null,
    clean(item?.workingHours) ? `Vastuvõtt: ${clean(item.workingHours)}` : null
  ].filter(Boolean);
  return lines.join("\n").slice(0, 8_000) || null;
}

function addressPartsForContact(item) {
  const slug = normalizeSlug(item?.slug || item?.municipality_id || item?.municipality);
  const address = clean(item?.address) || MUNICIPALITY_OFFICE_ADDRESS_FALLBACKS.get(slug);
  if (!address) return [null];
  const parts = address
    .split(/\s*;\s*/u)
    .map((part) => clean(part))
    .filter(Boolean);
  return parts.length > 1 ? parts : [address];
}

function mapContactToEntry(item, { municipality, packageData, folderSlug, address, addressIndex, addressCount }) {
  const type = isSocialContact(item) ? "KOV_SOCIAL_CONTACT" : "KOV_GENERAL_CONTACT";
  const cleanedAddress = clean(address);
  const locationSuffix = addressCount > 1 ? `Vastuvõtukoht: ${cleanedAddress}` : null;
  const description = [descriptionForContact(item), locationSuffix].filter(Boolean).join("\n") || null;
  return {
    id: stableEntryId(item, folderSlug, addressCount > 1 ? `${addressIndex + 1}-${cleanedAddress}` : ""),
    type,
    title: clean(item?.name || item?.title || item?.department) || "KOV kontakt",
    description,
    municipalityId: municipality?.id || null,
    municipalityName: clean(item?.municipality_name || packageData?.municipality_name || packageData?.municipality),
    county: clean(item?.county || packageData?.county),
    address: cleanedAddress,
    normalizedAddress: clean(addressCount > 1 ? cleanedAddress : item?.normalizedAddress || item?.normalized_address || cleanedAddress),
    phone: clean(item?.phone),
    email: clean(item?.email)?.toLowerCase() || null,
    website: clean(item?.website || item?.officialUrl || item?.url_canonical),
    sourceUrl: clean(item?.officialUrl || item?.url_canonical),
    sourceDocId: clean(item?.document_id || item?.source_id || item?.id),
    checkedAt: cleanDate(item?.checked_at || item?.checkedAt || packageData?.checked_at || packageData?.checkedAt),
    status: cleanedAddress ? "NEEDS_REVIEW" : "NEEDS_REVIEW",
    geocodingStatus: cleanedAddress ? "PENDING" : "FAILED"
  };
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function listKovDataFiles(kovRoot) {
  const entries = await fs.readdir(kovRoot, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderSlug = entry.name;
    const dataPath = path.join(kovRoot, folderSlug, `${folderSlug}.json`);
    try {
      await fs.access(dataPath);
      files.push({ folderSlug, dataPath });
    } catch {
      // Ignore incomplete KOV folders.
    }
  }
  return files.sort((left, right) => left.folderSlug.localeCompare(right.folderSlug, "et"));
}

async function readCentralContactFile(kovRoot) {
  const contactPath = path.join(kovRoot, "kov_kontaktid_loplik.json");
  try {
    const contacts = await readJson(contactPath);
    if (!Array.isArray(contacts)) return null;
    return {
      contactPath,
      contacts
    };
  } catch {
    return null;
  }
}

export async function syncKovContactsToServiceMap({
  kovRoot = path.resolve(process.cwd(), "KOV"),
  prisma = defaultPrisma,
  dryRun = false
} = {}) {
  const centralContacts = await readCentralContactFile(kovRoot);
  const files = centralContacts
    ? [{ folderSlug: "kov_kontaktid_loplik", contacts: centralContacts.contacts }]
    : await listKovDataFiles(kovRoot);
  const result = {
    scannedFiles: files.length,
    scannedContacts: 0,
    upserted: 0,
    skipped: 0,
    entries: []
  };

  for (const file of files) {
    const packageData = file.contacts
      ? {}
      : await readJson(file.dataPath);
    const items = file.contacts || (Array.isArray(packageData?.items) ? packageData.items : []);
    for (const item of items) {
      if (!isContactItem(item)) continue;
      result.scannedContacts += 1;
      const municipalitySlug = normalizeSlug(item?.slug || item?.municipality_id || packageData?.municipality_id || file.folderSlug);
      const municipalityName = clean(item?.municipality || item?.municipality_name || packageData?.municipality_name || packageData?.municipality);
      const municipality = await prisma.municipality.findFirst({
        where: {
          OR: [
            { slug: municipalitySlug || file.folderSlug },
            { slug: file.folderSlug },
            { displayName: { equals: municipalityName || "", mode: "insensitive" } }
          ]
        },
        select: {
          id: true,
          slug: true,
          displayName: true,
          county: true
        }
      });
      const packageContext = {
        ...packageData,
        municipality_name: municipalityName || packageData?.municipality_name,
        municipality: municipalityName || packageData?.municipality,
        county: clean(item?.county || packageData?.county || municipality?.county)
      };
      const addressParts = addressPartsForContact(item);
      for (let addressIndex = 0; addressIndex < addressParts.length; addressIndex += 1) {
        const entry = mapContactToEntry(item, {
          municipality,
          packageData: packageContext,
          folderSlug: municipalitySlug || file.folderSlug,
          address: addressParts[addressIndex],
          addressIndex,
          addressCount: addressParts.length
        });

        if (!entry.email && !entry.phone && !entry.address) {
          result.skipped += 1;
          continue;
        }

        result.entries.push(entry);
        if (dryRun) continue;

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

        await prisma.serviceMapEntry.upsert({
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
        result.upserted += 1;
      }
    }
  }

  return result;
}
