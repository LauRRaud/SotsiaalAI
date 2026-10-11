// Paneelist lahkumise värav: leht võib esimese lahkumise kinni pidada.
import test from 'node:test';
import assert from 'node:assert/strict';

import { panelLeaveAllowed, setPanelLeaveGuard, twoPressLeaveGuard } from '../lib/panelLeaveGuard.js';

test('ilma väravata tohib lahkuda; värav võib keelduda ja vabastaja võtab selle ära', () => {
  assert.equal(panelLeaveAllowed('dock'), true);
  const asked = [];
  let allow = false;
  const release = setPanelLeaveGuard((reason) => {
    asked.push(reason);
    return allow;
  });
  assert.equal(panelLeaveAllowed('dock'), false);
  allow = true;
  assert.equal(panelLeaveAllowed('close'), true);
  assert.deepEqual(asked, ['dock', 'close']);
  release();
  assert.equal(panelLeaveAllowed('dock'), true);
  assert.equal(asked.length, 2, 'vabastatud väravat enam ei küsita');
});

test('uus värav asendab vana ja vana vabastaja ei võta uut ära; vigane värav ei lukusta', () => {
  const releaseOld = setPanelLeaveGuard(() => false);
  const releaseNew = setPanelLeaveGuard(() => true);
  releaseOld();
  assert.equal(panelLeaveAllowed(), true);
  releaseNew();
  const release = setPanelLeaveGuard(() => {
    throw new Error('katki');
  });
  assert.equal(panelLeaveAllowed(), true);
  release();
});

test('kahe vajutusega värav: esimene küsib, topeltvajutus ei loe, teine lubab, aegunud küsib uuesti', () => {
  let clock = 1000;
  const seen = [];
  const leave = twoPressLeaveGuard({ onAsk: () => seen.push('ask'), onClear: () => seen.push('clear'), now: () => clock });
  assert.equal(leave(), false);
  clock += 150;
  assert.equal(leave(), false, 'topeltvajutuse teine pool jääb vahele');
  clock += 600;
  assert.equal(leave(), true);
  assert.deepEqual(seen, ['ask', 'clear']);
  clock += 100;
  assert.equal(leave(), false, 'pärast lubamist algab küsimine otsast');
  clock += 9000;
  assert.equal(leave(), false, 'aegunud küsimus ei luba lahkuda');
  leave.clear();
  assert.deepEqual(seen, ['ask', 'clear', 'ask', 'ask', 'clear']);
});
