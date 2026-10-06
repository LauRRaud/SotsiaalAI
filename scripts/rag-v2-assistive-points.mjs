// Reads the Social Insurance Board's official map of assistive device sales points into one data set: every point of
// its contract partners with its municipality, county, the product categories it offers and whether it sells or rents
// them (lib/rag-v2/assistive-points.js). About 150 polite readings of the map's public table.
// Writes under --work (git-ignored tmp/): points.json with everything the table gives (also phone and e-mail, which stay
// out of the repository), points.public.json without contacts, and prints counts only.
// --sources <dir> also writes the data set as corpus sources (one page per municipality with a point, one overview per
// county; pointSources). Those pages hold the points' general phone numbers: the directory is for the corpus and must
// stay outside the repository. --from <points.json> makes the sources of an earlier reading without asking the table
// again.
// No model or embedding call.
//   node scripts/rag-v2-assistive-points.mjs [--work tmp/rag-v2-abivahendid] [--delay-ms 1200] [--from <points.json>] [--sources <dir>]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { collectPoints, csvReader, publicPoint, pointSources, ASSISTIVE_POINTS, SKA_MAP_CSV, CATEGORIES } from '../lib/rag-v2/assistive-points.js';
import { COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';

const { values } = parseArgs({ options: { work: { type: 'string', default: 'tmp/rag-v2-abivahendid' }, 'delay-ms': { type: 'string', default: '1200' }, municipalities: { type: 'string', default: 'Andmebaasi/KOV' },
  from: { type: 'string' }, sources: { type: 'string' } } });
const delayMs = Number(values['delay-ms']);
if (!(delayMs >= 500 && delayMs <= 60000)) throw Error('usage: [--work <dir>] [--delay-ms <500-60000>] [--municipalities <dir of municipal packages>] [--from <points.json>] [--sources <dir>]');
// The municipalities as the corpus names them: each municipal package's own metadata.
const municipalities = [];
for (const slug of (await fs.readdir(values.municipalities)).sort()) {
  const meta = await fs.readFile(path.join(values.municipalities, slug, `${slug}.meta.json`), 'utf8').then(JSON.parse, () => null);
  if (meta?.municipality_id && meta?.municipality_name) municipalities.push({ id: meta.municipality_id, name: meta.municipality_name, county: meta.county ?? null });
}
if (municipalities.length < 70) throw Error(`only ${municipalities.length} municipalities found under ${values.municipalities}`);
let last = 0;
const wait = async () => { const since = Date.now() - last; if (since < delayMs) await new Promise(resolve => setTimeout(resolve, delayMs - since)); last = Date.now(); };
const started = Date.now();
let points, readings, problems, source;
if (values.from) {
  ({ points, source } = JSON.parse(await fs.readFile(values.from, 'utf8')));
  readings = source.readings;
  problems = { withoutMunicipality: points.filter(point => point.municipalities.length === 0).length, inSeveralMunicipalities: points.filter(point => point.municipalities.length > 1).length,
    withoutCounty: points.filter(point => point.counties.length === 0).length, withoutOffer: points.filter(point => point.offers.length === 0).length };
} else {
  ({ points, readings, problems } = await collectPoints({ read: csvReader({ wait, agent: COLLECTOR_AGENT }), municipalities }));
  source = { collector: ASSISTIVE_POINTS, table: SKA_MAP_CSV, read_at: new Date().toISOString(), readings };
  await fs.mkdir(values.work, { recursive: true });
  await fs.writeFile(path.join(values.work, 'points.json'), `${JSON.stringify({ source, points }, null, 1)}\n`);
  await fs.writeFile(path.join(values.work, 'points.public.json'), `${JSON.stringify({ source, points: points.map(publicPoint) }, null, 1)}\n`);
}
let written = null;
if (values.sources) {
  // A reading that left a point unplaced is not made into sources: the pages would silently lack it.
  if (problems.withoutMunicipality || problems.inSeveralMunicipalities || problems.withoutCounty) throw Error(`the reading left points unplaced: ${JSON.stringify(problems)}`);
  const made = pointSources(points, { municipalities, readAt: source.read_at });
  for (const item of made) {
    const target = path.join(values.sources, item.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, item.html);
    await fs.writeFile(target.replace(/\.html$/u, '.json'), `${JSON.stringify({ ...item.metadata, source_sha256: createHash('sha256').update(item.html).digest('hex') }, null, 2)}\n`);
  }
  written = { sources: made.length, municipal: made.filter(item => item.path.includes('/kov/')).length, county: made.filter(item => item.path.includes('/maakond/')).length, dir: values.sources };
}
const count = (list, key) => list.reduce((bag, item) => { for (const value of key(item)) bag[value] = (bag[value] || 0) + 1; return bag; }, {});
const byCategory = count(points, point => [...new Set(point.offers.map(offer => offer.category))]), byMunicipality = count(points, point => point.municipalities.map(item => item.name));
console.log(JSON.stringify({ collector: ASSISTIVE_POINTS, at: source.read_at, seconds: Math.round((Date.now() - started) / 1000), readings, points: points.length, problems,
  municipalitiesAsked: municipalities.length, municipalitiesWithPoints: Object.keys(byMunicipality).length, withWebsite: points.filter(point => point.website).length,
  offers: points.reduce((sum, point) => sum + point.offers.length, 0), byService: count(points, point => [...new Set(point.offers.map(offer => offer.service))]),
  byCategory: Object.fromEntries(CATEGORIES.map(category => [category, byCategory[category] || 0])),
  mostPoints: Object.entries(byMunicipality).sort((a, b) => b[1] - a[1]).slice(0, 10), work: values.work, written }));
