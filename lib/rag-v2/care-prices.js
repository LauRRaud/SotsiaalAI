import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { countyName } from './assistive-points.js';

// ADR-104 (owner, 07.10.2026: "selle vist võiks ka ära teha": the care homes' price table into the corpus, a page for
// every municipality with the date, refreshed monthly). On that day a user asked what a care home costs, named the
// place and the home, and the answer could give no amount: the corpus had the Social Insurance Board's page that
// describes its price table, not the table.
// The source is the Board's price monitoring table of general care homes ("Hoolduskulud ja hoolduskoha maksumus"), an
// Excel file linked from its page on the general care service. The Board says of it: the prices are an overview from
// the municipalities' and the providers' public websites, and the price in force is on the home's own site or asked
// from the provider. Each row is a place of activity: where it is, whose it is, its places, website, the care costs
// (the part the person's municipality pays up to its own limit), the monthly price or prices, whether it takes people
// with dementia, its address and phone. The e-mail addresses are not read: many are a person's own.
// Nothing is guessed: a home's place, prices and words are the table's.
export const CARE_PRICES = 'rag-v2/care-prices-1';
export const SKA_CARE_PAGE = 'https://sotsiaalkindlustusamet.ee/spetsialistile-ja-koostoopartnerile/kohalike-omavalitsuste-noustamine/uldhooldusteenus';
// The table's link on the Board's page, by its own words; the file's address changes with every new table.
export const TABLE_LINK = /Hoolduskulud ja hoolduskoha maksumus/u;
// Where the table writes a municipality otherwise than the corpus does. Found on the first reading (07.10.2026); a
// reading that leaves a home without a municipality says another such name exists (problems.withoutMunicipality).
export const TABLE_NAMES = Object.freeze({ Tallinn: 'Tallinna linn', 'Peipisääre vald': 'Peipsiääre vald' });

const decode = text => text.replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, '\'').replace(/&amp;/gu, '&');
const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

/** The link of the price table on the Board's page: an absolute address of an .xlsx file, or null. */
export function tableLink(html, base = SKA_CARE_PAGE) {
  for (const found of String(html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu)) {
    const text = decode(found[2].replace(/<[^>]+>/gu, ' '));
    if (TABLE_LINK.test(text) && /\.xlsx(?:[?#]|$)/iu.test(found[1])) return new URL(decode(found[1]), base).href;
  }
  return null;
}

/** The files of a ZIP archive (an .xlsx is one): name → bytes. Stored and deflated entries; anything else is refused. */
export function zipEntries(buffer) {
  let end = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65557); at--) if (buffer.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  if (end < 0) throw Error('not a zip archive');
  const count = buffer.readUInt16LE(end + 10), entries = new Map();
  let at = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw Error('zip directory is damaged');
    const method = buffer.readUInt16LE(at + 10), size = buffer.readUInt32LE(at + 20), nameLength = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42), name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw Error('zip entry is damaged');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28), bytes = buffer.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw Error(`zip entry ${name} is packed in a way this reader does not read`);
    entries.set(name, method === 8 ? zlib.inflateRawSync(bytes) : bytes);
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** The rows of a workbook's first sheet: [{ row, cells: { A: text, … } }], empty cells left out. */
export function sheetRows(xlsx) {
  const files = zipEntries(xlsx), text = name => files.get(name)?.toString('utf8') ?? null;
  const sheet = [...files.keys()].filter(name => /^xl\/worksheets\/sheet\d+\.xml$/u.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0];
  if (!sheet) throw Error('the workbook has no sheet');
  const strings = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/gu)].map(item => decode([...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gu)].map(part => part[1]).join('')));
  return [...text(sheet).matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/gu)].map(found => ({ row: Number(found[1]),
    cells: Object.fromEntries([...found[2].matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)].map(cell => {
      const body = cell[3] || '', value = body.match(/<v>([\s\S]*?)<\/v>/u)?.[1], inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/u)?.[1];
      return [cell[1], clean(/\bt="s"/u.test(cell[2]) && value !== undefined ? strings[Number(value)] ?? '' : decode(value ?? inline ?? ''))];
    }).filter(([, value]) => value !== '')) }));
}

// The table's columns by the words of its header row; their order and the month in a heading may change.
const COLUMNS = Object.freeze({ county: /^Maakond$/iu, municipality: /KOV/u, name: /Teenuseosutaja/iu, chain: /^Kett$/iu, places: /Kohtade arv/iu, website: /Kodulehek/iu, careCost: /^Hoolduskulud/iu,
  price: /^Kohamaksumus/iu, level1: /^Tase I$/iu, level2: /^Tase II$/iu, level3: /^Tase III$/iu, level4: /^Tase IV$/iu, dementia: /dements/iu, licence: /^Tegevusloa nr/iu, address: /aadress/iu, phone: /^Telefon/iu });
const REQUIRED = Object.freeze(['municipality', 'name', 'price']);
const amount = value => { const text = clean(value).replace(',', '.'); return /^\d+(?:\.\d+)?$/u.test(text) ? Number(text) : null; };
// A general phone number may stand in an answer (ADR-096): the first whole Estonian number of the cell.
const phoneOf = value => clean(value).split(/[;,/]/u).map(part => part.replace(/[\s-]/gu, '').replace(/^\+372/u, '')).find(digits => /^\d{7,8}$/u.test(digits)) ?? null;
const siteOf = value => { const text = clean(value); if (!text) return null; try { const url = new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`); return /^[a-z0-9.-]+\.[a-z]{2,}$/iu.test(url.hostname) ? url.href : null; } catch { return null; } };

/**
 * The table as data. rows: sheetRows of the file; municipalities: [{ id, name, county }], every municipality of the
 * corpus. Returns { asOf, note, homes, problems }: asOf is the month the table says its prices are of ("märts 2026"),
 * each home { key, name, chain, municipality: { id, name }, county, places, website, careCost, price, levels, dementia,
 * licence, address, phone }. A row whose municipality the corpus does not know is left out and named in problems.
 */
export function careTable(rows, municipalities) {
  const header = rows.find(item => Object.values(item.cells).some(value => COLUMNS.name.test(value)) && Object.values(item.cells).some(value => COLUMNS.price.test(value)));
  if (!header) throw Error('the table has no header row');
  const column = Object.fromEntries(Object.entries(COLUMNS).map(([field, pattern]) => [field, Object.entries(header.cells).find(([, value]) => pattern.test(value))?.[0] ?? null]));
  for (const field of REQUIRED) if (!column[field]) throw Error(`the table has no column for ${field}`);
  const note = clean(rows.filter(item => item.row < header.row).map(item => Object.values(item.cells).join(' ')).join(' '));
  const asOf = (note.match(/Seisuga\s+([\p{L}]+\s+\d{4})/u) || Object.values(header.cells).join(' ').match(/([\p{L}]+\s+\d{4})/u))?.[1]?.toLowerCase() ?? null;
  const byName = new Map(municipalities.map(item => [item.name, item])), homes = [], withoutMunicipality = [], withoutPrice = [];
  for (const item of rows.filter(entry => entry.row > header.row)) {
    const cell = field => (column[field] ? clean(item.cells[column[field]]) : ''), name = cell('name');
    if (!name) continue;
    const written = cell('municipality'), municipality = byName.get(TABLE_NAMES[written] ?? written);
    if (!municipality) { withoutMunicipality.push(`${name} (${written || 'tühi'})`); continue; }
    if (!cell('price')) { withoutPrice.push(name); continue; }
    const levels = ['level1', 'level2', 'level3', 'level4'].map(field => amount(cell(field))).filter(value => value !== null);
    // Two places of activity may share a licence and a name (two houses side by side): the address tells them apart.
    homes.push({ key: `${cell('licence') || 'loata'}|${name.toLowerCase()}|${cell('address').toLowerCase()}`, name, chain: cell('chain') || null, municipality: { id: municipality.id, name: municipality.name },
      county: countyName(municipality.county ?? cell('county')), places: amount(cell('places')), website: siteOf(cell('website')), careCost: cell('careCost') || null, price: cell('price'), levels,
      dementia: cell('dementia') || null, licence: cell('licence') || null, address: cell('address') || null, phone: phoneOf(cell('phone')) });
  }
  const seen = new Set(), repeated = homes.filter(home => (seen.has(home.key) ? true : (seen.add(home.key), false))).map(home => home.name);
  return { asOf, note, homes, problems: { withoutMunicipality, withoutPrice, repeated } };
}

const escape = value => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const attribute = value => escape(value).replace(/"/gu, '&quot;');
const day = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const page = (title, blocks) => `<!doctype html><html lang="et"><meta charset="utf-8"><title>${escape(title)}</title><body><article>\n${blocks.join('\n')}\n</article></body></html>\n`;
const host = url => { const parsed = new URL(url); return `${parsed.hostname.replace(/^www\./u, '')}${parsed.pathname.replace(/\/$/u, '')}`; };
const lowest = home => (home.levels.length ? Math.min(...home.levels) : null);
const et = (a, b) => a.name.localeCompare(b.name, 'et');
const median = list => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null; };
const TITLE = 'Hooldekodude kohamaksumus';

/**
 * The corpus sources of the table, each a small HTML page with its metadata:
 * - one per municipality: the homes whose place of activity is in it, each under its own heading with the monthly
 *   price, the care costs, its places, address, general phone and website; then the other homes of the county in a
 *   line each, because a person may choose a home anywhere. A municipality without a home has a page too: it says so
 *   and lists the county's homes in full (ADR-096: a page of the municipality's own is what reaches an answer);
 * - one overview for the whole country: how many homes each county has and between which amounts their lowest listed
 *   monthly prices lie. It is no municipality's source, so it answers a question that names no place.
 * table: as careTable gives it. Returns [{ path, html, metadata }]. The pages hold phone numbers: they are generated for
 * the corpus and do not go into the public repository.
 */
export function careSources(table, { municipalities, readAt, tableUrl }) {
  const when = table.asOf ? `seisuga ${table.asOf}` : 'tabelis märkimata seisuga', sources = [];
  const note = `Andmed on Sotsiaalkindlustusameti hinnaseire tabelist „Hoolduskulud ja hoolduskoha maksumus“, ${when}; tabel on loetud ${day(readAt)}. Hinnad on ülevaatlikud ja pärinevad omavalitsuste ning teenuseosutajate avalikelt kodulehtedelt; hetkel kehtiva hinna saab hooldekodu kodulehelt või teenuseosutajalt.`;
  const explain = 'Koha maksumus on see, mida hooldekodu koha eest kuus küsib. Hoolduskulu on selle osa, mille tasub inimese rahvastikuregistrijärgse elukoha omavalitsus oma kehtestatud piirmäärani; ülejäänud osa (majutus, toitlustus ja muud kulud) tasub inimene ise. Inimene võib valida hooldekodu ka teisest omavalitsusest.';
  const common = { source_type: 'registry', language: 'et', publisher: 'Sotsiaalkindlustusamet', url: SKA_CARE_PAGE, checked_at: readAt.slice(0, 10), retrieved_at: readAt, source_format: 'html',
    source_status: 'active', country: 'EE', jurisdiction_level: 'NATIONAL', legal_basis: false, collection: { collector: CARE_PRICES, table: tableUrl, as_of: table.asOf } };
  // A name that stands for several places of activity is told apart by the address.
  const counts = new Map(); for (const home of table.homes) counts.set(home.name, (counts.get(home.name) || 0) + 1);
  const named = home => `${escape(home.name)}${counts.get(home.name) > 1 && home.address ? `, ${escape(home.address.split(',')[0])}` : ''}`;
  const full = (home, elsewhere = false) => [`<h2>${named(home)}${elsewhere ? ` (${escape(home.municipality.name)})` : ''}</h2>`,
    `<p>Koha maksumus kuus eurodes (${when}): ${escape(home.price)}.${home.careCost ? ` Hoolduskulu kuus eurodes (${when}): ${escape(home.careCost)}.` : ''}${home.places ? ` Kohti tegevusloal: ${home.places}.` : ''}`
      + `${home.dementia ? ` Võtab vastu dementsusega inimesi: ${escape(home.dementia)}.` : ''}${home.address ? ` Aadress: ${escape(home.address)}${home.address.includes(home.municipality.name) ? '' : `, ${escape(home.municipality.name)}`}.` : ` Asukoht: ${escape(home.municipality.name)}.`}`
      + `${home.phone ? ` Telefon: ${home.phone}.` : ''}${home.website ? ` Koduleht: <a href="${attribute(home.website)}">${escape(host(home.website))}</a>.` : ''}${home.chain ? ` Kett: ${escape(home.chain)}.` : ''}</p>`];
  const line = home => `<li>${named(home)} (${escape(home.municipality.name)}): koha maksumus kuus ${lowest(home) === null ? escape(home.price) : `alates ${lowest(home)} eurost`}${home.website ? `; koduleht ${escape(host(home.website))}` : ''}.</li>`;
  for (const municipality of [...new Map(municipalities.map(item => [item.id, item])).values()]) {
    const county = countyName(municipality.county), here = table.homes.filter(home => home.municipality.id === municipality.id).sort(et);
    const others = table.homes.filter(home => home.county === county && home.municipality.id !== municipality.id).sort((a, b) => a.municipality.name.localeCompare(b.municipality.name, 'et') || et(a, b));
    if (!here.length && !others.length) continue;
    const title = `${TITLE}: ${municipality.name}`;
    const lead = here.length
      ? `Üldhooldusteenuse osutajad (hooldekodud), kelle tegevuskoht on omavalitsuses ${escape(municipality.name)} (${escape(county)}), ja nende koha maksumus kuus. ${note}`
      : `Omavalitsuses ${escape(municipality.name)} ei ole Sotsiaalkindlustusameti hinnaseire tabelis ühtegi hooldekodu. Allpool on sama maakonna (${escape(county)}) teistes omavalitsustes asuvad hooldekodud ja nende koha maksumus kuus. ${note}`;
    const blocks = [`<h1>${escape(title)}</h1>`, `<p>${lead}</p>`, `<p>${explain}</p>`, ...(here.length ? here.flatMap(home => full(home)) : others.flatMap(home => full(home, true))),
      ...(here.length && others.length ? [`<h2>Teised hooldekodud samas maakonnas (${escape(county)})</h2>`, `<ul>${others.map(line).join('')}</ul>`] : [])];
    sources.push({ path: `hooldekodud/kov/${municipality.id}.html`, html: page(title, blocks),
      metadata: { ...common, document_id: `hooldekodude-kohamaksumus-${municipality.id}`, title, source_path: `${municipality.id}.html`, municipality_id: municipality.id, municipality_name: municipality.name, county,
        collection: { ...common.collection, homes: here.length, ...(here.length ? {} : { county_homes: others.length }) } } });
  }
  const counties = [...new Set(table.homes.map(home => home.county))].sort((a, b) => a.localeCompare(b, 'et')), all = table.homes.map(lowest).filter(value => value !== null);
  if (all.length) {
    const title = `${TITLE} Eestis: ülevaade maakondade kaupa`;
    const row = county => { const prices = table.homes.filter(home => home.county === county).map(lowest).filter(value => value !== null);
      return `<li>${escape(county)}: ${table.homes.filter(home => home.county === county).length} hooldekodu; madalaim loetletud koha maksumus kuus jääb vahemikku ${Math.min(...prices)}–${Math.max(...prices)} eurot, mediaan ${median(prices)} eurot.</li>`; };
    sources.push({ path: 'hooldekodud/ulevaade.html', html: page(title, [`<h1>${escape(title)}</h1>`,
      `<p>Sotsiaalkindlustusameti hinnaseire tabelis on ${table.homes.length} üldhooldusteenuse osutaja tegevuskohta (hooldekodu). Iga hooldekodu madalaim loetletud koha maksumus kuus jääb vahemikku ${Math.min(...all)}–${Math.max(...all)} eurot, mediaan on ${median(all)} eurot (${when}). Suurema hooldusvajaduse, dementsuse või ühekohalise toa puhul on hind kõrgem. ${note}</p>`,
      `<p>${explain} Konkreetse omavalitsuse hooldekodud ja nende hinnad on selle omavalitsuse lehel; täpse summa jaoks on vaja teada hooldekodu ja inimese elukoha omavalitsust.</p>`,
      '<h2>Hooldekodude arv ja koha maksumus maakonniti</h2>', `<ul>${counties.map(row).join('')}</ul>`]),
    metadata: { ...common, document_id: 'hooldekodude-kohamaksumus-ulevaade', title, source_path: 'ulevaade.html', collection: { ...common.collection, homes: table.homes.length, counties: counties.length } } });
  }
  return sources;
}

// ---- The monthly refresh (ADR-098's rule for collected data: a change is applied on its second equal reading, and
// nothing is deleted by itself) ----
const sha = value => createHash('sha256').update(value).digest('hex');
// What a home says, with the month the table is of: a new table with the same prices is still news of a new month.
const valueOf = (home, asOf) => JSON.stringify([asOf, home.name, home.chain, home.municipality.id, home.places, home.website, home.careCost, home.price, home.levels, home.dementia, home.licence, home.address, home.phone]);

/** What to do with a reading of the table. accepted and read: { asOf, homes }; pending: the changes the reading before
 *  this one proposed. A confirmed new or changed home is applied; a home that is gone waits for a person
 *  (approveRemovals names the keys that may go). Returns the accepted table after this reading, what was applied, what
 *  is proposed now and the removals that wait. */
export function decideHomes({ accepted, read, pending = [], approveRemovals = [] }) {
  const id = change => `${change.key}\0${change.kind}\0${change.hash}`, seen = new Set(pending.map(id)), may = new Set(approveRemovals);
  const before = new Map(accepted.homes.map(home => [home.key, home])), after = new Map(read.homes.map(home => [home.key, home])), next = new Map(before);
  const applied = [], proposed = [], removalsWaiting = [], changes = [];
  for (const [key, home] of after) {
    const known = before.get(key), hash = sha(valueOf(home, read.asOf));
    if (!known) changes.push({ key, kind: 'added', hash, name: home.name, where: home.municipality.name });
    else if (valueOf(known, accepted.asOf) !== valueOf(home, read.asOf)) changes.push({ key, kind: 'changed', hash, name: home.name, where: home.municipality.name });
  }
  for (const [key, home] of before) if (!after.has(key)) changes.push({ key, kind: 'removed', hash: 'gone', name: home.name, where: home.municipality.name });
  for (const change of changes) {
    const confirmed = seen.has(id(change));
    if (confirmed && change.kind !== 'removed') { next.set(change.key, after.get(change.key)); applied.push(change); }
    else if (confirmed && may.has(change.key)) { next.delete(change.key); applied.push(change); }
    else if (confirmed) { removalsWaiting.push(change); proposed.push(change); }
    else proposed.push(change);
  }
  // The month is the new table's once any of its homes is applied: the accepted table is then of that month.
  const asOf = applied.some(change => change.kind !== 'removed') ? read.asOf : accepted.asOf;
  // The homes stay in the accepted order (a changed one in its place, a new one at the end): two homes of one name keep
  // their order on a page whatever the order of the table's rows, so a page changes only for what it says.
  return { table: { asOf, note: read.note ?? accepted.note ?? '', homes: [...next.values()], problems: { withoutMunicipality: [], withoutPrice: [], repeated: [] } },
    applied, proposed, removalsWaiting };
}

// A page names the day the table was read. A page whose homes are what they were is not made again for the day alone.
const withoutDay = html => html.replace(/tabel on loetud \d{2}\.\d{2}\.\d{4}/gu, 'tabel on loetud');
/** The pages of the accepted table that differ from the ones the corpus has (ingested: path → html), apart from the day
 *  of the reading: the pages to ingest (new or changed), how many stay, and the ones no longer made. */
export function refreshedCarePages({ table, municipalities, readAt, tableUrl, ingested }) {
  const pages = careSources(table, { municipalities, readAt, tableUrl }), changed = [];
  let unchanged = 0;
  for (const made of pages) {
    const known = ingested.get(made.path);
    if (known !== undefined && withoutDay(known) === withoutDay(made.html)) { unchanged++; continue; }
    changed.push({ ...made, state: known === undefined ? 'new' : 'changed' });
  }
  const paths = new Set(pages.map(made => made.path));
  return { changed, unchanged, gone: [...ingested.keys()].filter(file => !paths.has(file)) };
}
