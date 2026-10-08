import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotPost, pilotRole } from '../lib/chat/m4PilotServer.js';
import { createSSEReader } from '../components/chat/utils/sse.js';

// ADR-040: the real POST handler with local test adapters for the authentication, the RAG session, the service and
// the store. The stream carries provisional text ('delta') and then one 'done' with the reply the JSON path sends.
const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const request = (question, { stream = true, key = 'synthetic-key' } = {}) => new Request('http://localhost:3000/api/chat', { method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').origin, 'sec-fetch-site': 'same-origin',
    'x-rag-pilot-format': 'chat', ...(stream ? { accept: 'text/event-stream' } : {}) },
  body: JSON.stringify({ question, convId: 'synthetic-conv', clientTurnKey: key, contextMode: 'new' }) });
const authenticate = async () => ({ userId: 'synthetic-user' });
const answer = { kind: 'grounded', blocks: [{ text: 'Vaide esitad 30 päeva jooksul.', factual: true, refs: ['S1'] }], limitations: [], clarification: null };
const completed = question => ({ id: 't1', state: 'completed', mode: 'real', question, answer, sources: [{ ref: 'S1', title: 'Haldusmenetluse seadus', pages: [1], used: true }] });
const events = async response => { const out = []; for await (const ev of createSSEReader(response.body)) out.push({ event: ev.event, data: JSON.parse(ev.data) }); return out; };
const gate = () => { let open; const promise = new Promise(resolve => { open = resolve; }); return { promise, open }; };

test('a monetary quota failure remains a 429 with the EUR metric, even when a stopped turn exists', async () => {
  for (const stream of [false,true]) {
    const session = async () => ({ config: {}, store: { existing: async () => { throw Error('must not turn quota into validation failure'); } },
      service: { run: async () => { throw failure('USAGE_LIMIT_EXCEEDED', { pilotTurnId: 't1', details: { bucket: {
        metric: 'AI_COST_NANO_EUR', used: 3600000000n, reserved: 0n, hardLimit: 3600000000n, remaining: 0n,
        periodEnd: new Date(Date.now()+86400000) } } }); } } });
    const response = await pilotPost(request('Synthetic cost test?',{stream}),{authenticate,session});
    const result = stream ? (await events(response)).at(-1).data : {status:response.status,body:await response.json()};
    assert.equal(result.status,429); assert.equal(result.body.usage.metric,'AI_COST_NANO_EUR');
  }
});

test('ADR-107: the turn carries the role of the session, an administrator the chosen view role, and never a role of the request body', async () => {
  const cookies = value => ({ cookies: { get: name => (name === 'sotsiaalai_admin_view_role' && value ? { value } : undefined) } });
  // The platform's roles by their model names; an administrator without a chosen view answers as a specialist.
  assert.deepEqual([pilotRole({ user: { id: 'u', role: 'SOCIAL_WORKER' } }, cookies()), pilotRole({ user: { id: 'u', role: 'CLIENT' } }, cookies()), pilotRole({ user: { id: 'u', role: 'SERVICE_PROVIDER' } }, cookies())],
    ['specialist', 'help_seeker', 'service_provider']);
  assert.deepEqual([pilotRole({ user: { id: 'a', role: 'ADMIN', isAdmin: true } }, cookies()), pilotRole({ user: { id: 'a', role: 'ADMIN', isAdmin: true } }, cookies('CLIENT')),
    pilotRole({ user: { id: 'a', role: 'ADMIN', isAdmin: true } }, cookies('SERVICE_PROVIDER'))], ['specialist', 'help_seeker', 'service_provider']);
  // The view cookie is an administrator's: for anyone else it changes nothing. Without a session there is no role.
  assert.equal(pilotRole({ user: { id: 'u', role: 'CLIENT' } }, cookies('SOCIAL_WORKER')), 'help_seeker');
  assert.equal(pilotRole(undefined, cookies('SOCIAL_WORKER')), null);
  // The handler: the body's own "userRole" is dropped and the session's goes to the service.
  const seen = [];
  const session = async () => ({ config: {}, store: {}, service: { run: async (user, input) => { seen.push(input.userRole); return completed(input.question); } } });
  const post = (auth, body) => pilotPost(new Request('http://localhost:3000/api/chat', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').origin, 'sec-fetch-site': 'same-origin', 'x-rag-pilot-format': 'chat' },
    body: JSON.stringify({ question: 'Küsimus?', convId: 'synthetic-conv', clientTurnKey: 'synthetic-key', contextMode: 'new', ...body }) }), { authenticate: async () => auth, session });
  assert.equal((await post({ userId: 'u', session: { user: { id: 'u', role: 'SOCIAL_WORKER' } } }, { userRole: 'help_seeker' })).status, 200);
  assert.equal((await post({ userId: 'u', session: { user: { id: 'u', role: 'CLIENT' } } }, { userRole: 'specialist' })).status, 200);
  assert.equal((await post({ userId: 'u' }, { userRole: 'specialist' })).status, 200);
  assert.deepEqual(seen, ['specialist', 'help_seeker', undefined]);
});

test('the answer streams its provisional text, then one done event with the checked reply', async () => {
  const session = async () => ({ config: {}, store: {}, service: { run: async (user, input, options) => {
    options.onAnswerText('Vaide esitad ');
    options.onAnswerText('30 päeva jooksul.');
    return completed(input.question);
  } } });
  const response = await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.match(response.headers.get('cache-control'), /no-store.*no-transform/);
  const all = await events(response);
  assert.deepEqual(all.map(ev => ev.event), ['delta', 'delta', 'done']);
  assert.equal(all.filter(ev => ev.event === 'delta').map(ev => ev.data.t).join(''), 'Vaide esitad 30 päeva jooksul.');
  const done = all.at(-1).data;
  assert.equal(done.status, 200);
  assert.equal(done.body.answer, 'Vaide esitad 30 päeva jooksul. [S1]', 'the checked answer carries its references');
  assert.equal(done.body.completionStatus, 'COMPLETED');
  // Without the event stream the same reply is JSON, as before.
  const json = await pilotPost(request('Kuidas vaidlustada?', { stream: false }), { authenticate, session: async () => ({ config: {}, store: {},
    service: { run: async (user, input, options) => { assert.equal(options, undefined, 'no stream is requested'); return completed(input.question); } } }) });
  assert.match(json.headers.get('content-type'), /application\/json/);
  assert.equal((await json.json()).answer, 'Vaide esitad 30 päeva jooksul. [S1]');
});

test('an answer that fails its checks after its text was shown ends with the failure, never the draft', async () => {
  const session = async () => ({ config: {}, store: { existing: async () => ({ id: 't1', state: 'answer_rejected' }) }, service: {
    run: async (user, input, options) => { options.onAnswerText('Vaide esitad 30 päeva'); throw failure('invalid_answer_reference', { status: 502, pilotTurnId: 't1' }); },
    access: async () => ({}),
    restore: async () => ({ id: 't1', state: 'answer_rejected', mode: 'real', question: 'Kuidas vaidlustada?', failureKind: 'references' }) } });
  const all = await events(await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session }));
  assert.deepEqual(all.map(ev => ev.event), ['delta', 'done']);
  const done = all.at(-1).data;
  assert.equal(done.body.messageKey, 'm4Pilot.referenceFailed');
  assert.equal(done.body.completionStatus, 'FAILED');
  assert.equal(done.body.answer, undefined, 'the unchecked text is not the reply');
  // A failure the turn cannot read back keeps its error code and status.
  const other = await events(await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session: async () => ({ config: {}, store: {},
    service: { run: async () => { throw failure('provider_failed', { status: 502 }); } } }) }));
  assert.deepEqual(other.at(-1).data, { status: 502, body: { ok: false, code: 'provider_failed' } });
});

test('a reader that goes away does not stop the turn; the same key reads the saved answer back', async () => {
  const release = gate(), finished = gate();
  const saved = { row: null };
  const service = {
    run: async (user, input, options) => {
      if (saved.row) return saved.row; // the same key: the existing turn is restored, no second run
      options.onAnswerText('Vaide esitad ');
      await release.promise;
      options.onAnswerText('30 päeva jooksul.'); // the reader is gone: nothing to send, nothing thrown
      saved.row = completed(input.question);
      finished.open();
      return saved.row;
    },
  };
  const session = async () => ({ config: {}, store: {}, service });
  const response = await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session });
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: delta/);
  await reader.cancel(); // the connection is lost
  release.open();
  await finished.promise;
  assert.equal(saved.row.state, 'completed', 'the turn ran to its end');
  const again = await events(await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session }));
  assert.deepEqual(again.map(ev => ev.event), ['done']);
  assert.equal(again[0].data.body.answer, 'Vaide esitad 30 päeva jooksul. [S1]');
});

test('a reconnect while the first request still works waits for its saved turn and starts no second call', async () => {
  let restores = 0, runs = 0;
  const pending = { id: 't1', state: 'claimed', mode: 'real', question: 'Kuidas vaidlustada?' };
  const session = async () => ({ config: {}, store: { existing: async () => ({ id: 't1' }) }, service: {
    run: async () => { runs++; return pending; },
    access: async () => ({}),
    restore: async () => (++restores < 3 ? pending : completed('Kuidas vaidlustada?')) } });
  const all = await events(await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session, settle: { intervalMs: 5, limitMs: 2000 } }));
  assert.deepEqual(all.map(ev => ev.event), ['done']);
  assert.equal(all[0].data.body.answer, 'Vaide esitad 30 päeva jooksul. [S1]');
  assert.deepEqual([runs, restores], [1, 3]);
  // A turn that stays unfinished past the limit ends as pending, as the JSON path reports it.
  const stuck = await events(await pilotPost(request('Kuidas vaidlustada?'), { authenticate, settle: { intervalMs: 5, limitMs: 30 },
    session: async () => ({ config: {}, store: { existing: async () => ({ id: 't1' }) }, service: { run: async () => pending, access: async () => ({}), restore: async () => pending } }) }));
  assert.equal(stuck[0].data.status, 409);
  assert.equal(stuck[0].data.body.messageKey, 'm4Pilot.pending');
});

test('checks before the answer keep their JSON status; a crisis sentence still ends with its notice', async () => {
  const denied = await pilotPost(request('Kuidas vaidlustada?'), { authenticate: async () => { throw failure('unauthorized', { status: 401 }); }, session: async () => ({}) });
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('content-type'), /application\/json/);
  const unconfigured = await pilotPost(request('Kuidas vaidlustada?'), { authenticate, session: async () => { throw failure('not_configured', { status: 503 }); } });
  assert.equal(unconfigured.status, 503);
  const crisis = await events(await pilotPost(request('Tahan end tappa'), { authenticate, session: async () => ({ config: {}, store: {},
    service: { run: async () => { throw failure('provider_failed', { status: 502 }); } } }) }));
  assert.equal(crisis.at(-1).data.status, 200);
  assert.equal(crisis.at(-1).data.body.isCrisis, true);
  assert.equal(crisis.at(-1).data.body.messageKey, 'chat.crisis.notice');
});
