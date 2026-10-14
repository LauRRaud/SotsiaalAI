import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCurrentPrelaunchToken, isPrelaunchTestUser } from '../../../../lib/auth/prelaunchAccess.js';

const actors = [
  ['cmv7uufuo0000u3kmo9ausfgt', 'CLIENT'],
  ['cmv7uufv50003u3kmxjmb35yj', 'SOCIAL_WORKER'],
  ['cmv7uufvh0006u3kmo6mc5zrr', 'SERVICE_PROVIDER']
];
const now = new Date('2026-10-14T12:00:00Z');
function fixture(id, role, patch = {}, active = true) {
  return {
    token: { id, role: 'ADMIN', isAdmin: true, sessionVersion: 0, sessionRecordId: 'test-session' },
    options: { now, db: {
      user: { findUnique: async () => ({ role, isAdmin: false, sessionVersion: 0, accessSuspendedAt: null, subscriptions: [], ...patch }) },
      session: { findFirst: async ({ where }) => active && where.userId === id && where.id === 'test-session' ? { id: 'test-session' } : null }
    } }
  };
}
for (const [id, role] of actors) {
  test('only current ordinary test role admitted: ' + role, async () => {
    const f = fixture(id, role);
    assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), true);
    assert.equal(f.token.isAdmin, false);
    assert.equal(f.token.role, role);
  });
}
test('foreign account cannot use stale admin claim', async () => {
  const f = fixture('foreign-test-account', 'CLIENT');
  assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), false);
});
for (const [label, patch, active] of [
  ['suspended', { accessSuspendedAt: now }, true],
  ['revoked version', { sessionVersion: 1 }, true],
  ['deleted or expired tracked session', {}, false],
  ['role changed', { role: 'OTHER' }, true]
]) {
  test(label + ' test account denied', async () => {
    const f = fixture(...actors[0], patch, active);
    assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), false);
  });
}
test('missing user denied', async () => {
  const f = fixture(...actors[0]);
  f.options.db.user.findUnique = async () => null;
  assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), false);
});
test('database error denied and token downgraded', async () => {
  const f = fixture(...actors[0]);
  f.options.db.user.findUnique = async () => { throw Error('Synthetic unavailable DB'); };
  assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), false);
  assert.equal(f.token.isAdmin, false);
});
test('anonymous denied', async () => {
  assert.equal(await authorizeCurrentPrelaunchToken(null, {}), false);
});
test('test exception expires at boundary', async () => {
  const f = fixture(...actors[0]);
  f.options.now = new Date('2026-10-16T00:00:00Z');
  assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), false);
  assert.equal(isPrelaunchTestUser({ id: actors[0][0], role: actors[0][1] }, f.options.now), false);
});
test('fresh actual administrator remains admitted after expiry', async () => {
  const f = fixture('synthetic-admin', 'CLIENT', { isAdmin: true });
  f.options.now = new Date('2026-10-20T00:00:00Z');
  assert.equal(await authorizeCurrentPrelaunchToken(f.token, f.options), true);
});
