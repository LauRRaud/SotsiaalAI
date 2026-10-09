import test from 'node:test';
import assert from 'node:assert/strict';
import { announceViewRole, claimPageSwitch, hasPageSwitch, onViewRoleChanged, watchPageSwitch } from '../lib/viewRoleSignal.js';

test('lehe oma lüliti võtab ruumi varuvaliku ära ja annab selle lahkudes tagasi', () => {
  const seen = [];
  const stop = watchPageSwitch(() => seen.push(hasPageSwitch()));
  assert.equal(hasPageSwitch(), false);
  const releaseFirst = claimPageSwitch();
  const releaseSecond = claimPageSwitch();
  assert.equal(hasPageSwitch(), true);
  releaseFirst();
  assert.equal(hasPageSwitch(), true, 'teine lüliti on veel lehel');
  releaseFirst();
  assert.equal(hasPageSwitch(), true, 'sama lüliti kaks korda lahkumine ei loe teist maha');
  releaseSecond();
  assert.equal(hasPageSwitch(), false);
  assert.deepEqual(seen, [true, true, true, false]);
  stop();
  claimPageSwitch()();
  assert.equal(seen.length, 4, 'lahkunud kuulajat enam ei kutsuta');
});

test('vahetuse teade jõuab kuulajani ja serveris ei tee midagi', () => {
  assert.doesNotThrow(() => announceViewRole({ effectiveRole: 'CLIENT' }));
  assert.equal(typeof onViewRoleChanged(() => {}), 'function');

  const target = new EventTarget();
  globalThis.window = target;
  globalThis.CustomEvent ||= class extends Event {
    constructor(type, init) {
      super(type);
      this.detail = init?.detail;
    }
  };
  try {
    const got = [];
    const stop = onViewRoleChanged((user) => got.push(user.effectiveRole));
    announceViewRole({ effectiveRole: 'CLIENT' });
    announceViewRole();
    stop();
    announceViewRole({ effectiveRole: 'SOCIAL_WORKER' });
    assert.deepEqual(got, ['CLIENT', undefined]);
  } finally {
    delete globalThis.window;
  }
});
