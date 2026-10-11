// Töölaua menüüteed ja sisulehed: kumb saab paneeli.
//
// Raam (PanelFrame) jättis varem paneelita iga tee, mis algab „/toolaud/".
// Juhtumitöö laud ja kiireloomuline vastuvõtt on aga sisulehed: ilma paneelita
// algas nende tekst vaateakna vasakust ülanurgast otse ruumipildi peal
// (kujundusaudit K01). Menüü on ainult kolm teed ja neid kasutavad kaks
// komponenti: raam ja ruum (RoomStage).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dockLabelRoutes, isWorkspaceHubRoute, panelHasRoomDock, pickDockLabel, WORKSPACE_HUB_ROUTES } from '../lib/roomDock.js';

test('Töölaua menüü on kolm teed; sisulehed selle all saavad paneeli ja doki', () => {
  assert.deepEqual(WORKSPACE_HUB_ROUTES, ['/toolaud', '/toolaud/tooheaolu', '/toolaud/kovisioon']);
  for (const route of WORKSPACE_HUB_ROUTES) assert.equal(isWorkspaceHubRoute(route), true, route);
  for (const route of ['/toolaud/juhtumitoo', '/toolaud/kiireloomuline-abi', '/tooheaolu/kiirkontroll', '/kovisioon', '/']) {
    assert.equal(isWorkspaceHubRoute(route), false, route);
  }
  assert.equal(panelHasRoomDock('/toolaud/juhtumitoo'), true);
  assert.equal(panelHasRoomDock('/toolaud/kiireloomuline-abi'), true);
});

test('ruum ja raam loevad menüüks samu teid', () => {
  const stage = fs.readFileSync(new URL('../components/room/RoomStage.jsx', import.meta.url), 'utf8');
  const frame = fs.readFileSync(new URL('../components/room/PanelFrame.jsx', import.meta.url), 'utf8');
  /* RoomStage hoiab kolme teed eraldi muutujates, sest kasutab neid ka
     eraldi (milline kaardikomplekt on ees). */
  for (const route of WORKSPACE_HUB_ROUTES) assert.ok(stage.includes(`normalized === "${route}"`), `RoomStage: ${route}`);
  assert.match(stage, /const isWorkspaceRoute = normalized === "\/toolaud" \|\| isWellbeingRoute \|\| isKovisionRoute;/);
  assert.ok(frame.includes('const isWorkspaceHub = isWorkspaceHubRoute(normalized);'));
  assert.ok(!frame.includes('normalized.startsWith("/toolaud/")'), 'raam ei pea iga Töölaua alateed menüüks');
});

// Dokk kannab lehe nime, sest leht ise pealkirja ei kanna. Alamteel ja sama
// lehe teise päringuga jäi dokki varem ainult tagasi-nool.
test('dokk otsib lehe nime täpse tee, aliase, päringuta tee ja vanema tee järgi', () => {
  assert.deepEqual(dockLabelRoutes('/valitoo'), ['/valitoo']);
  assert.deepEqual(dockLabelRoutes('/valitoo/abc123'), ['/valitoo/abc123', '/valitoo']);
  assert.deepEqual(dockLabelRoutes('/supervisioon/valjundid/x1'), ['/supervisioon/valjundid/x1', '/supervisioon']);
  /* Sama leht teise päringuga: enne täpne (profiili sektsioonid), siis ilma päringuta. */
  assert.deepEqual(dockLabelRoutes('/juhtumid', 'juhtum=c1'), ['/juhtumid?juhtum=c1', '/juhtumid']);
  assert.deepEqual(dockLabelRoutes('/juhtumid', '?juhtum=c1'), ['/juhtumid?juhtum=c1', '/juhtumid']);
  assert.deepEqual(dockLabelRoutes('/profiil', 'sektsioon=konto'), ['/profiil?sektsioon=konto', '/profiil']);
  /* Alias tuleb enne vanemat: otselingi leht kannab oma kaardi nime. */
  assert.deepEqual(
    dockLabelRoutes('/eelpoordumised', '', { '/eelpoordumised': '/vestlus?workspace=pre_inquiries' }),
    ['/eelpoordumised', '/vestlus?workspace=pre_inquiries']
  );
  /* Töölaua sisuleht ja tööheaolu töövorm leiavad oma kaardi täpse tee järgi; vanem on alles viimane. */
  assert.deepEqual(dockLabelRoutes('/toolaud/juhtumitoo'), ['/toolaud/juhtumitoo', '/toolaud']);
  /* Alamtee kannab ka vanema aliast: avatud dokument saab kaardi „Dokumendid" nime. */
  const aliases = { '/documents': '/vestlus?workspace=documents' };
  assert.deepEqual(dockLabelRoutes('/documents', '', aliases), ['/documents', '/vestlus?workspace=documents']);
  assert.deepEqual(dockLabelRoutes('/documents/abc', '', aliases), ['/documents/abc', '/documents', '/vestlus?workspace=documents']);
  assert.deepEqual(dockLabelRoutes('/documents', 'artifacts=all', aliases), ['/documents?artifacts=all', '/vestlus?workspace=documents', '/documents']);
  /* Päringuga tee alias: töölaua sees avatud leht kannab oma kaardi nime, mitte „Vestlus". */
  const embedded = { '/vestlus?workspace=service_profile': '/teenuseprofiil' };
  assert.deepEqual(
    dockLabelRoutes('/vestlus', 'workspace=service_profile', embedded),
    ['/vestlus?workspace=service_profile', '/teenuseprofiil', '/vestlus']
  );
  assert.deepEqual(dockLabelRoutes('/vestlus', 'workspace=documents', embedded), ['/vestlus?workspace=documents', '/vestlus']);
  assert.deepEqual(dockLabelRoutes('/vestlus', '', embedded), ['/vestlus']);
  assert.deepEqual(dockLabelRoutes('/'), ['/']);
  assert.deepEqual(dockLabelRoutes(''), ['/']);
});

test('ruum kasutab doki nime otsimisel sama järjekorda ja oma komplekti kaart on esimene', () => {
  const stage = fs.readFileSync(new URL('../components/room/RoomStage.jsx', import.meta.url), 'utf8');
  assert.ok(stage.includes('dockLabelRoutes(normalized, search, DOCK_CARD_ALIASES)'));
  assert.ok(stage.includes('const byRoute = pickDockLabel('), 'kaardita nimi käib sama järjekorda mööda');
  /* Teise rolli kaart annab lehele nime ka siis, kui vaataja rollil seda kaarti ei ole. */
  assert.ok(stage.includes('return { workspaceItems: cards, workspaceAllCards: all };'));
  assert.ok(/profileItems,\s+\/\*[^*]*\*\/\s+workspaceAllCards,\s+\]\.forEach/.test(stage), 'rollifiltrita loend on nimeotsingus viimane');
  const own = stage.indexOf('cards.find((item) => item.href === here) ||');
  const byRoute = stage.indexOf('byRoute ||', own);
  const cardless = stage.indexOf('(cardless ? {', own);
  assert.ok(own > 0 && byRoute > own && cardless > byRoute, 'järjekord: oma komplekt, tee järgi, kaardita lehe nimi');
  assert.ok(stage.includes('"/documents": "/vestlus?workspace=documents"'), 'dokumentide leht kannab oma kaardi nime');
  assert.ok(stage.includes('"/vestlus?workspace=service_profile": "/teenuseprofiil"'), 'töölaua sees avatud teenuseprofiil kannab oma kaardi nime');
});

// Kaart võib olla ainult ühel rollil. Teise rolliga vaataja (administraator
// teenuseprofiilil) ei leidnud lehele nime ja töölaua sees võttis leht nime „Vestlus".
test('doki nimi: kaart enne, siis kaardita lehe nimi, mõlemad teede järjekorras', () => {
  const cards = new Map([['/vestlus', { key: 'vestlus', label: 'Vestlus', href: '/vestlus' }]]);
  const labels = { '/teenuseprofiil': 'Teenuseprofiil' };
  const pick = (path, search, cardMap = cards) =>
    pickDockLabel(
      dockLabelRoutes(path, search, { '/vestlus?workspace=service_profile': '/teenuseprofiil' }),
      (href) => cardMap.get(href),
      (href) => labels[href] || ''
    );
  /* Roll ilma kaardita: otsetee ja töölaua sees avatud leht kannavad lehe nime. */
  assert.deepEqual(pick('/teenuseprofiil', ''), { key: '/teenuseprofiil', label: 'Teenuseprofiil', href: '/teenuseprofiil' });
  assert.equal(pick('/vestlus', 'workspace=service_profile').label, 'Teenuseprofiil');
  /* Roll, kellel kaart on: kaart võidab (ikoon tuleb kaardilt). */
  const withCard = new Map([...cards, ['/teenuseprofiil', { key: 'teenuseprofiil', label: 'Teenuseprofiil', href: '/teenuseprofiil', icon: 'x' }]]);
  assert.equal(pick('/vestlus', 'workspace=service_profile', withCard).icon, 'x');
  /* Muu vestluse tee jääb vestluseks; tundmatu tee jääb nimeta. */
  assert.equal(pick('/vestlus', '').label, 'Vestlus');
  assert.equal(pick('/vestlus', 'workspace=materials').label, 'Vestlus');
  assert.equal(pick('/tundmatu', ''), null);
  assert.equal(pickDockLabel(null), null);
});

/* Omanik 10.10: alumine kiirmenüü peab igal lehel ütlema, mis leht lahti on.
   Loeme kõik lehed kaustast app/ ja kõik nimeallikad RoomStage'ist (kaardid
   rollist sõltumata, kaardita lehtede sildid, aliased): dokiga leht, millel
   nime ei ole, peab olema siin nimeliselt lubatud. */
test('igal dokiga lehel on dokis lehe nimi', () => {
  const stage = fs.readFileSync(new URL('../components/room/RoomStage.jsx', import.meta.url), 'utf8');
  const tools = fs.readFileSync(new URL('../lib/wellbeingTools.js', import.meta.url), 'utf8');
  const block = (name) => stage.slice(stage.indexOf(`const ${name} = {`), stage.indexOf('};', stage.indexOf(`const ${name} = {`)));
  const named = new Set([
    ...[...stage.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...tools.matchAll(/route:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...block('CARDLESS_DOCK_LABELS').matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]),
  ]);
  const aliases = Object.fromEntries([...block('DOCK_CARD_ALIASES').matchAll(/^\s*"([^"]+)":\s*"([^"]+)"/gm)].map((match) => [match[1], match[2]]));
  assert.ok(named.size > 50 && Object.keys(aliases).length >= 5, 'nimeallikad loeti välja');

  const routes = [];
  const walk = (dir, route) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['api', 'styles'].includes(entry.name) || entry.name.startsWith('_')) continue;
        const segment = entry.name.startsWith('(') ? '' : entry.name.startsWith('[') ? 'x1' : entry.name;
        walk(new URL(`${entry.name}/`, dir), segment ? `${route}/${segment}` : route);
      } else if (/^page\.(js|jsx)$/.test(entry.name)) {
        routes.push(route || '/');
      }
    }
  };
  walk(new URL('../app/', import.meta.url), '');
  assert.ok(routes.length > 100, 'lehed loeti välja');

  /* Nimeta tohivad olla: ümbersuunajad (/rooms, /tooheaolu), sisemised
     tööriistad (/logo-eksport, /rag-pilot, KOV piloodi koondvaade), videoruum
     oma kestaga ja PIN-i taastamine (sisselogimata, oma pealkirjaga vorm).
     `/tooheaolu/x1` on tööriista tee: päris teed on tööriistade loendis. */
  const allowed = new Set(['/logo-eksport', '/rag-pilot', '/room/x1', '/rooms', '/taasta-parool', '/taasta-parool/x1', '/tooheaolu', '/tooheaolu/piloot', '/tooheaolu/x1']);
  const nameless = routes
    .filter((route) => !isWorkspaceHubRoute(route) && panelHasRoomDock(route))
    .filter((route) => !dockLabelRoutes(route, '', aliases).some((href) => named.has(href)))
    .sort();
  assert.deepEqual(nameless.filter((route) => !allowed.has(route)), [], 'dokiga leht ilma nimeta: lisa kaart, alias või silt (CARDLESS_DOCK_LABELS)');
  assert.deepEqual([...allowed].filter((route) => !nameless.includes(route)), [], 'lubatud loendis on tee, millel on nüüd nimi: võta see loendist välja');
});
