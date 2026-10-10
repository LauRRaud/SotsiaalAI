// Iga teavituse sihtkoht peab olema päris leht. Toeavalduse teade viis aadressile
// `/org/tugi/<id>`, mida rakenduses ei olnud: saaja vajutas teatele ja sai 404.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTION_REGISTRY, buildActionHref } from '../lib/actions/registry.js';
import { buildRoomChatPath } from '../lib/roomPath.js';
import { WorkspaceKind } from '../lib/workspaces/registry.js';

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

/** Valmis aadress (näidis-ID-ga `proov`) kaustade jadaks. */
const builtSegments = (href) => href.split('?')[0].split('/').filter(Boolean).map((part) => (part === 'proov' ? PARAM : part));

test('igal tegevuslingil on leht', () => {
  const hrefs = [];
  for (const kind of Object.keys(ACTION_REGISTRY)) {
    if (kind === 'open_workspace') continue;
    hrefs.push([kind, buildActionHref(kind, 'proov')]);
  }
  /* Tööruumi link sõltub liigist; liik, millel linki ei ole, viskab ja jääb siit välja. */
  for (const workspace of Object.values(WorkspaceKind)) {
    try {
      hrefs.push([`open_workspace:${workspace}`, buildActionHref('open_workspace', `${workspace}:proov`)]);
    } catch (error) {
      assert.equal(error.code, 'UNSUPPORTED_WORKSPACE_ACTION', workspace);
    }
  }
  assert.ok(hrefs.length >= 20, `leitud ${hrefs.length} tegevuslinki; otsing on katki`);
  const missing = hrefs.filter(([, href]) => !resolves(join(root, 'app'), builtSegments(href))).map(([kind, href]) => `${kind} → ${href}`);
  assert.deepEqual(missing, []);
});

test('ruumi aadress tuleb ühest kohast ja aadressi /ruum/<id> ei ehita keegi', () => {
  /* Ruum avaneb vestlusaknas. Võrgustikujagamise nupp „Ava arutelu" viis aadressile
     `/ruum/<id>`, mida ei ole olemas: saaja avas jagamise ja sai 404. */
  assert.equal(buildRoomChatPath('proov', 'et'), '/vestlus?roomId=proov');
  assert.equal(resolves(join(root, 'app'), builtSegments(buildRoomChatPath('proov', 'et'))), true);
  assert.equal(resolves(join(root, 'app'), ['ruum', PARAM]), false);

  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  };
  const offenders = ['app', 'components', 'lib']
    .flatMap((dir) => walk(join(root, dir)))
    .filter((file) => /["'`]\/ruum\/[^"'`\s]/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file).split(sep).join('/'));
  assert.deepEqual(offenders, []);

  const inbox = read('components/network/NetworkShareInbox.jsx');
  assert.match(inbox, /href=\{buildRoomChatPath\(openedShare\.roomId, locale\)\}/);
});

