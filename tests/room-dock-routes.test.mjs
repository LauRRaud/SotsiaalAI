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
import { dockLabelRoutes, isWorkspaceHubRoute, panelHasRoomDock, WORKSPACE_HUB_ROUTES } from '../lib/roomDock.js';

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
  assert.deepEqual(dockLabelRoutes('/'), ['/']);
  assert.deepEqual(dockLabelRoutes(''), ['/']);
});

test('ruum kasutab doki nime otsimisel sama järjekorda ja oma komplekti kaart on esimene', () => {
  const stage = fs.readFileSync(new URL('../components/room/RoomStage.jsx', import.meta.url), 'utf8');
  assert.ok(stage.includes('dockLabelRoutes(normalized, search, DOCK_CARD_ALIASES)'));
  const own = stage.indexOf('cards.find((item) => item.href === here) ||');
  const byRoute = stage.indexOf('byRoute ||', own);
  const cardless = stage.indexOf('(cardless ? {', own);
  assert.ok(own > 0 && byRoute > own && cardless > byRoute, 'järjekord: oma komplekt, tee järgi, kaardita lehe nimi');
  assert.ok(stage.includes('"/documents": "/vestlus?workspace=documents"'), 'dokumentide leht kannab oma kaardi nime');
});
