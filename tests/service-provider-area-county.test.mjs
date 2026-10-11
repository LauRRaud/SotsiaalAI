// Teeninduskoha ja teenuse maakond (ADR-144 järeltöö).
//
// Kaks viga, mida need testid kinni hoiavad:
//   1. teeninduskohal ei ole vormis maakonna välja: ta päris maakonna loomisel profiililt ja see jäi
//      valeks, kui profiili maakonda hiljem muudeti. „Teeninduskoha põhine" teenus loeti siis vale
//      maakonna järgi. Nüüd tuleb koha maakond ametlikust aadressivastest;
//   2. server kopeeris profiili maakonna iga tühja maakonnaga teenusele: osutaja ei saanud teenuse
//      maakonda tühjaks jätta ja koopia jäi valeks, kui profiili maakond muutus. Nüüd tähendab tühi
//      „sama mis profiilil" ja lugeja võtab profiili maakonna lugemise hetkel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signServiceMapSuggestion } from '../lib/serviceMap/addressSuggestionToken.js';
import { normalizeServiceProviderLocationsInput, normalizeServiceProviderServiceInput } from '../lib/serviceProviderProfiles.js';
import { ServiceAreaKind, countyFromOfficialAddress, countyKey, municipalityRegister, readServiceArea } from '../lib/serviceProviderServiceArea.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const registerRows = JSON.parse(read('../src/server/data/municipalities.rich.json'));
const REGISTER = municipalityRegister(registerRows);
const COUNTIES = [...new Set(registerRows.map((row) => row.county))];
const UNREAD_NONE = { municipalities: 0, counties: 0, ambiguous: 0 };

/* Allkirjastatud aadressivaste, nagu aadressiotsing selle vormile annab. */
const ENV = { SERVICE_MAP_SUGGESTION_SECRET: 'test-secret' };
const OPTIONS = { userId: 'user-1', env: ENV };
const tokenFor = (normalizedAddress) =>
  signServiceMapSuggestion({ normalizedAddress, latitude: 59.35, longitude: 24.62, adsObjectId: 'ads-1', provider: 'maaruum' }, OPTIONS);
const locations = (items, profileDefaults = { county: 'Tartumaa', status: 'PUBLISHED' }) =>
  normalizeServiceProviderLocationsInput({ serviceLocations: items }, profileDefaults, OPTIONS);

test('maakond loetakse ametlikust aadressist registri kujul', () => {
  assert.equal(COUNTIES.length, 15);
  for (const county of COUNTIES) {
    /* Aadressiregister kirjutab „Harju maakond", register „Harjumaa". */
    const inAddress = county.replace(/maa$/u, ' maakond');
    assert.notEqual(inAddress, county, county);
    /* Mõlemad aadressikujud: väiksemast suuremani ja suuremast väiksemani. */
    assert.equal(countyFromOfficialAddress(`Lossi 1, Keskuse alevik, Näidise vald, ${inAddress}`), county);
    assert.equal(countyFromOfficialAddress(`${inAddress}, Näidise vald, Keskuse alevik, Lossi 1`), county);
    assert.ok(REGISTER.counties.has(countyKey(countyFromOfficialAddress(`Lossi 1, ${inAddress}`))), county);
  }
  assert.equal(countyFromOfficialAddress('Veskitammi 4, Laagri alevik, Saue vald, Harju maakond'), 'Harjumaa');
  assert.equal(countyFromOfficialAddress('Narva mnt 1, Kesklinna linnaosa, Tallinn, Harju maakond'), 'Harjumaa');
  assert.equal(countyFromOfficialAddress('Kungla tn 12, Valga linn,  Valga maakond '), 'Valgamaa');
  /* Aadress ilma maakonnata ei anna midagi; tänavanimi „Maakonna tee" ei ole maakond. */
  for (const address of ['', null, undefined, 'Lossi 1, Põltsamaa', 'Maakonna tee 3, Tartu linn', 'maakond', 'Lossi 1, maakond']) {
    assert.equal(countyFromOfficialAddress(address), '', String(address));
  }
});

test('teeninduskoha maakond tuleb aadressivastest, mitte profiililt ega vormilt', () => {
  const address = 'Veskitammi 4, Laagri alevik, Saue vald, Harju maakond';
  /* Vorm saadab vana päritud maakonna kaasa ja profiilil on teine maakond: kehtib aadressi oma. */
  const [matched] = locations([{ clientId: 'l1', label: 'Keskus', address, geocodingSuggestionToken: tokenFor(address), county: 'Tartumaa' }]);
  assert.deepEqual([matched.county, matched.geocodingStatus, matched.normalizedAddress], ['Harjumaa', 'MATCHED', address]);
  /* Profiili maakonna muutmine kohta ei muuda: aadress on sama. */
  const [later] = locations([{ clientId: 'l1', address, geocodingSuggestionToken: tokenFor(address), county: 'Harjumaa' }], { county: 'Raplamaa', status: 'PUBLISHED' });
  assert.equal(later.county, 'Harjumaa');
  /* Aadressivasteta kohal (käsitsi kirjutatud aadress) oma maakonda ei ole: profiili oma ei kopeerita. */
  const [typed] = locations([{ clientId: 'l2', label: 'Tuba', address: 'Lossi 1, Põltsamaa', county: 'Tartumaa' }]);
  assert.deepEqual([typed.county, typed.geocodingStatus], [null, 'PENDING']);
  /* Võltsitud vaste ei loe: allkirjata aadressist maakonda ei võeta. */
  const [forged] = locations([{ clientId: 'l3', address, normalizedAddress: address, geocodingSuggestionToken: 'vale.allkiri', county: 'Harjumaa' }]);
  assert.deepEqual([forged.county, forged.geocodingStatus], [null, 'PENDING']);
  /* Vaste, mille aadressis maakonda ei ole, hoiab senise maakonna. */
  const bare = 'Lossi 1, Põltsamaa linn';
  const [kept] = locations([{ clientId: 'l4', address: bare, geocodingSuggestionToken: tokenFor(bare), county: 'Jõgevamaa' }]);
  assert.equal(kept.county, 'Jõgevamaa');
});

test('teenuse tühi maakond jääb tühjaks: profiili maakonda ei kopeerita', () => {
  const profile = { county: 'Tartumaa', status: 'PUBLISHED' };
  const service = (input) => normalizeServiceProviderServiceInput({ name: 'Koduteenus', ...input }, 0, profile, null);
  assert.equal(service({ county: '' }).county, null);
  assert.equal(service({}).county, null);
  assert.equal(service({ county: ' Raplamaa ' }).county, 'Raplamaa');
  /* Teised profiililt tulevad vaikeväärtused jäävad: hinnastus ja olek. */
  assert.equal(normalizeServiceProviderServiceInput({ name: 'Koduteenus' }, 0, { ...profile, feeType: 'FREE' }, null).feeType, 'FREE');
  assert.equal(service({}).status, 'PUBLISHED');
});

test('lugeja: koha maakond aadressist, tühi teenuse maakond profiililt lugemise hetkel', () => {
  const address = 'Veskitammi 4, Laagri alevik, Saue vald, Harju maakond';
  const [place] = locations([{ clientId: 'l1', address, geocodingSuggestionToken: tokenFor(address) }]);
  const saved = { ...place, id: 'l1', status: 'PUBLISHED', mapVisible: true };
  const profile = { county: 'Tartumaa', serviceAreaMunicipalityIds: [], serviceLocations: [saved] };

  /* Teeninduskoha põhine teenus loetakse koha päris maakonna järgi, kuigi profiilil on teine. */
  const byPlace = readServiceArea({ serviceAreaType: 'Teeninduskoha põhine', county: null, locationLinks: [] }, profile, REGISTER);
  assert.deepEqual([byPlace.kind, byPlace.counties, byPlace.unread], [ServiceAreaKind.COUNTY, ['harju'], UNREAD_NONE]);
  /* Aadressivasteta kohal maakonda ei ole: lugeja võtab profiili maakonna. */
  const [typed] = locations([{ clientId: 'l2', label: 'Tuba', address: 'Lossi 1' }]);
  const typedProfile = { ...profile, serviceLocations: [{ ...typed, id: 'l2', status: 'PUBLISHED', mapVisible: true }] };
  assert.deepEqual(readServiceArea({ serviceAreaType: 'Teeninduskoha põhine' }, typedProfile, REGISTER).counties, ['tartu']);

  /* Maakondlik teenus tühja maakonnaga: profiili maakond; kui profiil muutub, muutub ka teenus. */
  const inherits = normalizeServiceProviderServiceInput({ name: 'Tugiisik', serviceAreaType: 'Maakondlik', county: '' }, 0, profile, null);
  assert.deepEqual(readServiceArea(inherits, profile, REGISTER).counties, ['tartu']);
  assert.deepEqual(readServiceArea(inherits, { ...profile, county: 'Raplamaa' }, REGISTER).counties, ['rapla']);
  /* Teenuse oma maakond kehtib profiili omast üle. */
  const own = normalizeServiceProviderServiceInput({ name: 'Tugiisik', serviceAreaType: 'Maakondlik', county: 'Võrumaa' }, 0, profile, null);
  assert.deepEqual(readServiceArea(own, profile, REGISTER).counties, ['võru']);
});

test('teenusekaardi otsing leiab osutaja maakonna nimega ka siis, kui teenus pärib maakonna profiililt', () => {
  const source = read('../lib/serviceProviderProfiles.js');
  const filters = source.slice(source.indexOf('async function buildPublishedServiceMapFilters'), source.indexOf('export async function listPublishedServiceMapEntries'));
  /* Vabasõnaotsing luges teenuse maakonda, mis enne oli profiili koopia: nüüd loeb ta ka profiili maakonda. */
  assert.ok(filters.includes('{ providerProfile: { is: { county: { contains: normalizedKeyword, mode: "insensitive" } } } }'));
  assert.ok(filters.includes('serviceItems: { some: { mapVisible: true, status: "PUBLISHED", county: { contains: normalizedKeyword, mode: "insensitive" } } }'));
  /* Maakonna filter teenuse maakonda ei kasuta: kaardikirje (profiili) maakond ja teeninduskoha maakond või aadress. */
  const countyFilter = filters.slice(filters.indexOf('const normalizedCounty = normalizeText(county);'), filters.indexOf('const normalizedKeyword = normalizeText(keyword);'));
  assert.ok(countyFilter.includes('{ county: { contains: normalizedCounty, mode: "insensitive" } }'));
  assert.ok(countyFilter.includes('address: { contains: normalizedCounty, mode: "insensitive" }'));
});
