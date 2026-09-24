import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotPost } from '../lib/chat/m4PilotServer.js';

// The real POST handler with only the authentication and RAG session boundaries replaced.
const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const request = (question, chat = true) => new Request('http://localhost:3000/api/chat', { method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').origin, 'sec-fetch-site': 'same-origin',
    ...(chat ? { 'x-rag-pilot-format': 'chat' } : {}) },
  body: JSON.stringify({ question, convId: 'synthetic-conv', clientTurnKey: 'synthetic-key', contextMode: 'new' }) });
const authenticate = async () => ({ userId: 'synthetic-user' });
const post = async (question, session, chat = true) => {
  const response = await pilotPost(request(question, chat), { authenticate, session });
  return { status: response.status, body: await response.json() };
};
const turnFailure = failure('provider_failed', { status: 502, pilotTurnId: 'turn' });
const failures = {
  configuration: async () => { throw failure('not_configured', { status: 503 }); },
  recovery_access: async () => ({ config: {}, store: { existing: async () => null },
    service: { run: async () => { throw turnFailure; }, access: async () => { throw failure('implementation_approval_mismatch', { status: 403 }); } } }),
  restore: async () => ({ config: {}, store: { existing: async () => ({ state: 'stopped' }) },
    service: { run: async () => { throw turnFailure; }, access: async () => ({}), restore: async () => { throw failure('source_unavailable', { status: 404 }); } } }),
  provider: async () => ({ config: {}, store: {}, service: { run: async () => { throw failure('provider_failed', { status: 502 }); } } }),
  unfinished: async () => ({ config: {}, store: {}, service: { run: async () => ({ state: 'unknown', question: 'Tahan end tappa' }) } }),
};

test('R1: a crisis sentence returns the crisis notice after any configuration, search, answer or restore failure', async () => {
  for (const [name, session] of Object.entries(failures)) {
    const { status, body } = await post('Tahan end tappa', session);
    assert.equal(status, 200, name);
    assert.equal(body.isCrisis, true, name);
    assert.equal(body.ok, true, name);
    assert.equal(body.messageKey, 'chat.crisis.notice', name);
  }
});

test('R1 controls: ordinary questions keep their error, completed crisis turns keep the answer, auth still comes first', async () => {
  const configuration = await post('Kus on lähim sotsiaaltöötaja?', failures.configuration);
  assert.equal(configuration.status, 503);
  assert.equal(configuration.body.isCrisis, undefined);
  assert.equal((await post('Tahan end tappa', failures.configuration, false)).status, 503);
  const answer = { kind: 'grounded', blocks: [{ text: 'Vastus [S1]', refs: ['S1'] }], limitations: [], clarification: null };
  const completed = await post('Tahan end tappa', async () => ({ config: {}, store: {},
    service: { run: async () => ({ id: 't', state: 'completed', mode: 'test', question: 'Tahan end tappa', answer, sources: [] }) } }));
  assert.equal(completed.status, 200);
  assert.equal(completed.body.isCrisis, true);
  assert.match(completed.body.answer, /Vastus/);
  const denied = await pilotPost(request('Tahan end tappa'), { authenticate: async () => { throw failure('unauthorized', { status: 401 }); }, session: failures.provider });
  assert.equal(denied.status, 401);
});
