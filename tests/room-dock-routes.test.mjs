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
import { isWorkspaceHubRoute, panelHasRoomDock, WORKSPACE_HUB_ROUTES } from '../lib/roomDock.js';

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
