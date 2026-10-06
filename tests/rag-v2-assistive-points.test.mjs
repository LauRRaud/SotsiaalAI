import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, pointOf, collectPoints, publicPoint, csvReader, FIELDS, CATEGORIES, COUNTIES, SERVICES, SKA_MAP_CSV, TABLE_NAMES } from '../lib/rag-v2/assistive-points.js';

// The official map of assistive device sales points, read as its table. Every point, address and contact below is made up.
const HEADER = 'E-post,Kodulehe aadress,Lähiaadress,Müügipunkt,Telefon,Geometry point,Latitude (generated),Longitude (generated)';
const line = point => [point.email ?? '', point.site ?? '', point.address, point.name, point.phone ?? '', 'Point', point.lat ?? '', point.lon ?? ''].map(value => (/[",\n]/u.test(String(value)) ? `"${String(value).replace(/"/gu, '""')}"` : value)).join(',');
const csv = points => `${String.fromCharCode(0xFEFF)}${HEADER}\r\n${points.map(line).join('\r\n')}\r\n`;
const HEARING = { name: 'Näidiskuulmiskeskus OÜ Tartus', address: 'Näidise tn 1', site: 'www.kuulmine.example', phone: '5555 0001', email: 'tartu@kuulmine.example', lat: '58.38', lon: '26.72' };
const SHOP = { name: 'Abivahendipood "Tugi", Elva esindus', address: 'Kesk tn 2, II korrus', site: 'https://tugi.example/elva', phone: '5555 0002', email: 'mari.maasikas@tugi.example', lat: '58.22', lon: '26.42' };
const PHARMACY = { name: 'Näidisapteek', address: 'Turu tn 3', phone: '5555 0003', lat: '', lon: '' };
const CAPITAL = { name: 'Näidisapteek pealinnas', address: 'Linna tn 4', lat: '59.43', lon: '24.75' };

test('the table\'s rows are read with their quotes, commas and the mark at the file\'s start', () => {
  const rows = parseCsv(csv([HEARING, SHOP, PHARMACY]));
  assert.equal(rows.length, 3);
  assert.deepEqual(Object.keys(rows[0]), ['E-post', 'Kodulehe aadress', 'Lähiaadress', 'Müügipunkt', 'Telefon', 'Geometry point', 'Latitude (generated)', 'Longitude (generated)']);
  assert.deepEqual([rows[1]['Müügipunkt'], rows[1]['Lähiaadress']], ['Abivahendipood "Tugi", Elva esindus', 'Kesk tn 2, II korrus']);
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv(`${HEADER}\n`), []);
  // A field may hold a line break; a row of another width is not a row of this table.
  assert.deepEqual(parseCsv('a,b\n"x\ny",z\nonly-one\n'), [{ a: 'x\ny', b: 'z' }]);
  const point = pointOf(rows[0]);
  assert.deepEqual(point, { key: 'näidiskuulmiskeskus oü tartus|näidise tn 1|58.38,26.72', name: 'Näidiskuulmiskeskus OÜ Tartus', address: 'Näidise tn 1', lat: 58.38, lon: 26.72,
    website: 'https://www.kuulmine.example/', phone: '5555 0001', email: 'tartu@kuulmine.example' });
  assert.deepEqual([pointOf(rows[2]).lat, pointOf(rows[2]).website, pointOf(rows[2]).email], [null, null, null]);
  assert.equal(pointOf({ ...rows[0], 'Kodulehe aadress': 'ei ole' }).website, null);
  // An e-mail address typed into the website column is a contact, not a website.
  assert.equal(pointOf({ ...rows[0], 'Kodulehe aadress': 'pood@kuulmine.example' }).website, null);
});

test('a point\'s place and offers are what the table\'s readings say, and nothing else', async () => {
  const asked = [];
  // The dashboard as a function of its filters.
  const read = async filters => {
    asked.push(filters);
    const keys = Object.keys(filters);
    if (!keys.length) return parseCsv(csv([HEARING, SHOP, PHARMACY, CAPITAL]));
    // The table holds the hearing centre on two rows (a second contact): it is one point, in its municipality once.
    if (filters[FIELDS.municipality]) return parseCsv(csv({ 'Tartu linn': [HEARING, { ...HEARING, phone: '5555 0009', email: 'teine@kuulmine.example' }], 'Elva vald': [SHOP], Tallinn: [CAPITAL] }[filters[FIELDS.municipality]] || []));
    if (filters[FIELDS.county]) return parseCsv(csv(filters[FIELDS.county] === 'Tartu maakond' ? [HEARING, SHOP, PHARMACY] : []));
    const offer = `${filters[FIELDS.category]}/${filters[FIELDS.service]}`;
    return parseCsv(csv({ 'Kuulmisabivahendid/müük': [HEARING], 'Liikumisabivahendid/müük ja üür': [SHOP], 'Olmeabivahendid/müük': [SHOP, PHARMACY],
      // A point the whole table does not hold is not made up from a narrower reading.
      'Juhtkoerad/müük': [{ name: 'Tundmatu punkt', address: 'Mujal 9', lat: '59', lon: '25' }] }[offer] || []));
  };
  // A municipality listed twice is asked once; the capital is asked by the table's name for it.
  const municipalities = [{ id: 'tartu_linn', name: 'Tartu linn' }, { id: 'elva_vald', name: 'Elva vald' }, { id: 'noo_vald', name: 'Nõo vald' }, { id: 'tartu_linn', name: 'Tartu linn' }, { id: 'tallinna_linn', name: 'Tallinna linn' }];
  assert.deepEqual(TABLE_NAMES, { 'Tallinna linn': 'Tallinn' });
  const { points, readings, problems } = await collectPoints({ read, municipalities });
  assert.equal(readings, 1 + 4 + COUNTIES.length + CATEGORIES.length * SERVICES.length);
  assert.deepEqual(asked.filter(filters => filters[FIELDS.municipality]).map(filters => filters[FIELDS.municipality]), ['Tartu linn', 'Elva vald', 'Nõo vald', 'Tallinn']);
  assert.equal(asked.length, readings);
  assert.deepEqual(points.map(point => [point.name, point.municipalities.map(item => item.id), point.counties, point.offers]), [
    ['Abivahendipood "Tugi", Elva esindus', ['elva_vald'], ['Tartu maakond'], [{ category: 'Liikumisabivahendid', service: 'müük ja üür' }, { category: 'Olmeabivahendid', service: 'müük' }]],
    ['Näidisapteek', [], ['Tartu maakond'], [{ category: 'Olmeabivahendid', service: 'müük' }]],
    ['Näidisapteek pealinnas', ['tallinna_linn'], [], []],
    ['Näidiskuulmiskeskus OÜ Tartus', ['tartu_linn'], ['Tartu maakond'], [{ category: 'Kuulmisabivahendid', service: 'müük' }]]]);
  assert.deepEqual(problems, { withoutMunicipality: 1, inSeveralMunicipalities: 0, withoutCounty: 1, withoutOffer: 1, withoutPlaceOnMap: 1, notInTheWholeTable: 1 });
});

test('a point goes into the repository and the corpus without its phone number and e-mail address', () => {
  const full = { ...pointOf(parseCsv(csv([SHOP]))[0]), municipalities: [{ id: 'elva_vald', name: 'Elva vald' }], counties: ['Tartu maakond'], offers: [{ category: 'Liikumisabivahendid', service: 'müük ja üür' }] };
  const kept = publicPoint(full);
  assert.deepEqual(kept, { name: 'Abivahendipood "Tugi", Elva esindus', address: 'Kesk tn 2, II korrus', lat: 58.22, lon: 26.42, website: 'https://tugi.example/elva',
    offers: [{ category: 'Liikumisabivahendid', service: 'müük ja üür' }], municipality: { id: 'elva_vald', name: 'Elva vald' }, county: 'Tartu maakond' });
  assert.equal(/5555|maasikas|@/u.test(JSON.stringify(kept)), false);
  // A point the readings place in no municipality, or in two, has none: the place is not guessed.
  assert.deepEqual([publicPoint({ ...full, municipalities: [] }).municipality, publicPoint({ ...full, municipalities: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }).municipality], [null, null]);
});

test('the table is read politely over the web: the filters in the address, an honest name, a refusal said', async () => {
  const calls = [], waits = [];
  const reader = csvReader({ agent: 'SotsiaalAI source collector/1.0 (+https://sotsiaal.pro)', wait: async () => { waits.push(1); },
    fetchImpl: async (address, options) => { calls.push([address, options.headers['User-Agent']]);
      return address.includes('keelatud') ? new Response('<html>', { status: 403, headers: { 'content-type': 'text/html' } }) : new Response(csv([HEARING]), { status: 200, headers: { 'content-type': 'text/csv' } }); } });
  assert.equal((await reader({})).length, 1);
  assert.equal((await reader({ [FIELDS.municipality]: 'Tartu linn', [FIELDS.category]: 'Põetus- ja hooldus abivahendid' })).length, 1);
  assert.deepEqual(calls, [[SKA_MAP_CSV, 'SotsiaalAI source collector/1.0 (+https://sotsiaal.pro)'],
    [`${SKA_MAP_CSV}?KOV=Tartu%20linn&Toote%20kategooria%20nimetus%20rakenduses=P%C3%B5etus-%20ja%20hooldus%20abivahendid`, 'SotsiaalAI source collector/1.0 (+https://sotsiaal.pro)']]);
  assert.equal(waits.length, 2);
  await assert.rejects(csvReader({ agent: 'x', url: 'https://naidis.example/keelatud.csv', fetchImpl: async () => new Response('<html>', { status: 403, headers: { 'content-type': 'text/html' } }) })({}), { code: 'map_table_unreadable', status: 403 });
});
