// TEENUSEPROFIIL JA ASSISTENT (ADR-144) — värav ja piirkonna lugemine.
//
// Kaks riski, mida need testid kinni hoiavad:
//   1. assistent nimetab osutajat, kes ei ole avaldatud, ei ole luba andnud või kelle esindusõigus on
//      kinnitamata (värav peab olema fail-closed);
//   2. assistent ütleb, et teenust osutatakse kohas, mida osutaja ei märkinud (piirkonda ei oletata).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ASSISTANT_GATE_SELECT,
  AssistantGateReason,
  assistantDirectoryCounts,
  assistantMapLink,
  assistantProfileGate,
  assistantServices,
  assistantServicesForMunicipality
} from '../lib/serviceProviderAssistantGate.js';
import { ServiceAreaKind, areaServesMunicipality, countyKey, municipalityRegister, readServiceArea } from '../lib/serviceProviderServiceArea.js';

const NOW = new Date('2026-10-11T08:00:00.000Z');
const MUNICIPALITIES = [
  { id: 'm-elva', slug: 'elva-vald', displayName: 'Elva vald', baseName: 'Elva', county: 'Tartumaa' },
  { id: 'm-tartu-linn', slug: 'tartu-linn', displayName: 'Tartu linn', baseName: 'Tartu', county: 'Tartumaa' },
  { id: 'm-tartu-vald', slug: 'tartu-vald', displayName: 'Tartu vald', baseName: 'Tartu', county: 'Tartumaa' },
  { id: 'm-haapsalu', slug: 'haapsalu-linn', displayName: 'Haapsalu linn', baseName: 'Haapsalu', county: 'Läänemaa' },
  { id: 'm-rakvere', slug: 'rakvere-linn', displayName: 'Rakvere linn', baseName: 'Rakvere', county: 'Lääne-Virumaa' }
];
const REGISTER = municipalityRegister(MUNICIPALITIES);

const service = (overrides = {}) => ({
  id: 's1', status: 'PUBLISHED', mapVisible: true, serviceAreaType: 'KOV põhine', county: 'Tartumaa', municipalityIds: ['Elva vald'],
  availabilityStatus: 'accepting', availabilityCheckedAt: new Date('2026-10-01T08:00:00.000Z'), locationLinks: [], ...overrides
});
const profile = (overrides = {}) => ({
  id: 'p1', status: 'PUBLISHED', assistantRecommendationAllowed: true, registryCode: null,
  representationConfirmedAt: null, representationRegistryCode: null, county: 'Tartumaa', serviceAreaMunicipalityIds: [],
  serviceMapEntry: { id: 'entry 1', status: 'PUBLISHED' }, serviceItems: [service()], serviceLocations: [], ...overrides
});

test('värav: avaldatud, loaga ja avaliku teenusega profiil pääseb läbi', () => {
  assert.deepEqual(assistantProfileGate(profile()), { allowed: true, reasons: [] });
});

test('värav on fail-closed: puuduv rida, mustand, puuduv või ebatäpne luba ei pääse läbi', () => {
  assert.deepEqual(assistantProfileGate(null), { allowed: false, reasons: [AssistantGateReason.PROFILE_MISSING] });
  assert.deepEqual(assistantProfileGate(undefined).allowed, false);
  for (const status of ['DRAFT', 'REVIEW', 'HIDDEN', '', undefined]) {
    assert.deepEqual(assistantProfileGate(profile({ status })).reasons, [AssistantGateReason.NOT_PUBLISHED], String(status));
  }
  // Luba on ainult täpne `true`: tõene sõne või arv ei ole osutaja antud luba.
  for (const consent of [false, null, undefined, 'true', 1]) {
    assert.deepEqual(assistantProfileGate(profile({ assistantRecommendationAllowed: consent })).reasons, [AssistantGateReason.CONSENT_MISSING], String(consent));
  }
});

test('värav: registrikoodiga profiil pääseb läbi ainult selle koodi kinnitusega', () => {
  const coded = { registryCode: '12345678' };
  assert.deepEqual(assistantProfileGate(profile(coded)).reasons, [AssistantGateReason.REPRESENTATION_UNCONFIRMED]);
  assert.equal(assistantProfileGate(profile({ ...coded, representationConfirmedAt: NOW, representationRegistryCode: '12345678' })).allowed, true);
  // Kinnitus teise koodi kohta ei kehti: kood on pärast kinnitust muudetud.
  assert.deepEqual(assistantProfileGate(profile({ ...coded, representationConfirmedAt: NOW, representationRegistryCode: '87654321' })).reasons,
    [AssistantGateReason.REPRESENTATION_UNCONFIRMED]);
  // Sama reegel organisatsiooni profiilile: kinnituseta teda ei nimetata.
  assert.equal(assistantProfileGate(profile({ ...coded, ownershipMode: 'ORGANIZATION', organizationId: 'org1' })).allowed, false);
});

test('värav: avaliku teenuseta profiil ei pääse läbi; põhjused nimetatakse kõik korraga', () => {
  for (const hidden of [{ status: 'DRAFT' }, { status: 'HIDDEN' }, { mapVisible: false }]) {
    assert.deepEqual(assistantProfileGate(profile({ serviceItems: [service(hidden)] })).reasons, [AssistantGateReason.NO_PUBLIC_SERVICE]);
  }
  assert.deepEqual(assistantProfileGate(profile({ serviceItems: [] })).reasons, [AssistantGateReason.NO_PUBLIC_SERVICE]);
  assert.deepEqual(assistantProfileGate({ id: 'p0' }).reasons, [
    AssistantGateReason.NOT_PUBLISHED, AssistantGateReason.CONSENT_MISSING, AssistantGateReason.NO_PUBLIC_SERVICE
  ]);
});

test('keelatud profiil ei anna ühtki teenust, ka siis kui teenused ise on avalikud', () => {
  assert.equal(assistantServices(profile(), REGISTER, { now: NOW }).length, 1);
  assert.deepEqual(assistantServices(profile({ assistantRecommendationAllowed: false }), REGISTER, { now: NOW }), []);
  assert.deepEqual(assistantServices(profile({ status: 'HIDDEN' }), REGISTER, { now: NOW }), []);
  assert.deepEqual(assistantServicesForMunicipality(profile({ registryCode: '12345678' }), 'elva-vald', REGISTER, { now: NOW }), []);
});

test('lubatud profiilist loetakse ainult avalikud teenused, kättesaadavuse värskus kaasas', () => {
  const rows = assistantServices(profile({ serviceItems: [
    service({ id: 'fresh' }),
    service({ id: 'stale', availabilityCheckedAt: new Date('2026-08-01T08:00:00.000Z') }),
    service({ id: 'never', availabilityStatus: null, availabilityCheckedAt: null }),
    service({ id: 'draft', status: 'DRAFT' })
  ] }), REGISTER, { now: NOW });
  assert.deepEqual(rows.map((row) => [row.serviceId, row.availability]), [['fresh', 'fresh'], ['stale', 'stale'], ['never', 'unknown']]);
  assert.ok(rows.every((row) => row.profileId === 'p1'));
});

test('maakonna võti: „Harjumaa", „Harju maakond" ja „Harju" on sama maakond', () => {
  assert.equal(countyKey('Harjumaa'), 'harju');
  assert.equal(countyKey(' Harju  maakond '), 'harju');
  assert.equal(countyKey('harju'), 'harju');
  assert.equal(countyKey('Läänemaa'), 'lääne');
  assert.equal(countyKey('Lääne-Virumaa'), 'lääne-viru');
  assert.equal(countyKey('Lääne-Viru maakond'), 'lääne-viru');
  assert.equal(countyKey(null), '');
});

test('piirkond: üleriigiline ja veebiteenus katavad iga registri omavalitsuse, tundmatut kohta mitte', () => {
  for (const type of ['Üleriigiline', 'Veebiteenus', ' üleriigiline ']) {
    const area = readServiceArea(service({ serviceAreaType: type, municipalityIds: [] }), profile(), REGISTER);
    assert.equal(area.kind, ServiceAreaKind.NATIONAL);
    assert.ok(MUNICIPALITIES.every((row) => areaServesMunicipality(area, row.slug, REGISTER)));
    assert.equal(areaServesMunicipality(area, 'olematu-vald', REGISTER), false);
    assert.equal(areaServesMunicipality(area, '', REGISTER), false);
  }
});

test('piirkond: omavalitsus loetakse täisnime, tunnuse või ühese lühinime järgi', () => {
  const read = (municipalityIds) => readServiceArea(service({ municipalityIds }), profile(), REGISTER);
  assert.deepEqual(read(['Elva vald']).municipalities, ['elva-vald']);
  assert.deepEqual(read(['  elva   VALD ']).municipalities, ['elva-vald']);
  assert.deepEqual(read(['elva-vald', 'elva_vald', 'm-elva', 'Elva']).municipalities, ['elva-vald']);
  assert.deepEqual(read(['Tartu linn', 'Haapsalu']).municipalities, ['haapsalu-linn', 'tartu-linn']);
  const area = read(['Elva vald']);
  assert.equal(area.kind, ServiceAreaKind.MUNICIPALITY);
  assert.equal(areaServesMunicipality(area, 'elva-vald', REGISTER), true);
  // Sama maakonna teine omavalitsus ei ole kaetud: osutaja märkis ainult Elva.
  assert.equal(areaServesMunicipality(area, 'tartu-linn', REGISTER), false);
});

test('piirkond: kahe omavalitsuse ühine nimi ja tundmatu sõna ei kata midagi, aga loetakse kokku', () => {
  const ambiguous = readServiceArea(service({ municipalityIds: ['Tartu'] }), profile(), REGISTER);
  assert.equal(ambiguous.kind, ServiceAreaKind.UNKNOWN);
  assert.deepEqual(ambiguous.unread, { municipalities: 0, counties: 0, ambiguous: 1 });
  assert.equal(MUNICIPALITIES.some((row) => areaServesMunicipality(ambiguous, row.slug, REGISTER)), false);

  const mixed = readServiceArea(service({ municipalityIds: ['Elva vald', 'Lõuna-Eesti', 'Tartu'] }), profile(), REGISTER);
  assert.deepEqual(mixed.municipalities, ['elva-vald']);
  assert.deepEqual(mixed.unread, { municipalities: 1, counties: 0, ambiguous: 1 });

  // „KOV põhine" ilma loetava omavalitsuseta ei lange tagasi maakonnale: see väidaks rohkem, kui osutaja ütles.
  const unknown = readServiceArea(service({ municipalityIds: ['Kusagil'] }), profile(), REGISTER);
  assert.equal(unknown.kind, ServiceAreaKind.UNKNOWN);
  assert.deepEqual(unknown.counties, []);
});

test('piirkond: teenuse omavalitsuste puudumisel loetakse profiili omad', () => {
  const area = readServiceArea(service({ municipalityIds: [] }), profile({ serviceAreaMunicipalityIds: ['Haapsalu linn'] }), REGISTER);
  assert.deepEqual(area.municipalities, ['haapsalu-linn']);
});

test('piirkond: maakondlik teenus katab oma maakonna omavalitsused ja mitte teisi', () => {
  const area = readServiceArea(service({ serviceAreaType: 'Maakondlik', county: 'Tartu maakond', municipalityIds: [] }), profile(), REGISTER);
  assert.equal(area.kind, ServiceAreaKind.COUNTY);
  assert.deepEqual(area.counties, ['tartu']);
  assert.deepEqual(MUNICIPALITIES.filter((row) => areaServesMunicipality(area, row.slug, REGISTER)).map((row) => row.slug), ['elva-vald', 'tartu-linn', 'tartu-vald']);
  // Läänemaa ja Lääne-Virumaa on eri maakonnad.
  const west = readServiceArea(service({ serviceAreaType: 'Maakondlik', county: 'Läänemaa', municipalityIds: [] }), profile(), REGISTER);
  assert.deepEqual(MUNICIPALITIES.filter((row) => areaServesMunicipality(west, row.slug, REGISTER)).map((row) => row.slug), ['haapsalu-linn']);
  const unreadable = readServiceArea(service({ serviceAreaType: 'Maakondlik', county: 'Lõuna-Eesti', municipalityIds: [] }), profile({ county: null }), REGISTER);
  assert.equal(unreadable.kind, ServiceAreaKind.UNKNOWN);
  assert.equal(unreadable.unread.counties, 1);
});

test('piirkond: teeninduskoha põhine teenus loetakse oma avalike kohtade maakonna järgi', () => {
  const locations = [
    { id: 'l1', status: 'PUBLISHED', mapVisible: true, county: 'Läänemaa' },
    { id: 'l2', status: 'PUBLISHED', mapVisible: true, county: 'Tartumaa' },
    { id: 'l3', status: 'DRAFT', mapVisible: true, county: 'Lääne-Virumaa' }
  ];
  const linked = readServiceArea(service({ serviceAreaType: 'Teeninduskoha põhine', county: null, municipalityIds: [], locationLinks: [{ providerLocationId: 'l1' }] }),
    profile({ serviceLocations: locations }), REGISTER);
  assert.deepEqual(linked.counties, ['lääne']);
  // Seosteta teenus: profiili kõik avalikud kohad; avaldamata koht ei loe.
  const all = readServiceArea(service({ serviceAreaType: 'Teeninduskoha põhine', county: null, municipalityIds: [] }), profile({ serviceLocations: locations }), REGISTER);
  assert.deepEqual(all.counties, ['lääne', 'tartu']);
  // Kohtadeta teenus: teenuse enda maakond.
  const none = readServiceArea(service({ serviceAreaType: 'Teeninduskoha põhine', county: 'Tartumaa', municipalityIds: [] }), profile(), REGISTER);
  assert.deepEqual(none.counties, ['tartu']);
});

test('piirkond: täpsustamata tüüp võtab kitsaima märgitud piirkonna; tundmatu tüüp ei kata midagi', () => {
  assert.equal(readServiceArea(service({ serviceAreaType: '' }), profile(), REGISTER).kind, ServiceAreaKind.MUNICIPALITY);
  assert.equal(readServiceArea(service({ serviceAreaType: null, municipalityIds: [] }), profile(), REGISTER).kind, ServiceAreaKind.COUNTY);
  assert.equal(readServiceArea(service({ serviceAreaType: null, municipalityIds: [], county: null }), profile({ county: null }), REGISTER).kind, ServiceAreaKind.UNKNOWN);
  const legacy = readServiceArea(service({ serviceAreaType: 'Lõuna-Eesti piirkond' }), profile(), REGISTER);
  assert.equal(legacy.kind, ServiceAreaKind.UNKNOWN);
  assert.equal(MUNICIPALITIES.some((row) => areaServesMunicipality(legacy, row.slug, REGISTER)), false);
  assert.equal(areaServesMunicipality(null, 'elva-vald', REGISTER), false);
});

test('omavalitsuse küsimusele pakutakse ainult seda katvaid teenuseid', () => {
  const provider = profile({ serviceItems: [
    service({ id: 'elva' }),
    service({ id: 'riik', serviceAreaType: 'Üleriigiline', municipalityIds: [] }),
    service({ id: 'laane', serviceAreaType: 'Maakondlik', county: 'Läänemaa', municipalityIds: [] }),
    service({ id: 'teadmata', serviceAreaType: 'KOV põhine', municipalityIds: ['Tartu'] })
  ] });
  const ids = (slug) => assistantServicesForMunicipality(provider, slug, REGISTER, { now: NOW }).map((row) => row.serviceId);
  assert.deepEqual(ids('elva-vald'), ['elva', 'riik']);
  assert.deepEqual(ids('haapsalu-linn'), ['riik', 'laane']);
  assert.deepEqual(ids('tartu-linn'), ['riik']);
  assert.deepEqual(ids('olematu-vald'), []);
});

test('viide: avalik teenusekaardi kirje annab lingi, kaardil nähtamatu profiil ei anna', () => {
  assert.equal(assistantMapLink(profile()), '/teenusekaart?entryId=entry%201');
  for (const status of ['HIDDEN', 'NEEDS_REVIEW', 'DRAFT']) assert.equal(assistantMapLink(profile({ serviceMapEntry: { id: 'e1', status } })), null);
  assert.equal(assistantMapLink(profile({ serviceMapEntry: null })), null);
  assert.equal(assistantMapLink(null), null);
});

test('loendus: arvud värava ja piirkonna kohta, ilma ühegi nime või kontaktita', () => {
  const profiles = [
    profile({ id: 'ok', organizationName: 'SALAJANE NIMI', phone: '5550000' }),
    profile({ id: 'riik', serviceMapEntry: { id: 'e2', status: 'NEEDS_REVIEW' }, serviceItems: [service({ id: 's2', serviceAreaType: 'Üleriigiline', municipalityIds: [] })] }),
    profile({ id: 'loata', assistantRecommendationAllowed: false }),
    profile({ id: 'kinnitamata', registryCode: '12345678' }),
    profile({ id: 'teadmata', serviceItems: [service({ id: 's5', municipalityIds: ['Tartu', 'Kusagil'], availabilityStatus: null })] }),
    profile({ id: 'mustand', status: 'DRAFT', assistantRecommendationAllowed: false, serviceItems: [] })
  ];
  const counts = assistantDirectoryCounts(profiles, MUNICIPALITIES, { now: NOW });
  assert.deepEqual(counts.profiles, {
    total: 6, byStatus: { PUBLISHED: 5, DRAFT: 1 }, published: 5, consent: 4, allowed: 3, allowedWithMapLink: 2,
    blockedPublished: { [AssistantGateReason.CONSENT_MISSING]: 1, [AssistantGateReason.REPRESENTATION_UNCONFIRMED]: 1 }
  });
  assert.deepEqual(counts.services, {
    public: 3, area: { national: 1, county: 0, municipality: 1, unknown: 1 },
    unreadAreaWords: { municipalities: 1, counties: 0, ambiguous: 1 }, availability: { fresh: 2, stale: 0, unknown: 1 }
  });
  // Üleriigiline teenus katab kõik viis registri omavalitsust.
  assert.deepEqual(counts.coverage, { municipalities: 5, municipalitiesWithService: 5 });
  const printed = JSON.stringify(counts);
  assert.equal(/SALAJANE|5550000|12345678|Kusagil/u.test(printed), false);
  assert.deepEqual(assistantDirectoryCounts([], []).profiles, { total: 0, byStatus: {}, published: 0, consent: 0, allowed: 0, allowedWithMapLink: 0, blockedPublished: {} });
});

test('värava väljavalik ei loe kontakte, hindu ega kirjeldusi; vestlus väravat veel ei kasuta', () => {
  const selected = JSON.stringify(ASSISTANT_GATE_SELECT);
  for (const field of ['phone', 'email', 'website', 'address', 'primaryContactName', 'contactName', 'organizationName', 'name', 'description', 'priceDescription', 'owner']) {
    assert.equal(new RegExp(`"${field}"`, 'u').test(selected), false, field);
  }
  // Värav on ette valmistatud osa: kuni omaniku otsused on tegemata, ei tohi vestluse otsing teda kutsuda.
  const retrieval = readFileSync(new URL('../lib/rag-v2/pilot/retrieval.js', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../lib/rag-v2/pilot/service.js', import.meta.url), 'utf8');
  assert.equal(/serviceProviderAssistantGate|serviceProviderProfile/u.test(retrieval + service), false);
});
