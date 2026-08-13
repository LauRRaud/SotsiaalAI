import {
  MENTOR_PROFILE_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTOR_CONSENT_STATUS
} from "./constants.js";
import { notFound, resolveDb } from "./shared.js";
import { serializeCatalogProfile, serializeCatalogProfileDetail } from "./serializers.js";
import { publicMentorProfile } from "./profilePolicy.js";

/**
 * Kataloogis on nähtavad: (a) platvormikasutajate ACTIVE profiilid ja
 * (b) CONSENTED välisviited (mitte-STALE). Järjestus on neutraalne (uuemad
 * enne) — I10: kataloog ei ole edetabel; skoore ei arvutata.
 */
function catalogCandidateWhere() {
  return {
    OR: [
      {
        origin: MENTOR_PROFILE_ORIGIN.SELF,
        status: { in: [MENTOR_PROFILE_STATUS.ACTIVE, MENTOR_PROFILE_STATUS.PENDING_REVIEW] }
      },
      {
        origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
        userId: { not: null },
        status: { in: [MENTOR_PROFILE_STATUS.ACTIVE, MENTOR_PROFILE_STATUS.PENDING_REVIEW] }
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
  const now = options.now || new Date();
  const field = String(filters.field || "").trim();
  const topic = String(filters.topic || "").trim();
  const language = String(filters.language || "").trim();
  const profiles = await db.mentorProfile.findMany({
    where: {
      ...catalogCandidateWhere()
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500
  });
  return profiles
    .map((profile) => publicMentorProfile(profile, now))
    .filter((profile) => profile
      && (!field || profile.fields?.includes(field))
      && (!topic || profile.topics?.includes(topic))
      && (!language || profile.languages?.includes(language)))
    .slice(0, 200)
    .map(serializeCatalogProfile)
    .filter(Boolean);
}

export async function getCatalogProfile(actor, profileId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(profileId || "").trim();
  if (!id) throw notFound();
  const profile = await db.mentorProfile.findFirst({
    where: { id, ...catalogCandidateWhere() }
  });
  // Kataloogist kadunud profiil (RETIRED/REVOKED/STALE/võõras DRAFT) → 404;
  // UI näitab "profiil pole enam saadaval" selgituslehte.
  const publicProfile = publicMentorProfile(profile, now);
  if (!publicProfile) throw notFound();
  return serializeCatalogProfileDetail(publicProfile);
}
