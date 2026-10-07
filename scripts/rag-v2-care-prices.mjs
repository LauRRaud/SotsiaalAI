// Reads the Social Insurance Board's price monitoring table of general care homes into one data set and makes the
// corpus pages of it (lib/rag-v2/care-prices.js, ADR-104): one page for every municipality (its own homes, or its
// county's when it has none) and one overview for the country. Two polite readings: the Board's page, for the table's
// link, and the table itself. --from <file.xlsx> reads a table already downloaded.
// Writes under --work (git-ignored tmp/): the table as downloaded and homes.json (with the homes' general phone
// numbers, which stay out of the repository), and prints counts only.
// --sources <dir> also writes the pages with their metadata. They hold phone numbers: the directory is for the corpus
// and must stay outside the repository.
// No model or embedding call.
//   node scripts/rag-v2-care-prices.mjs [--work tmp/rag-v2-hooldekodud] [--from <file.xlsx>] [--table-url <address>] [--sources <dir>]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { CARE_PRICES, SKA_CARE_PAGE, tableLink, sheetRows, careTable, careSources } from '../lib/rag-v2/care-prices.js';
import { COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';

const { values } = parseArgs({ options: { work: { type: 'string', default: 'tmp/rag-v2-hooldekodud' }, municipalities: { type: 'string', default: 'Andmebaasi/KOV' },
  from: { type: 'string' }, 'table-url': { type: 'string' }, sources: { type: 'string' } } });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// The municipalities as the corpus names them: each municipal package's own metadata.
const municipalities = [];
for (const slug of (await fs.readdir(values.municipalities)).sort()) {
  const meta = await fs.readFile(path.join(values.municipalities, slug, `${slug}.meta.json`), 'utf8').then(JSON.parse, () => null);
  if (meta?.municipality_id && meta?.municipality_name) municipalities.push({ id: meta.municipality_id, name: meta.municipality_name, county: meta.county ?? null });
}
if (municipalities.length < 70) throw Error(`only ${municipalities.length} municipalities found under ${values.municipalities}`);
const read = async address => {
  const response = await fetch(address, { headers: { 'user-agent': COLLECTOR_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`${address} answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const readAt = new Date().toISOString();
let xlsx, tableUrl = values['table-url'] ?? null;
if (values.from) xlsx = await fs.readFile(values.from);
else {
  tableUrl ??= tableLink((await read(SKA_CARE_PAGE)).toString('utf8'));
  if (!tableUrl) throw Error('the price table\'s link was not found on the Board\'s page');
  await new Promise(resolve => setTimeout(resolve, 1500));
  xlsx = await read(tableUrl);
}
if (!tableUrl) throw Error('with --from, give the table\'s address with --table-url');
const table = careTable(sheetRows(xlsx), municipalities);
await fs.mkdir(values.work, { recursive: true });
await fs.writeFile(path.join(values.work, path.basename(new URL(tableUrl).pathname)), xlsx);
await fs.writeFile(path.join(values.work, 'homes.json'), `${JSON.stringify({ source: { collector: CARE_PRICES, page: SKA_CARE_PAGE, table: tableUrl, sha256: sha(xlsx), read_at: readAt }, ...table }, null, 1)}\n`);
const places = new Set(table.homes.map(home => home.municipality.id));
const report = { collector: CARE_PRICES, table: tableUrl, sha256: sha(xlsx), asOf: table.asOf, homes: table.homes.length, municipalitiesWithHomes: places.size, municipalitiesWithout: municipalities.length - places.size,
  withPhone: table.homes.filter(home => home.phone).length, withWebsite: table.homes.filter(home => home.website).length, withCareCost: table.homes.filter(home => home.careCost).length,
  withLevels: table.homes.filter(home => home.levels.length).length, problems: table.problems };
if (values.sources) {
  const sources = careSources(table, { municipalities, readAt, tableUrl });
  for (const source of sources) {
    const file = path.join(values.sources, source.path);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, source.html);
    await fs.writeFile(file.replace(/\.html$/u, '.json'), `${JSON.stringify({ ...source.metadata, source_sha256: sha(source.html) }, null, 2)}\n`);
  }
  report.sources = { pages: sources.length, municipal: sources.filter(source => source.metadata.municipality_id).length, dir: values.sources,
    words: sources.reduce((sum, source) => sum + source.html.replace(/<[^>]+>/gu, ' ').split(/\s+/u).filter(Boolean).length, 0) };
}
console.log(JSON.stringify(report, null, 1));
