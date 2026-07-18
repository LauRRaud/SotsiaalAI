import {
  MENTOR_PROFILE_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTOR_CONSENT_STATUS
} from "./constants.js";
import { notFound, resolveDb } from "./shared.js";
import { serializeCatalogProfile, serializeCatalogProfileDetail } from "./serializers.js";

/**
 * Kataloogis on nähtavad: (a) platvormikasutajate ACTIVE profiilid ja
 * (b) CONSENTED välisviited (mitte-STALE). Järjestus on neutraalne (uuemad
 * enne) — I10: kataloog ei ole edetabel; skoore ei arvutata.
 */
function catalogWhere() {
  return {
    OR: [
      {
        origin: MENTOR_PROFILE_ORIGIN.SELF,
        status: MENTOR_PROFILE_STATUS.ACTIVE
      },
      {
        origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
        userId: { not: null },
        status: MENTOR_PROFILE_STATUS.ACTIVE
      },
      {
        origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
        userId: null,
        consentStatus: MENTOR_CONSENT_STATUS.CONSENTED
      }
    ]
  };
}

export async function listMentorCatalog(actor, filters = {}, options = {}) {
  const db = resolveDb(options);
  const field = String(filters.field || "").trim();
  const topic = String(filters.topic || "").trim();
  const language = String(filters.language || "").trim();
  const profiles = await db.mentorProfile.findMany({
    where: {
      ...catalogWhere(),
      ...(field ? { fields: { has: field } } : {}),
      ...(topic ? { topics: { has: topic } } : {}),
      ...(language ? { languages: { has: language } } : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200
  });
  return profiles.map(serializeCatalogProfile).filter(Boolean);
}

export async function getCatalogProfile(actor, profileId, options = {}) {
  const db = resolveDb(options);
  const id = String(profileId || "").trim();
  if (!id) throw notFound();
  const profile = await db.mentorProfile.findFirst({
    where: { id, ...catalogWhere() }
  });
  // Kataloogist kadunud profiil (RETIRED/REVOKED/STALE/võõras DRAFT) → 404;
  // UI näitab "profiil pole enam saadaval" selgituslehte.
  if (!profile) throw notFound();
  return serializeCatalogProfileDetail(profile);
}
