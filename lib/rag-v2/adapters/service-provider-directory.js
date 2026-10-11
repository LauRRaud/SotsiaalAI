import { ASSISTANT_GATE_SELECT, assistantMapLink, assistantProfileGate, assistantServicesForMunicipality } from '../../serviceProviderAssistantGate.js';
import { municipalityRegister, municipalitySlugOf } from '../../serviceProviderServiceArea.js';
import { getServiceAvailabilityState } from '../../serviceAvailability.js';
import { providerDocument, providerText, providerVersion, usableCard } from './service-providers.js';

// ADR-144: the reader of the chat's provider lane. It reads the application's own database at the moment of the
// question and copies nothing: a provider who takes the "leitav vestluses" tick off, hides the profile or loses the
// confirmed right to represent the organisation is gone from the next reading. Who may be shown at all is the gate's
// decision (lib/serviceProviderAssistantGate.js); what is shown of them is the list in service-providers.js.
//
// The fields below are the ones that list needs, beside the gate's own. No description, no contact person.
const SERVICE_SHOWN = Object.freeze({ name: true, category: true, feeType: true, priceDescription: true, directContactAllowed: true,
  requiresKovAssessment: true, requiresKovDecision: true, requiresSkaReferral: true, requiresSpecialistReferral: true, sortOrder: true });
export const PROVIDER_SHOWN_SELECT = Object.freeze({ ...ASSISTANT_GATE_SELECT, organizationName: true, phone: true, email: true, website: true,
  serviceItems: { select: { ...ASSISTANT_GATE_SELECT.serviceItems.select, ...SERVICE_SHOWN } } });
// The most profiles one reading takes. Above it the lane says nothing rather than choose among providers by chance.
const PROFILE_CEILING = 500;
const MUNICIPALITY_SELECT = Object.freeze({ id: true, slug: true, displayName: true, baseName: true, county: true });

const underscored = slug => slug.replaceAll('-', '_');

/** A service's area with the names a reader knows: the municipalities' full names, the county as the register writes it. */
function namedArea(area, names) {
  if (area.kind === 'municipality') return { kind: area.kind, names: area.municipalities.map(slug => names.municipality.get(slug)).filter(Boolean) };
  if (area.kind === 'county') return { kind: area.kind, names: area.counties.map(key => names.county.get(key)).filter(Boolean) };
  return { kind: area.kind };
}

/** One allowed profile as the card of the municipality `slug`, or null when no service of it covers the place. */
function cardFor(profile, slug, register, names, { now, siteUrl }) {
  // The gate is asked inside: a profile that does not pass gives no service.
  const covering = assistantServicesForMunicipality(profile, slug, register, { now });
  if (!covering.length) return null;
  const byId = new Map(profile.serviceItems.map(service => [service.id, service]));
  const services = covering.map(item => {
    const service = byId.get(item.serviceId), state = getServiceAvailabilityState(service, { now });
    return { name: service.name, category: service.category, area: namedArea(item.area, names), feeType: service.feeType, priceDescription: service.priceDescription,
      directContactAllowed: service.directContactAllowed, requiresKovAssessment: service.requiresKovAssessment, requiresKovDecision: service.requiresKovDecision,
      requiresSkaReferral: service.requiresSkaReferral, requiresSpecialistReferral: service.requiresSpecialistReferral, sortOrder: service.sortOrder,
      availability: { status: state.status, freshness: state.freshness, checkedAt: state.checkedAt } };
  });
  const link = assistantMapLink(profile);
  const card = { profileId: profile.id, region: underscored(slug), name: profile.organizationName, phone: profile.phone, email: profile.email, website: profile.website, services,
    // Only a provider who is also on the public service map has a place the answer can link to.
    mapUrl: link && siteUrl ? `${siteUrl}${link}` : null };
  return usableCard(card) ? card : null;
}

/** The chat's reader of service provider profiles. `siteUrl`: the public origin the map links are made with. */
export function serviceProviderDirectoryAdapter(db, { clock = () => new Date(), siteUrl = null } = {}) {
  const readRegister = async () => {
    const rows = await db.municipality.findMany({ where: { isActive: true }, select: MUNICIPALITY_SELECT });
    const county = new Map();
    const register = municipalityRegister(rows);
    for (const row of rows) { const key = register.countyOf.get(row.slug); if (key && row.county && !county.has(key)) county.set(key, row.county); }
    return { register, names: { municipality: new Map(rows.map(row => [row.slug, row.displayName])), county } };
  };
  return {
    /** The providers who may be named for the municipality `region` (the chat's own form of a slug: "elva_vald"). */
    async loadProviders({ region }) {
      const { register, names } = await readRegister(), slug = municipalitySlugOf(region, register);
      if (!slug) return [];
      const profiles = await db.serviceProviderProfile.findMany({ where: { status: 'PUBLISHED', assistantRecommendationAllowed: true },
        select: PROVIDER_SHOWN_SELECT, orderBy: { id: 'asc' }, take: PROFILE_CEILING + 1 });
      if (profiles.length > PROFILE_CEILING) return [];
      const now = clock();
      return profiles.map(profile => cardFor(profile, slug, register, names, { now, siteUrl })).filter(Boolean);
    },
    /**
     * Where each provider document of an earlier reading stands now. For every id: `allowed` (the gate, asked again),
     * and what the profile says today for the same municipality (`version`, `text`) with its link on the service map.
     * A document the reader cannot place is not allowed.
     */
    async providerStates(documentIds) {
      const wanted = [...new Set(documentIds)].map(documentId => ({ documentId, ...providerDocument(documentId) })), states = new Map();
      for (const item of wanted) states.set(item.documentId, { allowed: false, version: null, text: null, links: [] });
      const ids = [...new Set(wanted.filter(item => item.profileId).map(item => item.profileId))];
      if (!ids.length) return states;
      const [{ register, names }, profiles] = await Promise.all([readRegister(),
        db.serviceProviderProfile.findMany({ where: { id: { in: ids } }, select: PROVIDER_SHOWN_SELECT })]);
      const byId = new Map(profiles.map(profile => [profile.id, profile])), now = clock();
      for (const item of wanted) {
        const profile = byId.get(item.profileId);
        if (!profile || !assistantProfileGate(profile).allowed) continue;
        const slug = municipalitySlugOf(item.region, register), card = slug ? cardFor(profile, slug, register, names, { now, siteUrl }) : null;
        states.set(item.documentId, { allowed: true, version: card ? providerVersion(card) : null, text: card ? providerText(card) : null, links: card?.mapUrl ? [card.mapUrl] : [] });
      }
      return states;
    },
  };
}
