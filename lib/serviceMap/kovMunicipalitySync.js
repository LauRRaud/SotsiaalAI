import { prisma as defaultPrisma } from "../prisma.js";
import {
  createSourceGeneration,
  reconcileCompleteServiceMapSource,
  SERVICE_MAP_SOURCE,
  sourceLifecycleFields,
  withServiceMapSourceLock
} from "./sourceReconcile.js";

function clean(value) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized || null;
}

function stableMunicipalityEntryId(municipality) {
  const slug = clean(municipality?.slug)
    || clean(municipality?.displayName)?.toLocaleLowerCase("et").replace(/[^a-z0-9]+/g, "-");
  return `kov-municipality-${slug || municipality?.id || "unknown"}`.slice(0, 180);
}

export function mapKovAdminMunicipalityToServiceMapEntry(row) {
  const municipality = row?.municipality || {};
  const displayName = clean(municipality.displayName);
  const website = clean(row?.officialWebsite);
  return {
    id: stableMunicipalityEntryId(municipality),
    type: "KOV_SOCIAL_CONTACT",
    title: `${displayName || "KOV"} sotsiaalhoolekanne`,
    description: [
      displayName ? `${displayName} sotsiaalhoolekande pöördumiskoht.` : "KOV sotsiaalhoolekande pöördumiskoht.",
      "Kirje on loodud KOV registri põhjal ning vajab vajadusel täpse kontaktinfo ja aadressi ülevaatust."
    ].join(" "),
    municipalityId: clean(municipality.id),
    municipalityName: displayName,
    county: clean(municipality.county),
    address: displayName,
    normalizedAddress: displayName,
    phone: null,
    email: null,
    website,
    sourceUrl: website,
    sourceDocId: clean(row?.ragDocId) || (clean(municipality.slug) ? `municipality:${municipality.slug}` : null),
    checkedAt: row?.checkedAt || null,
    status: "NEEDS_REVIEW",
    geocodingStatus: displayName ? "PENDING" : "FAILED"
  };
}

async function syncKovMunicipalitiesToServiceMapWithin({
  prisma = defaultPrisma,
  dryRun = false,
  generation = createSourceGeneration(),
  now = new Date()
} = {}) {
  const rows = await prisma.municipalityKovAdmin.findMany({
    where: {
      municipality: {
        isActive: true
      }
    },
    orderBy: {
      municipality: {
        displayName: "asc"
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
    scannedMunicipalities: rows.length,
    planned: 0,
    upserted: 0,
    entries: []
  };

  for (const row of rows) {
    const entry = {
      ...mapKovAdminMunicipalityToServiceMapEntry(row),
      ...sourceLifecycleFields(SERVICE_MAP_SOURCE.KOV_MUNICIPALITY, generation, now)
    };
    result.entries.push(entry);
    result.planned += 1;
    if (dryRun) continue;

    const existing = await prisma.serviceMapEntry.findUnique({
      where: { id: entry.id },
      select: {
        title: true, description: true, address: true, phone: true, email: true,
        website: true, status: true, tombstonedAt: true
      }
    });
    const materialChanged = !existing || ["title", "description", "address", "phone", "email", "website"]
      .some((field) => (existing[field] ?? null) !== (entry[field] ?? null));
    const nextStatus = existing?.tombstonedAt || materialChanged
      ? "NEEDS_REVIEW"
      : existing?.status || entry.status;

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
        sourceNamespace: entry.sourceNamespace,
        sourceGeneration: entry.sourceGeneration,
        lastSeenAt: entry.lastSeenAt,
        tombstonedAt: null,
        checkedAt: entry.checkedAt,
        status: nextStatus,
        geocodingStatus: entry.geocodingStatus,
        ...(materialChanged ? { revision: { increment: 1 } } : {})
      }
    });
    result.upserted += 1;
  }

  result.hidden = dryRun
    ? 0
    : await reconcileCompleteServiceMapSource({
        db: prisma,
        namespace: SERVICE_MAP_SOURCE.KOV_MUNICIPALITY,
        generation,
        now
      });

  return result;
}

export async function syncKovMunicipalitiesToServiceMap(options = {}) {
  const db = options.prisma || defaultPrisma;
  return withServiceMapSourceLock(db, SERVICE_MAP_SOURCE.KOV_MUNICIPALITY, (tx) =>
    syncKovMunicipalitiesToServiceMapWithin({ ...options, prisma: tx })
  );
}
