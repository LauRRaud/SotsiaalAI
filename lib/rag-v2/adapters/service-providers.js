import { fail, hash, id, stable } from '../contracts.js';

// ADR-144 (owner 11.10.2026: "Teenuseosutaja tuleb nimetada ka vestluses, kes on profiili täitnud ja paneb linnukese,
// et on leitav kaardil ja eraldi linnuke, on leitav vestluses"). A service provider who published a profile and ticked
// "leitav vestluses" is named by the chat to a person who asks about a service in a municipality the provider serves.
//
// A provider is not a corpus document: the profile lives in the application's database and is read at the moment of
// the question, through the gate (lib/serviceProviderAssistantGate.js). So that the answer can cite it like any other
// source, each provider of a turn becomes one evidence entry of its own kind:
//   - its "document" is the provider's services for the turn's municipality (service-provider:<profile>/<region>);
//   - its version is the hash of the very text shown, so a later reading can tell whether the profile still says it;
//   - it has no spans, pages or places in a file: the text is made here from the profile's own values.
// These entries stand after all corpus evidence in a packet, so the corpus references keep their numbers and are checked
// against the corpus exactly as before (corpusPacket); the provider entries are checked against the gate instead.
//
// What is shown of a provider is this file's list and nothing else (the owner's decision 1 of ADR-144, here as the
// ADR proposes it): the organisation's name; of each service that covers the municipality its name, category, area,
// fee with the provider's own note, how the service is reached, and the availability only while the provider's own
// confirmation is fresh; the organisation's general phone, e-mail and web address. No description, no person's name,
// no licence mark.
export const PROVIDER_LANE_VERSION = 'rag-v2/service-providers-1';
// providers: how many providers a turn names at most; services: of one provider. Counted with the chat's tokenizer on
// made-up profiles (11.10.2026): a provider with one service is 54 tokens with nothing but the names and 182 with
// every value filled, and 416 with three full services; the lane is about 3300 tokens at its largest. The search
// sends a context that is full without the lane without it (retrieval.js).
export const PROVIDER_LIMITS = Object.freeze({ providers: 8, services: 3 });
export const PROVIDER_REASON = 'service_provider';
export const PROVIDER_SOURCE_TYPE = 'service_provider_profile';
const DOCUMENT = 'service-provider:';
const REGION = /^[a-z0-9_]{2,80}$/u;

export const providerDocumentId = (profileId, region) => `${DOCUMENT}${profileId}/${region}`;
export const isProviderDocument = documentId => typeof documentId === 'string' && documentId.startsWith(DOCUMENT);
/** The profile and the municipality a provider document names, or null for any other document. */
export function providerDocument(documentId) {
  if (!isProviderDocument(documentId)) return null;
  const [profileId, region, ...rest] = documentId.slice(DOCUMENT.length).split('/');
  return profileId && !rest.length && REGION.test(region || '') ? { profileId, region } : null;
}

// One line of a provider's own free text: no line breaks (a value must not start a line of its own), bounded length.
const value = (text, limit) => { const clean = String(text ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim(); return clean ? clean.slice(0, limit) : null; };
const day = iso => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/u.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : null);

const FEE = Object.freeze({ FREE: 'tasuta', PAID: 'tasuline', AGREEMENT: 'kokkuleppel', MIXED: 'osa tasuta, osa tasuline' });
// The form stores a requirement as the word the provider chose (components/workspace/serviceProfile/profileModel.js).
const YES = 'jah', DEPENDS = 'sõltub olukorrast', NO = 'ei';
const ACCESS = Object.freeze([
  ['directContactAllowed', { [YES]: 'võib pöörduda otse teenuseosutaja poole', [NO]: 'otse teenuseosutaja poole pöörduda ei saa', [DEPENDS]: 'otse pöördumine sõltub olukorrast' }],
  ['requiresKovAssessment', { [YES]: 'vajab omavalitsuse hindamist', [DEPENDS]: 'omavalitsuse hindamine sõltub olukorrast' }],
  ['requiresKovDecision', { [YES]: 'vajab omavalitsuse otsust', [DEPENDS]: 'omavalitsuse otsus sõltub olukorrast' }],
  ['requiresSkaReferral', { [YES]: 'vajab Sotsiaalkindlustusameti suunamist', [DEPENDS]: 'Sotsiaalkindlustusameti suunamine sõltub olukorrast' }],
  ['requiresSpecialistReferral', { [YES]: 'vajab spetsialisti suunamist', [DEPENDS]: 'spetsialisti suunamine sõltub olukorrast' }]]);
const AVAILABILITY = Object.freeze({ accepting: 'võtab uusi pöördumisi vastu', waitlist: 'vastuvõtt on ooteajaga', not_accepting: 'praegu uusi pöördumisi vastu ei võta' });
const AREA_ORDER = Object.freeze({ municipality: 0, county: 1, national: 2 });
const MUNICIPALITIES_NAMED = 6;

/** A service's area in the reader's words. `area` is readServiceArea's result with the register's names beside it. */
export function areaLabel(area) {
  if (area?.kind === 'national') return 'üleriigiline';
  if (area?.kind === 'county') return (area.names || []).join(', ') || null;
  if (area?.kind !== 'municipality') return null;
  const names = area.names || [], shown = names.slice(0, MUNICIPALITIES_NAMED);
  return shown.length ? `${shown.join(', ')}${names.length > shown.length ? ` ja veel ${names.length - shown.length} omavalitsust` : ''}` : null;
}

function serviceLines(service) {
  const fee = FEE[String(service.feeType || '').toUpperCase()] ?? null, note = value(service.priceDescription, 240);
  const access = ACCESS.flatMap(([field, words]) => { const said = words[String(service[field] ?? '').normalize('NFKC').trim().toLocaleLowerCase('et')]; return said ? [said] : []; });
  // Availability is said only while the provider's own confirmation is fresh (lib/serviceAvailability.js, 28 days).
  const open = service.availability?.freshness === 'fresh' ? AVAILABILITY[service.availability.status] : null, confirmed = open ? day(service.availability.checkedAt) : null;
  return [`Teenus: ${value(service.name, 160)}`,
    value(service.category, 80) ? `Valdkond: ${value(service.category, 80)}` : null,
    areaLabel(service.area) ? `Piirkond: ${areaLabel(service.area)}` : null,
    fee || note ? `Tasu: ${[fee, note].filter(Boolean).join('; ')}` : null,
    access.length ? `Teenusele saamine: ${access.join('; ')}` : null,
    open && confirmed ? `Vastuvõtt: ${open} (teenuseosutaja kinnitas ${confirmed})` : null];
}

export const PROVIDER_ORIGIN_LINE = 'Andmed on teenuseosutaja enda sisestatud Sotsiaal.pro teenuseprofiili.';
/** The text of one provider as the model reads it and the source view shows it: one value on a line. */
export function providerText(card) {
  return [`Teenuseosutaja: ${value(card.name, 160)}`, PROVIDER_ORIGIN_LINE, ...card.services.flatMap(serviceLines),
    value(card.phone, 60) ? `Telefon: ${value(card.phone, 60)}` : null, value(card.email, 120) ? `E-post: ${value(card.email, 120)}` : null,
    value(card.website, 200) ? `Veeb: ${value(card.website, 200)}` : null].filter(Boolean).join('\n');
}

/** A card is usable when it names the provider and at least one named service. */
export const usableCard = card => Boolean(card && typeof card.profileId === 'string' && card.profileId && REGION.test(card.region || '') && value(card.name, 160)
  && Array.isArray(card.services) && card.services.length && card.services.every(service => value(service?.name, 160)));

// Narrower area first, then the name: never by fee or by anything a provider could pay for (ADR-144, decision 3).
const narrowest = card => Math.min(...card.services.map(service => AREA_ORDER[service.area?.kind] ?? 3));
/** The cards a turn shows, in their order, each with its services in the same order and within the limits. */
export function shownCards(cards) {
  return cards.filter(usableCard)
    .map(card => ({ ...card, services: [...card.services].sort((a, b) => (AREA_ORDER[a.area?.kind] ?? 3) - (AREA_ORDER[b.area?.kind] ?? 3)
      || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name), 'et')).slice(0, PROVIDER_LIMITS.services) }))
    .sort((a, b) => narrowest(a) - narrowest(b) || String(a.name).localeCompare(String(b.name), 'et') || a.profileId.localeCompare(b.profileId))
    .slice(0, PROVIDER_LIMITS.providers);
}

const versionOf = (document, text) => `service-provider-version:${hash(stable([document, text]))}`;
/** The version a provider document has when it says `text`: what a stored entry is compared with. */
export const providerVersion = (card) => versionOf(providerDocumentId(card.profileId, card.region), providerText(card));
const declared = plain => ({ value: plain, provenance: [{ kind: 'service_provider_profile' }], review_state: 'self_declared' });

/** One provider as an evidence entry. */
export function providerEntry(card) {
  const text = providerText(card), document = providerDocumentId(card.profileId, card.region), version = versionOf(document, text), chunk = id('provider_chunk', version);
  return { evidence_id: id('evidence', version, chunk), document_id: document, document_version_id: version, unit_id: chunk, chunk_id: chunk,
    span_ids: [], pdf_pages: [], source_text: text, bibliography: { title: value(card.name, 160) },
    source_metadata: { source_type: declared(PROVIDER_SOURCE_TYPE), authority: declared('self_declared'), language: declared('et') },
    limitations: [], selection: { reason: PROVIDER_REASON } };
}

/** The lane's packet for a turn: the shown providers of the turn's municipality, or null when there is none. */
export function providerLanePacket({ tenant, generationId, queryHash, region, cards }) {
  const shown = shownCards(cards || []);
  if (!shown.length) return null;
  const evidence = shown.map(providerEntry);
  return { tenant, query_id: id('query', tenant, queryHash, 'service_providers', Date.now()), generation_id: generationId, state: 'ok', evidence,
    // total: how many providers passed the gate for the municipality; the list is never all providers of a place.
    provider_context: { version: PROVIDER_LANE_VERSION, region, basis: 'self_declared_profiles', completeness: 'only_providers_who_entered_a_profile',
      shown: shown.length, total: cards.filter(usableCard).length, refs: evidence.map((_, index) => `S${index + 1}`) } };
}

const ownEntry = entry => isProviderDocument(entry?.document_id);
/** A stored provider entry must still be the one this file makes from its own text. */
function checkedEntry(entry) {
  const document = providerDocument(entry.document_id), version = document ? versionOf(entry.document_id, entry.source_text) : null, chunk = version ? id('provider_chunk', version) : null;
  if (!document || typeof entry.source_text !== 'string' || entry.document_version_id !== version || entry.chunk_id !== chunk || entry.unit_id !== chunk
    || entry.evidence_id !== id('evidence', version, chunk) || (entry.span_ids || []).length || (entry.pdf_pages || []).length) fail('invalid_provider_evidence');
  return document;
}

/**
 * A packet's two kinds of evidence apart. `corpus` is the packet as it would be without providers (the same object
 * when it has none): its references are checked against the corpus as always. `providers` are the provider entries
 * with the reference each is cited by, checked against the gate. `references` gives the references the packet's
 * evidence makes (model-context.js, packetReferences), so that a stored reference is the entry's own.
 */
export function splitProviderEvidence(packet, references) {
  const evidence = Array.isArray(packet?.evidence) ? packet.evidence : [], map = packet?.reference_map || {};
  const own = evidence.filter(ownEntry), cited = Object.entries(map).filter(([, reference]) => isProviderDocument(reference?.document_id));
  if (!own.length && !cited.length) return { corpus: packet, providers: [] };
  const ids = new Set(own.map(entry => entry.evidence_id)), first = evidence.findIndex(ownEntry);
  // Providers stand after all corpus evidence: taking them away leaves every corpus reference its number.
  if (first < 0 || evidence.slice(first).some(entry => !ownEntry(entry)) || ids.size !== own.length) fail('invalid_provider_evidence');
  const made = references(packet);
  const providers = cited.map(([ref, reference]) => {
    const entry = own.find(item => item.evidence_id === reference.evidence_id);
    if (!entry || stable(made[ref]) !== stable(reference)) fail('invalid_model_reference');
    return { ref, reference, entry, ...checkedEntry(entry) };
  });
  own.forEach(checkedEntry);
  return { corpus: { ...packet, evidence: evidence.filter(entry => !ownEntry(entry)), reference_map: Object.fromEntries(Object.entries(map).filter(([, reference]) => !isProviderDocument(reference?.document_id))) }, providers };
}
