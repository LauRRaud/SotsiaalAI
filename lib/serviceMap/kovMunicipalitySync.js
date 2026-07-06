import { prisma as defaultPrisma } from "../prisma.js";

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

export async function syncKovMunicipalitiesToServiceMap({
  prisma = defaultPrisma,
  dryRun = false
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
    const entry = mapKovAdminMunicipalityToServiceMapEntry(row);
    result.entries.push(entry);
    result.planned += 1;
    if (dryRun) continue;

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
        status: entry.status,
        geocodingStatus: entry.geocodingStatus
      }
    });
    result.upserted += 1;
  }

  return result;
}
