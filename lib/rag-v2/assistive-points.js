// Where a person can buy or rent an assistive device with the state's support (owner 06.10.2026: "mulle meeldiks, et
// inimene saaks abivahendite leidmisel abi. tihti kurdetakse, et info on killustunud, keeruline on leida").
// The official source is the Social Insurance Board's map of its contract partners' sales points ("Leia endale sobivaim
// abivahendi pakkuja" on the Board's page for a person who needs a device). The map is a dashboard whose table can be
// read as CSV, also narrowed by the dashboard's own filters: municipality, county, product category, kind of service.
// One reading gives the points; a reading per filter value says which points are in a municipality, which offer a
// category, and whether they sell or rent it. Nothing is guessed: a point's place and offers are what the readings say.
// The 21 vendor pages of the source register are not used: 13 of them are among the 58 partner sites the table names, and
// a shop's own page says nothing the table lacks for finding it.
export const ASSISTIVE_POINTS = 'rag-v2/assistive-points-1';
export const SKA_MAP_CSV = 'https://tableauapp.tehik.ee/t/SKA/views/Abivahendite_kaart/Dashboard1.csv';
// The dashboard's fields, by the names its table answers to.
export const FIELDS = Object.freeze({ municipality: 'KOV', county: 'Maakond', category: 'Toote kategooria nimetus rakenduses', service: 'Teenuse liik' });
export const COUNTIES = Object.freeze(['Harju maakond', 'Hiiu maakond', 'Ida-Viru maakond', 'Jõgeva maakond', 'Järva maakond', 'Lääne maakond', 'Lääne-Viru maakond', 'Põlva maakond', 'Pärnu maakond',
  'Rapla maakond', 'Saare maakond', 'Tartu maakond', 'Valga maakond', 'Viljandi maakond', 'Võru maakond']);
export const CATEGORIES = Object.freeze(['Abivahendid audio- ja visuaalse teabe käitlemiseks', 'Arvutiabivahendid', 'Eriistmed', 'Funktsionaalvoodid', 'Juhtkoerad', 'Keskkonnahäiresüsteemid', 'Kodukohandused',
  'Kuulmisabivahendid', 'Laste abivahendid', 'Liikumisabivahendid', 'Nägemisabivahendid', 'Olmeabivahendid', 'Orienteerumise abivahendid', 'Ortopeedilised abivahendid', 'Põetus- ja hooldus abivahendid',
  'Signaalseadmed', 'Siirdumisabivahendid', 'Suhtlusabivahendid']);
export const SERVICES = Object.freeze(['müük', 'müük ja üür', 'üür']);
// Where the table names a municipality otherwise than the corpus does. Found on the first reading (06.10.2026): all 148
// points left without a municipality were the capital's. A reading that leaves a point without a municipality says
// that another such name exists (problems.withoutMunicipality).
export const TABLE_NAMES = Object.freeze({ 'Tallinna linn': 'Tallinn' });

/** A CSV text as objects by its header row: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  // A byte order mark at the start is not part of the first column's name.
  const source = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  for (let at = 0; at < source.length; at++) {
    const char = source[at];
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') { field += '"'; at++; } else if (char === '"') quoted = false; else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/u, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/u, '')); rows.push(row); }
  const [header, ...body] = rows.filter(item => item.some(value => value !== ''));
  if (!header) return [];
  return body.filter(item => item.length === header.length).map(item => Object.fromEntries(header.map((key, index) => [key.trim(), item[index].trim()])));
}

const squeeze = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
/** One sales point of a row of the map's table. The key tells the same point apart in every reading. */
export function pointOf(row) {
  const name = squeeze(row['Müügipunkt']), address = squeeze(row['Lähiaadress']);
  const number = value => { const parsed = Number(String(value ?? '').replace(',', '.')); return value !== '' && value !== undefined && Number.isFinite(parsed) ? parsed : null; };
  const lat = number(row['Latitude (generated)']), lon = number(row['Longitude (generated)']);
  let website = squeeze(row['Kodulehe aadress']) || null;
  if (website) { try { const url = new URL(/^https?:\/\//iu.test(website) ? website : `https://${website}`); website = ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !website.includes('@') ? url.href : null; } catch { website = null; } }
  return { key: `${name.toLowerCase()}|${address.toLowerCase()}|${lat ?? ''},${lon ?? ''}`, name, address, lat, lon, website, phone: squeeze(row.Telefon) || null, email: squeeze(row['E-post']) || null };
}

/**
 * The sales points with their place and offers, assembled from the table's readings.
 * read(filters): the table's rows under the given dashboard filters ({} for every point).
 * municipalities: [{ id, name }] as the corpus names them ("Tartu linn").
 * Returns { points, readings, problems }: a point's municipality and county are the readings it appeared in; its offers
 * are the (category, service) readings it appeared in. problems counts what the readings left open.
 */
export async function collectPoints({ read, municipalities }) {
  const points = new Map();
  let readings = 0;
  const rows = async filters => { readings++; return (await read(filters)).map(pointOf).filter(point => point.name); };
  for (const point of await rows({})) points.set(point.key, { ...point, municipalities: [], counties: [], offers: [] });
  const strangers = new Set();
  // The table may hold a point on two rows (two contacts): it is still one point, marked once by a reading.
  const mark = (found, change) => { for (const key of new Set(found.map(point => point.key))) { const known = points.get(key); if (known) change(known); else strangers.add(key); } };
  // Each municipality once, asked by the table's name for it.
  const asked = [...new Map(municipalities.map(municipality => [municipality.id, municipality])).values()];
  for (const municipality of asked) mark(await rows({ [FIELDS.municipality]: TABLE_NAMES[municipality.name] ?? municipality.name }), point => point.municipalities.push({ id: municipality.id, name: municipality.name }));
  for (const county of COUNTIES) mark(await rows({ [FIELDS.county]: county }), point => point.counties.push(county));
  for (const category of CATEGORIES) for (const service of SERVICES) mark(await rows({ [FIELDS.category]: category, [FIELDS.service]: service }), point => point.offers.push({ category, service }));
  const list = [...points.values()].sort((a, b) => a.name.localeCompare(b.name, 'et') || a.address.localeCompare(b.address, 'et'));
  return { points: list, readings,
    problems: { withoutMunicipality: list.filter(point => point.municipalities.length === 0).length, inSeveralMunicipalities: list.filter(point => point.municipalities.length > 1).length,
      withoutCounty: list.filter(point => point.counties.length === 0).length, withoutOffer: list.filter(point => point.offers.length === 0).length,
      withoutPlaceOnMap: list.filter(point => point.lat === null).length, notInTheWholeTable: strangers.size } };
}

/** A point as it may stand in the public repository and the corpus: where it is and what it offers. A phone number and
 *  an e-mail address are contacts and stay out; the point's own website and the Board's map give them. */
export function publicPoint(point) {
  const { phone: _phone, email: _email, key: _key, municipalities, counties, ...kept } = point;
  return { ...kept, municipality: municipalities.length === 1 ? municipalities[0] : null, county: counties.length === 1 ? counties[0] : null };
}

/** How the table is read over the web: a polite reader of the CSV for a set of filters. */
export function csvReader({ fetchImpl = globalThis.fetch, wait = async () => {}, agent, url = SKA_MAP_CSV } = {}) {
  return async filters => {
    await wait();
    const query = Object.entries(filters).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
    const response = await fetchImpl(query ? `${url}?${query}` : url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': agent, Accept: 'text/csv' } });
    if (response.status !== 200 || !/csv/iu.test(response.headers.get('content-type') || '')) throw Object.assign(new Error('map_table_unreadable'), { code: 'map_table_unreadable', status: response.status });
    return parseCsv(await response.text());
  };
}
