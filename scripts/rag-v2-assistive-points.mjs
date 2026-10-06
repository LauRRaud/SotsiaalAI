// Reads the Social Insurance Board's official map of assistive device sales points into one data set: every point of
// its contract partners with its municipality, county, the product categories it offers and whether it sells or rents
// them (lib/rag-v2/assistive-points.js). About 150 polite readings of the map's public table.
// Writes under --work (git-ignored tmp/): points.json with everything the table gives (also phone and e-mail, which stay
// out of the repository), points.public.json without contacts, and prints counts only.
// No model or embedding call.
//   node scripts/rag-v2-assistive-points.mjs [--work tmp/rag-v2-abivahendid] [--delay-ms 1200]
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { collectPoints, csvReader, publicPoint, ASSISTIVE_POINTS, SKA_MAP_CSV, CATEGORIES } from '../lib/rag-v2/assistive-points.js';
import { COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';

const { values } = parseArgs({ options: { work: { type: 'string', default: 'tmp/rag-v2-abivahendid' }, 'delay-ms': { type: 'string', default: '1200' }, municipalities: { type: 'string', default: 'Andmebaasi/KOV' } } });
const delayMs = Number(values['delay-ms']);
if (!(delayMs >= 500 && delayMs <= 60000)) throw Error('usage: [--work <dir>] [--delay-ms <500-60000>] [--municipalities <dir of municipal packages>]');
// The municipalities as the corpus names them: each municipal package's own metadata.
const municipalities = [];
for (const slug of (await fs.readdir(values.municipalities)).sort()) {
  const meta = await fs.readFile(path.join(values.municipalities, slug, `${slug}.meta.json`), 'utf8').then(JSON.parse, () => null);
  if (meta?.municipality_id && meta?.municipality_name) municipalities.push({ id: meta.municipality_id, name: meta.municipality_name });
}
if (municipalities.length < 70) throw Error(`only ${municipalities.length} municipalities found under ${values.municipalities}`);
let last = 0;
const wait = async () => { const since = Date.now() - last; if (since < delayMs) await new Promise(resolve => setTimeout(resolve, delayMs - since)); last = Date.now(); };
const started = Date.now();
const { points, readings, problems } = await collectPoints({ read: csvReader({ wait, agent: COLLECTOR_AGENT }), municipalities });
const at = new Date().toISOString(), source = { collector: ASSISTIVE_POINTS, table: SKA_MAP_CSV, read_at: at, readings };
await fs.mkdir(values.work, { recursive: true });
await fs.writeFile(path.join(values.work, 'points.json'), `${JSON.stringify({ source, points }, null, 1)}\n`);
await fs.writeFile(path.join(values.work, 'points.public.json'), `${JSON.stringify({ source, points: points.map(publicPoint) }, null, 1)}\n`);
const count = (list, key) => list.reduce((bag, item) => { for (const value of key(item)) bag[value] = (bag[value] || 0) + 1; return bag; }, {});
const byCategory = count(points, point => [...new Set(point.offers.map(offer => offer.category))]), byMunicipality = count(points, point => point.municipalities.map(item => item.name));
console.log(JSON.stringify({ collector: ASSISTIVE_POINTS, at, seconds: Math.round((Date.now() - started) / 1000), readings, points: points.length, problems,
  municipalitiesAsked: municipalities.length, municipalitiesWithPoints: Object.keys(byMunicipality).length, withWebsite: points.filter(point => point.website).length,
  offers: points.reduce((sum, point) => sum + point.offers.length, 0), byService: count(points, point => [...new Set(point.offers.map(offer => offer.service))]),
  byCategory: Object.fromEntries(CATEGORIES.map(category => [category, byCategory[category] || 0])),
  mostPoints: Object.entries(byMunicipality).sort((a, b) => b[1] - a[1]).slice(0, 10), work: values.work }));
