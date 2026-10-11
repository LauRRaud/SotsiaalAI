import test from 'node:test';
import assert from 'node:assert/strict';
import { ethicsApi } from '../app/api/ethics/_shared.js';

const req = (method = 'POST', body = '{}', origin = 'https://probe.invalid') => new Request('https://probe.invalid/api/ethics', {
  method, headers: { 'content-type': 'application/json', origin }, ...(method === 'GET' ? {} : { body })
});
test('API fails closed for session/role/subscription, foreign origin and oversized input; read/delete survive access loss', async () => {
  let session = { user: { id: 'owner', role: 'SOCIAL_WORKER' } }, subscribed = true, calls = 0, rateLimited = false;
  const deps = { getSession: async () => session, subscription: async () => ({ ok: subscribed }), rateLimit: () => rateLimited ? new Response('{}', { status: 429 }) : null };
  const action = async userId => { assert.equal(userId, 'owner'); calls++; return { saved: true }; };
  session = null;
  assert.equal((await ethicsApi(req(), action, deps)).status, 401);
  session = { user: { id: 'owner', role: 'SOCIAL_WORKER' }, authDegraded: true };
  assert.equal((await ethicsApi(req(), action, deps)).status, 401);
  session = { user: { id: 'owner', role: 'CLIENT' } };
  assert.equal((await ethicsApi(req(), action, deps)).status, 403);
  session.user.role = 'SOCIAL_WORKER'; subscribed = false;
  assert.equal((await ethicsApi(req(), action, deps)).status, 402);
  subscribed = true;
  assert.equal((await ethicsApi(req('POST', '{}', 'https://foreign.invalid'), action, deps)).status, 403);
  assert.equal((await ethicsApi(req('POST', 'x'.repeat(96001)), action, deps)).status, 413);
  assert.equal((await ethicsApi(req('POST', '[]'), action, deps)).status, 400);
  rateLimited = true;
  assert.equal((await ethicsApi(req(), action, deps)).status, 429);
  assert.equal(calls, 0);
  rateLimited = false;
  const result = await ethicsApi(req(), action, deps);
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  session.user.role = 'CLIENT'; subscribed = false;
  for (const method of ['GET', 'DELETE']) assert.equal((await ethicsApi(req(method), action, deps)).status, 200);
  assert.equal(calls, 3);
});
