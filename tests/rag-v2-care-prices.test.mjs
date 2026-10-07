import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { CARE_PRICES, SKA_CARE_PAGE, TABLE_NAMES, tableLink, zipEntries, sheetRows, careTable, careSources, decideHomes, refreshedCarePages } from '../lib/rag-v2/care-prices.js';

// ADR-104: the Social Insurance Board's price table of general care homes as corpus pages. The fixtures are made up:
// no real home, price or phone number.
// A small ZIP writer for the fixture workbook: deflated entries with a central directory, as Excel writes them.
function zip(files) {
  const parts = [], directory = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, 'utf8'), packed = zlib.deflateRawSync(raw), file = Buffer.from(name, 'utf8'), crc = zlib.crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(file.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(file.length, 28); central.writeUInt32LE(offset, 42);
    parts.push(local, file, packed); directory.push(central, file); offset += 30 + file.length + packed.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(directory.length / 2, 8); end.writeUInt16LE(directory.length / 2, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
const xml = value => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
/** A workbook of one sheet from rows of cell texts; numbers are written as numbers, the rest as shared strings. */
function workbook(rows) {
  const strings = [], letters = 'ABCDEFGHIJKLMNOPQR';
  const cell = (value, column, row) => {
    if (value === '' || value === null || value === undefined) return '';
    if (typeof value === 'number') return `<c r="${letters[column]}${row}"><v>${value}</v></c>`;
    strings.push(value); return `<c r="${letters[column]}${row}" t="s"><v>${strings.length - 1}</v></c>`;
  };
  const sheet = `<worksheet><sheetData>${rows.map((cells, index) => `<row r="${index + 1}" spans="1:18">${cells.map((value, column) => cell(value, column, index + 1)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zip({ 'xl/sharedStrings.xml': `<sst>${strings.map(text => `<si><t xml:space="preserve">${xml(text)}</t></si>`).join('')}</sst>`, 'xl/worksheets/sheet1.xml': sheet, 'docProps/app.xml': '<x/>' });
}
const HEADER = ['Maakond', 'HK asukoha KOV', 'Teenuseosutaja/tegevuskoht', 'Kett', 'Kohtade arv tegevusloal MTR 31.12.2025', ' Kodulehekülg', 'Hoolduskulud/märts 2026', 'Kohamaksumus(ed,  eurot kuus) märts 2026',
  'Tase I', 'Tase II ', 'Tase III', 'Tase IV', 'Võtavad dementseid', 'Tegevusloa nr', 'Ärireg.kood', 'Hoolekandeasutuse asukoha aadress', 'Telefon ', 'E-post'];
const NOTE = 'Seisuga märts 2026      *Tabelis kajastatud hinnad on ülevaatlikud ja  pärinevad omavalitsuste ja teenuseosutajate avalikelt kodulehtedelt.';
const ROWS = [
  ['Harjumaa', 'Harku vald', 'Näidiskodu AS, Mere Kodu', 'Näidiskodud', 120, 'https://www.naidiskodu.example/mere/', 1300, '2000 kaheses, 2500 üheses toas', 2000, 2500, '', '', 'jah', 'SÜH000900', '10000001', 'Mere tee 1, Tabasalu', '5550 0001; 5550 0002', 'eesnimi.perenimi@naidiskodu.example'],
  ['Harjumaa', 'Tallinn', 'Linna Hooldekodu', '', 80, 'linnakodu.example', '2 taset: 900 ja 1100', '1700; suur hooldusvajadus 1900', 1700, 1900, '', '', '', 'SÜH000901', '10000002', 'Pikk 2, Tallinn', '555 0003', 'info@linnakodu.example'],
  ['Harjumaa', 'Tallinn', 'Linna Hooldekodu', '', 40, 'linnakodu.example', '900', '1700', 1700, '', '', '', '', 'SÜH000901', '10000002', 'Pikk 4, Tallinn', 'ei ole', ''],
  ['Tartumaa', 'Peipisääre vald', 'Järve Kodu OÜ', '', 30, '', 700, '1400 & lisatasud <kokkuleppel>', 1400, '', '', '', 'kergemaid', 'SÜH000902', '10000003', 'Järve 3, Alatskivi alevik, Peipsiääre vald', '', ''],
  ['Saaremaa', 'Tundmatu vald', 'Kadunud Kodu', '', 10, '', 600, '1300', 1300, '', '', '', '', 'SÜH000903', '10000004', 'Tee 1', '', ''],
];
const municipalities = [{ id: 'harku_vald', name: 'Harku vald', county: 'Harjumaa' }, { id: 'tallinn', name: 'Tallinna linn', county: 'Harjumaa' }, { id: 'kiili_vald', name: 'Kiili vald', county: 'Harjumaa' },
  { id: 'peipsiaare_vald', name: 'Peipsiääre vald', county: 'Tartumaa' }, { id: 'muhu_vald', name: 'Muhu vald', county: 'Saaremaa' }];
const xlsx = workbook([[NOTE], HEADER, ...ROWS]), readAt = '2026-10-07T10:00:00.000Z', tableUrl = 'https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-08/tabel.xlsx';
const table = careTable(sheetRows(xlsx), municipalities);

test('the link, the archive and the sheet are read as they are', () => {
  const html = `<a href="/muu.xlsx">Hooldekodu kulude kalkulaator 2026</a> <a href="/sites/default/files/documents/2026-08/HKhinnaseire_august_2026.xlsx" class="x"><span>Hoolduskulud ja hoolduskoha maksumus</span> | 64 KB | xlsx</a>`;
  assert.equal(tableLink(html), 'https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-08/HKhinnaseire_august_2026.xlsx');
  assert.equal(tableLink('<a href="/x.pdf">Hoolduskulud ja hoolduskoha maksumus</a>'), null);
  assert.ok(SKA_CARE_PAGE.startsWith('https://sotsiaalkindlustusamet.ee/'));
  assert.deepEqual([...zipEntries(xlsx).keys()], ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml', 'docProps/app.xml']);
  assert.throws(() => zipEntries(Buffer.from('not a zip at all, only text')), /not a zip archive/u);
  const rows = sheetRows(xlsx);
  assert.deepEqual([rows.length, rows[1].cells.B, rows[2].cells.E, rows[5].cells.H], [7, 'HK asukoha KOV', '120', '1400 & lisatasud <kokkuleppel>']);
  // An empty cell is no cell: the third data row has no chain and no second level.
  assert.deepEqual([Object.hasOwn(rows[4].cells, 'D'), Object.hasOwn(rows[4].cells, 'J')], [false, false]);
});

test('the table as data: the month, each home in its municipality, nothing guessed', () => {
  assert.equal(table.asOf, 'märts 2026');
  assert.deepEqual(table.homes.map(home => [home.name, home.municipality.id, home.county]), [['Näidiskodu AS, Mere Kodu', 'harku_vald', 'Harju maakond'], ['Linna Hooldekodu', 'tallinn', 'Harju maakond'],
    ['Linna Hooldekodu', 'tallinn', 'Harju maakond'], ['Järve Kodu OÜ', 'peipsiaare_vald', 'Tartu maakond']]);
  // The table's own spellings are known by name; another one is a problem to look at, and its row is left out.
  assert.deepEqual([TABLE_NAMES.Tallinn, TABLE_NAMES['Peipisääre vald']], ['Tallinna linn', 'Peipsiääre vald']);
  assert.deepEqual(table.problems, { withoutMunicipality: ['Kadunud Kodu (Tundmatu vald)'], withoutPrice: [], repeated: [] });
  const [mere, linn, teine, jarve] = table.homes;
  assert.deepEqual([mere.price, mere.careCost, mere.levels, mere.places, mere.dementia, mere.chain, mere.licence], ['2000 kaheses, 2500 üheses toas', '1300', [2000, 2500], 120, 'jah', 'Näidiskodud', 'SÜH000900']);
  // A website with or without its scheme; the first whole phone number; no e-mail address anywhere.
  assert.deepEqual([mere.website, linn.website, jarve.website], ['https://www.naidiskodu.example/mere/', 'https://linnakodu.example/', null]);
  assert.deepEqual([mere.phone, linn.phone, teine.phone, jarve.phone], ['55500001', '5550003', null, null]);
  assert.equal(JSON.stringify(table).includes('@'), false);
  // Two places of activity under one licence and name are two homes.
  assert.notEqual(linn.key, teine.key);
  assert.deepEqual([linn.careCost, jarve.dementia], ['2 taset: 900 ja 1100', 'kergemaid']);
  // A table without its header or a needed column is refused.
  assert.throws(() => careTable(sheetRows(workbook([['midagi muud']])), municipalities), /no header row/u);
});

test('the pages: one for every municipality with a home in its county, and an overview of the country', () => {
  const sources = careSources(table, { municipalities, readAt, tableUrl }), byPath = Object.fromEntries(sources.map(source => [source.path, source]));
  assert.deepEqual(sources.map(source => source.path), ['hooldekodud/kov/harku_vald.html', 'hooldekodud/kov/tallinn.html', 'hooldekodud/kov/kiili_vald.html', 'hooldekodud/kov/peipsiaare_vald.html', 'hooldekodud/ulevaade.html']);
  // Muhu vald: neither a home of its own nor one in its county, so no page.
  const harku = byPath['hooldekodud/kov/harku_vald.html'], text = html => html.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ');
  assert.equal(harku.metadata.title, 'Hooldekodude kohamaksumus: Harku vald');
  assert.deepEqual([harku.metadata.source_type, harku.metadata.municipality_id, harku.metadata.url, harku.metadata.checked_at, harku.metadata.collection], ['registry', 'harku_vald', SKA_CARE_PAGE, '2026-10-07',
    { collector: CARE_PRICES, table: tableUrl, as_of: 'märts 2026', homes: 1 }]);
  for (const phrase of ['<h2>Näidiskodu AS, Mere Kodu</h2>', 'Koha maksumus kuus eurodes (seisuga märts 2026): 2000 kaheses, 2500 üheses toas.', 'Hoolduskulu kuus eurodes (seisuga märts 2026): 1300.', 'Kohti tegevusloal: 120.',
    'Võtab vastu dementsusega inimesi: jah.', 'Aadress: Mere tee 1, Tabasalu, Harku vald.', 'Telefon: 55500001.', '<a href="https://www.naidiskodu.example/mere/">naidiskodu.example/mere</a>', 'Kett: Näidiskodud.',
    'seisuga märts 2026; tabel on loetud 07.10.2026', 'hetkel kehtiva hinna saab hooldekodu kodulehelt või teenuseosutajalt', 'Inimene võib valida hooldekodu ka teisest omavalitsusest.',
    '<h2>Teised hooldekodud samas maakonnas (Harju maakond)</h2>', '<li>Linna Hooldekodu, Pikk 2 (Tallinna linn): koha maksumus kuus alates 1700 eurost; koduleht linnakodu.example.</li>']) assert.ok(harku.html.includes(phrase), phrase);
  // Two homes of one name are told apart by the address, in a heading and in a line.
  assert.ok(byPath['hooldekodud/kov/tallinn.html'].html.includes('<h2>Linna Hooldekodu, Pikk 4</h2>'));
  // A municipality without a home has a page of its own: it says so and gives the county's homes in full.
  const kiili = byPath['hooldekodud/kov/kiili_vald.html'];
  assert.ok(text(kiili.html).includes('Omavalitsuses Kiili vald ei ole Sotsiaalkindlustusameti hinnaseire tabelis ühtegi hooldekodu.'));
  assert.ok(kiili.html.includes('<h2>Näidiskodu AS, Mere Kodu (Harku vald)</h2>') && kiili.html.includes('Telefon: 55500001.'));
  assert.deepEqual(kiili.metadata.collection, { collector: CARE_PRICES, table: tableUrl, as_of: 'märts 2026', homes: 0, county_homes: 3 });
  // The table's own words are escaped, never read as markup.
  assert.ok(byPath['hooldekodud/kov/peipsiaare_vald.html'].html.includes('1400 &amp; lisatasud &lt;kokkuleppel&gt;'));
  // The overview is no municipality's source and gives the range of the lowest listed prices.
  const overview = byPath['hooldekodud/ulevaade.html'];
  assert.deepEqual([overview.metadata.municipality_id, overview.metadata.regions, overview.metadata.collection.homes], [undefined, undefined, 4]);
  assert.ok(text(overview.html).includes('on 4 üldhooldusteenuse osutaja tegevuskohta (hooldekodu). Iga hooldekodu madalaim loetletud koha maksumus kuus jääb vahemikku 1400–2000 eurot, mediaan on 1700 eurot (seisuga märts 2026).'));
  assert.ok(overview.html.includes('<li>Harju maakond: 3 hooldekodu; madalaim loetletud koha maksumus kuus jääb vahemikku 1700–2000 eurot, mediaan 1700 eurot.</li>'));
  // No e-mail address reaches a page.
  assert.ok(sources.every(source => !source.html.includes('@')));
});

test('the refresh: a change is applied on its second equal reading, a home that is gone waits for a person, a page is made again only for what it says', () => {
  const again = careTable(sheetRows(workbook([[NOTE.replace('märts', 'juuni')], HEADER, ...ROWS.slice(1, 4), ['Harjumaa', 'Harku vald', 'Uus Kodu OÜ', '', 20, '', 800, '1500', 1500, '', '', '', '', 'SÜH000905', '10000005', 'Uus 1, Harku', '', '']])), municipalities);
  const first = decideHomes({ accepted: table, read: again });
  // The first reading only proposes: the new month changes every home, one is new, one is gone.
  assert.deepEqual([first.applied, first.proposed.map(change => change.kind).sort(), first.table.asOf, first.table.homes.length], [[], ['added', 'changed', 'changed', 'changed', 'removed'], 'märts 2026', 4]);
  const second = decideHomes({ accepted: table, read: again, pending: first.proposed });
  assert.deepEqual([second.applied.map(change => change.kind).sort(), second.removalsWaiting.map(change => change.name), second.table.asOf, second.table.homes.length],
    [['added', 'changed', 'changed', 'changed'], ['Näidiskodu AS, Mere Kodu'], 'juuni 2026', 5]);
  // The home that is gone stays until a person approves; then it goes.
  const approved = decideHomes({ accepted: table, read: again, pending: first.proposed, approveRemovals: [table.homes[0].key] });
  assert.deepEqual([approved.removalsWaiting, approved.table.homes.some(home => home.name === 'Näidiskodu AS, Mere Kodu'), approved.table.homes.length], [[], false, 4]);
  // A different change in the second reading is a new proposal, not a confirmation.
  const other = careTable(sheetRows(workbook([[NOTE.replace('märts', 'juuli')], HEADER, ...ROWS])), municipalities);
  assert.deepEqual(decideHomes({ accepted: table, read: other, pending: first.proposed }).applied, []);
  // The pages: nothing to ingest when only the day of the reading differs; a changed table changes its pages.
  const ingested = new Map(careSources(table, { municipalities, readAt, tableUrl }).map(source => [source.path, source.html]));
  const same = refreshedCarePages({ table, municipalities, readAt: '2026-11-01T08:00:00.000Z', tableUrl, ingested });
  assert.deepEqual([same.changed, same.unchanged, same.gone], [[], 5, []]);
  const changed = refreshedCarePages({ table: second.table, municipalities, readAt: '2026-11-03T08:00:00.000Z', tableUrl, ingested });
  assert.deepEqual([changed.changed.map(made => `${made.state}: ${made.path}`).length, changed.unchanged, changed.changed.every(made => made.html.includes('seisuga juuni 2026'))], [5, 0, true]);
  // A reading with the table's rows in another order changes no page (07.10.2026: 37 of 79 pages showed as changed,
  // because the accepted homes had been put in another order than the one the pages were made in).
  const reordered = careTable(sheetRows(workbook([[NOTE], HEADER, ...[...ROWS].reverse()])), municipalities), kept = decideHomes({ accepted: table, read: reordered });
  assert.deepEqual([kept.proposed, kept.table.homes.map(home => home.key)], [[], table.homes.map(home => home.key)]);
  assert.deepEqual(refreshedCarePages({ table: kept.table, municipalities, readAt, tableUrl, ingested }).changed, []);
  const fresh = refreshedCarePages({ table, municipalities, readAt, tableUrl, ingested: new Map() });
  assert.deepEqual([fresh.changed.every(made => made.state === 'new'), fresh.changed.length], [true, 5]);
});
