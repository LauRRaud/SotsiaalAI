// Iga teavituse sihtkoht peab olema päris leht. Toeavalduse teade viis aadressile
// `/org/tugi/<id>`, mida rakenduses ei olnud: saaja vajutas teatele ja sai 404.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

const PARAM = '\u0000param';

/** Teavituse sihtkohtade aadressid funktsioonist `targetHref` (lib/notifications.js). */
function notificationTargets() {
  const source = read('lib/notifications.js');
  const start = source.indexOf('function targetHref(');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  const targets = [];
  for (const match of body.matchAll(/case "([A-Z_]+)":\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*return [`"](\/[^`"]*)[`"];/g)) {
    targets.push({ kind: match[1], href: match[2] });
  }
  return targets;
}

const segmentsOf = (href) => href.split('?')[0].split('/').filter(Boolean).map((part) => (part.includes('${') ? PARAM : part));

const hasPage = (dir) => ['page.js', 'page.jsx'].some((name) => existsSync(join(dir, name)));

/** Sama valik mis Next.js-il: täpne kaust võidab; ilma selleta sobib dünaamiline kaust. */
function resolves(dir, segments) {
  if (!segments.length) return hasPage(dir);
  const [head, ...rest] = segments;
  const folders = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const group of folders.filter((name) => /^\(.+\)$/.test(name))) {
    if (resolves(join(dir, group), segments)) return true;
  }
  if (head !== PARAM && folders.includes(head)) return resolves(join(dir, head), rest);
  return folders.filter((name) => /^\[[^.\]]+\]$/.test(name)).some((name) => resolves(join(dir, name), rest));
}

test('igal teavituse sihtkohal on leht', () => {
  const targets = notificationTargets();
  assert.ok(targets.length >= 20, `leitud ${targets.length} sihtkohta; otsing on katki`);
  assert.ok(targets.some((target) => target.kind === 'WELLBEING_SUPPORT_SHARE' && target.href === '/org/tugi/${encoded}'));
  const missing = targets.filter((target) => !resolves(join(root, 'app'), segmentsOf(target.href))).map((target) => `${target.kind} → ${target.href}`);
  assert.deepEqual(missing, []);
});

test('kontroll ise tunneb puuduva lehe ära', () => {
  /* Enne parandust: `/org/tugi/<id>` langes kausta `[orgId]`, mille all sellist alamlehte ei ole. */
  assert.equal(resolves(join(root, 'app'), ['org', 'olematu-leht', PARAM]), false);
  assert.equal(resolves(join(root, 'app'), ['org', PARAM, 'tugi']), true);
  assert.equal(resolves(join(root, 'app'), ['mentorlus', 'suhe', PARAM]), true);
});

test('toeavalduse teate leht suunab ainult saaja ja ainult tema organisatsiooni tugivaatesse', () => {
  const page = read('app/org/tugi/[shareId]/page.jsx');
  /* Rida leitakse ainult siis, kui saaja on vaataja ise; organisatsioon tuleb realt, mitte aadressist. */
  assert.match(page, /where: \{ id: String\(shareId\), recipient: \{ is: \{ userId: auth\.userId \} \} \},\n\s+select: \{ organizationId: true \}/);
  assert.match(page, /if \(!share\?\.organizationId\) notFound\(\);/);
  assert.match(page, /redirect\(`\/org\/\$\{share\.organizationId\}\/tugi`\);/);
  /* Sisselogimata inimene saadetakse sisse logima ja tuleb samale aadressile tagasi. */
  assert.match(page, /requireOrgSession\(`\/org\/tugi\/\$\{shareId\}`\)/);
  /* Avalduse sisu see leht ei loe ega ava. */
  assert.equal(/sharedSnapshotJson|openSupportShare|openedAt/.test(page), false);
});
