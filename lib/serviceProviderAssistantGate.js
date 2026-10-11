/**
 * TEENUSEPROFIIL JA ASSISTENT — kes tohib vestluse vastusesse jõuda (ADR-144).
 *
 * Vana otsing on kinni (`lib/rag/retired.js`) ja koos sellega ka tee, mida mööda nõusoleku
 * andnud profiil assistendini jõudis. Praegune vestlus (`lib/rag-v2`) profiile ei loe. See moodul
 * on uue tee esimene osa: ÜKS koht, mis ütleb, kas profiili tohib assistendile üldse näidata,
 * ja mis piirkonda tema teenused katavad. Vestlusega ta veel ühendatud ei ole.
 *
 * VÄRAV (kõik neli peavad kehtima, loetuna meie enda andmebaasist päringu hetkel):
 *   1. profiil on avaldatud;
 *   2. osutaja on andnud loa „assistent võib nimetada" (`assistantRecommendationAllowed`);
 *   3. registrikoodiga profiilil on kinnitatud, et konto esindab seda asutust
 *      (`lib/serviceProviderRepresentation.js`). Reegel kehtib iga registrikoodiga profiili
 *      kohta, ka organisatsiooni oma kohta: kuni kinnitust ei ole, assistent teda ei nimeta;
 *   4. profiilil on vähemalt üks avalik teenus (sama reegel mis teenusekaardil:
 *      `publicServiceProviderServices`).
 *
 * FAIL-CLOSED: puuduv rida, puuduv väli või muu kui täpselt `true` luba tähendab „ei".
 * Loa tagasivõtmine mõjub kohe, sest midagi ei kopeerita: iga lugemine küsib värava uuesti.
 *
 * MIDA SIIN EI OTSUSTATA: mida osutaja kohta vastuses näidatakse ja mis sõnadega. Need on
 * omaniku otsused (ADR-144). Seepärast ei loe see moodul ühtki kontakti, hinda ega kirjeldust.
 */
import { getServiceAvailabilityState } from "@/lib/serviceAvailability";
import { publicServiceProviderServices } from "@/lib/serviceProviderPublicProjection";
import { representationState } from "@/lib/serviceProviderRepresentation";
import { ServiceAreaKind, areaServesMunicipality, municipalityRegister, readServiceArea } from "@/lib/serviceProviderServiceArea";

export const AssistantGateReason = Object.freeze({
  PROFILE_MISSING: "profile_missing",
  NOT_PUBLISHED: "profile_not_published",
  CONSENT_MISSING: "assistant_consent_missing",
  REPRESENTATION_UNCONFIRMED: "representation_unconfirmed",
  NO_PUBLIC_SERVICE: "no_public_service"
});

/* Väljad, mida värav ja piirkonna lugemine vajavad. Kontakte, hindu ega kirjeldusi siin ei ole. */
export const ASSISTANT_GATE_SELECT = Object.freeze({
  id: true,
  status: true,
  assistantRecommendationAllowed: true,
  registryCode: true,
  representationConfirmedAt: true,
  representationRegistryCode: true,
  county: true,
  serviceAreaMunicipalityIds: true,
  serviceMapEntry: { select: { id: true, status: true } },
  serviceItems: {
    select: {
      id: true,
      status: true,
      mapVisible: true,
      serviceAreaType: true,
      county: true,
      municipalityIds: true,
      availabilityStatus: true,
      availabilityCheckedAt: true,
      locationLinks: { select: { providerLocationId: true } }
    }
  },
  serviceLocations: { select: { id: true, status: true, mapVisible: true, county: true } }
});

/** Kas profiili tohib assistendile näidata. `reasons` nimetab kõik, mis takistab. */
export function assistantProfileGate(profile) {
  if (!profile || typeof profile !== "object") {
    return { allowed: false, reasons: [AssistantGateReason.PROFILE_MISSING] };
  }
  const reasons = [];
  if (String(profile.status || "").toUpperCase() !== "PUBLISHED") reasons.push(AssistantGateReason.NOT_PUBLISHED);
  if (profile.assistantRecommendationAllowed !== true) reasons.push(AssistantGateReason.CONSENT_MISSING);
  const representation = representationState(profile);
  if (representation.required && !representation.confirmed) reasons.push(AssistantGateReason.REPRESENTATION_UNCONFIRMED);
  if (!publicServiceProviderServices(profile).length) reasons.push(AssistantGateReason.NO_PUBLIC_SERVICE);
  return { allowed: reasons.length === 0, reasons };
}

/**
 * Lubatud profiili avalikud teenused koos piirkonnaga. Keelatud profiil annab tühja loendi.
 * `availability` on `fresh`, `stale` või `unknown` (`lib/serviceAvailability.js`, 28 päeva).
 */
export function assistantServices(profile, register = municipalityRegister(), { now } = {}) {
  if (!assistantProfileGate(profile).allowed) return [];
  return publicServiceProviderServices(profile).map((service) => ({
    profileId: profile.id,
    serviceId: service.id,
    area: readServiceArea(service, profile, register),
    availability: getServiceAvailabilityState(service, { now }).freshness
  }));
}

/** Lubatud profiili teenused, mille piirkond katab omavalitsust `slug`. */
export function assistantServicesForMunicipality(profile, slug, register = municipalityRegister(), options = {}) {
  return assistantServices(profile, register, options).filter((service) => areaServesMunicipality(service.area, slug, register));
}

/**
 * Koht, kuhu vastus saab osutaja juures viidata: tema kirje avalikul teenusekaardil.
 * Kaardil nähtamatu profiili kohta linki ei ole (avalikku profiililehte platvormil ei ole).
 */
export function assistantMapLink(profile) {
  const entry = profile?.serviceMapEntry;
  if (!entry?.id || String(entry.status || "").toUpperCase() !== "PUBLISHED") return null;
  return `/teenusekaart?entryId=${encodeURIComponent(entry.id)}`;
}

/**
 * Loendus ilma nimedeta: mitu profiili assistendini jõuaks ja mis ülejäänuid takistab.
 * `blockedPublished` loeb põhjuseid avaldatud profiilide seas (üks profiil võib olla mitmes).
 */
export function assistantDirectoryCounts(profiles = [], municipalities = [], { now } = {}) {
  const register = municipalityRegister(municipalities);
  const counts = {
    profiles: { total: 0, byStatus: {}, published: 0, consent: 0, allowed: 0, allowedWithMapLink: 0, blockedPublished: {} },
    services: {
      public: 0,
      area: Object.fromEntries(Object.values(ServiceAreaKind).map((kind) => [kind, 0])),
      unreadAreaWords: { municipalities: 0, counties: 0, ambiguous: 0 },
      availability: { fresh: 0, stale: 0, unknown: 0 }
    },
    coverage: { municipalities: register.countyOf.size, municipalitiesWithService: 0 }
  };
  const covered = new Set();
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const status = String(profile?.status || "").toUpperCase() || "UNKNOWN";
    const gate = assistantProfileGate(profile);
    counts.profiles.total += 1;
    counts.profiles.byStatus[status] = (counts.profiles.byStatus[status] || 0) + 1;
    if (profile?.assistantRecommendationAllowed === true) counts.profiles.consent += 1;
    if (status === "PUBLISHED") {
      counts.profiles.published += 1;
      for (const reason of gate.reasons) counts.profiles.blockedPublished[reason] = (counts.profiles.blockedPublished[reason] || 0) + 1;
    }
    if (!gate.allowed) continue;
    counts.profiles.allowed += 1;
    if (assistantMapLink(profile)) counts.profiles.allowedWithMapLink += 1;
    for (const service of assistantServices(profile, register, { now })) {
      counts.services.public += 1;
      counts.services.area[service.area.kind] += 1;
      counts.services.availability[service.availability] += 1;
      for (const key of Object.keys(counts.services.unreadAreaWords)) counts.services.unreadAreaWords[key] += service.area.unread[key];
      for (const slug of register.countyOf.keys()) if (areaServesMunicipality(service.area, slug, register)) covered.add(slug);
    }
  }
  counts.coverage.municipalitiesWithService = covered.size;
  return counts;
}
