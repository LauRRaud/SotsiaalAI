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

const escape = value => String(value).replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const attribute = value => escape(value).replace(/"/gu, '&quot;');
const SERVICE_WORDS = Object.freeze({ 'müük': 'müük', 'müük ja üür': 'müük ja üür', 'üür': 'üür' });
// The Board's page whose map the data is read from; an answer's source link leads there.
export const SKA_MAP_PAGE = 'https://sotsiaalkindlustusamet.ee/puue-ja-hoolekanne/abivahendid/abivahendi-vajajale';
// A point's general phone number may stand in an answer (owner 06.10.2026: "üld võib olla"). Only a whole Estonian
// number is given; what the table holds otherwise (a part of a number, nothing) is left out.
const phoneOf = point => { const digits = String(point.phone ?? '').replace(/[\s-]/gu, ''); return /^(?:\+372)?\d{7,8}$/u.test(digits) ? digits.replace(/^\+372/u, '') : null; };
const day = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const page = (title, blocks) => `<!doctype html><html lang="et"><meta charset="utf-8"><title>${escape(title)}</title><body><article>\n${blocks.join('\n')}\n</article></body></html>\n`;
// A county as the table names it, from the name a municipal package gives ("Tartumaa" → "Tartu maakond").
export const countyName = value => (COUNTIES.includes(value) ? value : `${String(value ?? '').replace(/\s*maakond$/u, '').replace(/maa$/u, '').trim().replace(/\s+/gu, '-')} maakond`);
// Whose point it is, where the table says so only through the point's own addresses: the website's site, else the site
// of its e-mail address when that is the company's own (the address itself is a contact and is not used).
const MAILBOX_SITES = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'mail.ee', 'hot.ee', 'online.ee', 'neti.ee', 'mail.ru', 'icloud.com', 'live.com', 'smail.ee', 'zone.ee']);
export function companySite(point) {
  if (point.website) return new URL(point.website).hostname.replace(/^www\./u, '');
  const site = String(point.email ?? '').split('@')[1]?.trim().toLowerCase();
  return site && /^[a-z0-9.-]+\.[a-z]{2,}$/u.test(site) && !MAILBOX_SITES.has(site) ? site : null;
}

/**
 * The corpus sources of the data set, each a small HTML page with its metadata:
 * - one per municipality that has a point: every point there by product category, with its address, whether it sells
 *   or rents, its general phone number and its website. It is that municipality's source (regions), so it is evidence
 *   where the conversation is about that municipality.
 * - one per county: which municipalities have which points, by category, and which have none. It is a source for every
 *   municipality of the county, so a person in a municipality without a point learns where the nearest ones are.
 * points: as collectPoints gives them. municipalities: [{ id, name, county }], every municipality of the corpus.
 * Returns [{ path, html, metadata }]. These hold phone numbers: they are generated for the corpus and do not go into
 * the public repository.
 */
export function pointSources(points, { municipalities, readAt }) {
  const placed = points.filter(point => point.municipalities.length === 1 && point.counties.length === 1 && point.offers.length);
  const note = `Andmed on Sotsiaalkindlustusameti kaardirakendusest „Leia endale sobivaim abivahendi pakkuja“, loetud ${day(readAt)}.`;
  const offering = (list, category) => list.filter(point => point.offers.some(offer => offer.category === category)).sort((a, b) => a.name.localeCompare(b.name, 'et') || a.address.localeCompare(b.address, 'et'));
  const named = point => { const site = companySite(point); return site && !point.name.toLowerCase().includes(site.split('.')[0]) ? `${escape(point.name)} (${escape(site)})` : escape(point.name); };
  // A municipality's county is the one the table gives its points; the package's own word only where it has no point.
  const countyOf = municipality => placed.find(point => point.municipalities[0].id === municipality.id)?.counties[0] ?? countyName(municipality.county);
  const service = (point, category) => [...new Set(point.offers.filter(offer => offer.category === category).map(offer => SERVICE_WORDS[offer.service]))].join(', ');
  const common = { source_type: 'registry', language: 'et', publisher: 'Sotsiaalkindlustusamet', url: SKA_MAP_PAGE, checked_at: readAt.slice(0, 10), retrieved_at: readAt, source_format: 'html',
    source_status: 'active', country: 'EE', jurisdiction_level: 'NATIONAL', legal_basis: false, collection: { collector: ASSISTIVE_POINTS, table: SKA_MAP_CSV } };
  const sources = [];
  for (const municipality of [...new Map(municipalities.map(item => [item.id, item])).values()]) {
    const here = placed.filter(point => point.municipalities[0].id === municipality.id);
    if (!here.length) continue;
    const title = `Abivahendite müügi- ja üüripunktid: ${municipality.name}`;
    const blocks = [`<h1>${escape(title)}</h1>`,
      `<p>Sotsiaalkindlustusameti lepingupartnerite müügipunktid, mis asuvad omavalitsuses ${escape(municipality.name)} (${escape(here[0].counties[0])}). Punktid on loetletud abivahendi kategooria kaupa. ${note}</p>`];
    for (const category of CATEGORIES) {
      const list = offering(here, category);
      if (!list.length) continue;
      blocks.push(`<h2>${escape(category)}</h2>`, `<ul>${list.map(point => {
        const phone = phoneOf(point), host = point.website ? new URL(point.website).hostname.replace(/^www\./u, '') : null;
        return `<li>${named(point)}. Aadress: ${escape(point.address || 'kaardil märkimata')}, ${escape(municipality.name)}. Teenus: ${service(point, category)}.${phone ? ` Telefon: ${phone}.` : ''}${host ? ` Koduleht: <a href="${attribute(point.website)}">${escape(host)}</a>.` : ''}</li>`;
      }).join('')}</ul>`);
    }
    sources.push({ path: `abivahendid/kov/${municipality.id}.html`, html: page(title, blocks),
      metadata: { ...common, document_id: `abivahendite-muugipunktid-${municipality.id}`, title, source_path: `${municipality.id}.html`, municipality_id: municipality.id, municipality_name: municipality.name, county: here[0].counties[0],
        collection: { ...common.collection, points: here.length } } });
  }
  for (const county of COUNTIES) {
    const members = [...new Map(municipalities.filter(item => countyOf(item) === county).map(item => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name, 'et'));
    const here = placed.filter(point => point.counties[0] === county);
    if (!here.length || !members.length) continue;
    const title = `Abivahendite müügi- ja üüripunktid: ${county}`, withPoints = new Set(here.map(point => point.municipalities[0].id)), without = members.filter(item => !withPoints.has(item.id));
    const blocks = [`<h1>${escape(title)}</h1>`,
      `<p>Ülevaade Sotsiaalkindlustusameti lepingupartnerite müügipunktidest maakonnas ${escape(county)}: millises omavalitsuses on millise abivahendi kategooria punkte. Punkti aadress ja telefon on selle omavalitsuse loendis. ${note}</p>`,
      ...(without.length ? [`<p>Selle maakonna omavalitsused, kus kaardil ei ole ühtegi müügipunkti: ${without.map(item => escape(item.name)).join(', ')}.</p>`] : [])];
    for (const category of CATEGORIES) {
      const list = offering(here, category);
      if (!list.length) continue;
      const byPlace = members.map(item => [item, list.filter(point => point.municipalities[0].id === item.id)]).filter(([, found]) => found.length);
      blocks.push(`<h2>${escape(category)}</h2>`, `<ul>${byPlace.map(([item, found]) => `<li>${escape(item.name)} (${found.length}): ${found.map(named).join('; ')}.</li>`).join('')}</ul>`);
    }
    const slug = county.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
    sources.push({ path: `abivahendid/maakond/${slug}.html`, html: page(title, blocks),
      metadata: { ...common, document_id: `abivahendite-muugipunktid-${slug}`, title, source_path: `${slug}.html`, county, regions: members.map(item => item.id),
        collection: { ...common.collection, points: here.length, municipalities: members.length } } });
  }
  return sources;
}
