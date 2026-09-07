import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
const base = process.env.M4_TEST_HTTP_BASE;
const local = base && new URL(base);
if (base && (!['localhost', '127.0.0.1'].includes(local.hostname) || local.protocol !== 'http:')) throw Error('local HTTP fixture only');
const database = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (base && (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/sotsiaal_ai_m4_dev')) throw Error('isolated database required');

test('F03/F05/F09/F16: real local HTTP authorization and terminal retry preserve messages and counters', { skip: !base }, async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.href }), log: [] });
  const fixture = process.env.M4_HTTP_FIXTURE ? JSON.parse(await fs.readFile(process.env.M4_HTTP_FIXTURE, 'utf8'))
    : { convId: 'm4-followup-browser-20260906-1', pilotId: 'm4-followup-local-20260906-1', expectedAttempts: 4, failureIndex: 1 };
  const { convId, pilotId, expectedAttempts, failureIndex } = fixture;
  const failureMessageKey = fixture.failureMessageKey || 'm4Pilot.referenceFailed';
  const userId = 'm4-local-tester-20260906';
  const report = [];
  function client() {
    const cookies = new Map();
    return async (route, options = {}) => {
      const response = await fetch(base + route, { ...options, redirect: 'manual', headers: { cookie: [...cookies].map(([k,v]) => k + '=' + v).join('; '),
        origin: base, 'sec-fetch-site': 'same-origin', ...options.headers } });
      for (const line of response.headers.getSetCookie()) { const pair = line.split(';')[0], at = pair.indexOf('='); cookies.set(pair.slice(0,at), pair.slice(at+1)); }
      return response;
    };
  }
  async function login(email) {
    const request = client();
    const step = await request('/api/auth/login-step1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, pin: '482719' }) });
    assert.equal(step.status, 200); const login = await step.json(); assert.ok(login.temp_login_token, 'synthetic local login token required');
    const csrf = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, temp_login_token: login.temp_login_token, callbackUrl: base + '/vestlus', json: 'true' }) });
    const session = await (await request('/api/auth/session')).json(); assert.ok(session.user?.id); return request;
  }
  try {
    assert.equal((await client()('/api/chat/pilot?convId=' + convId)).status, 401); report.push('anonymous:401');
    const denied = await login('m4-other@example.invalid');
    assert.equal((await denied('/api/chat/pilot?convId=' + convId)).status, 403); report.push('other-admin:403');
    const request = await login('m4-tester@example.invalid');
    const before = await db.m4PilotLedger.findUnique({ where: { id: pilotId } });
    assert.equal(before.totals.answerAttempts, expectedAttempts);
    const row = await db.m4PilotTurn.findFirst({ where: { pilotId: before.id, state: 'answer_rejected' }, include: { chatTurn: true } });
    const input = { convId, clientTurnKey: row.chatTurn.clientTurnKey, question: row.payload.question, contextMode: row.payload.contextMode, language: row.payload.query.language };
    const headers = { 'content-type': 'application/json', 'x-rag-pilot': '1', 'x-rag-pilot-format': 'chat' };
    for (const body of [{...input,role:'ADMIN'},{...input,tenant:'foreign'},{...input,history:[]}]) {
      assert.equal((await request('/api/chat', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
    }
    assert.equal((await request('/api/chat', { method: 'POST', headers: {...headers,origin:'https://foreign.invalid'}, body: JSON.stringify(input) })).status, 403);
    const repeat = await Promise.all([1,2].map(() => request('/api/chat', { method: 'POST', headers, body: JSON.stringify(input) }).then(async r => ({ status:r.status, body:await r.json() }))));
    for (const r of repeat) { assert.equal(r.status,200); assert.equal(r.body.pilotState,'answer_rejected'); assert.equal(r.body.messageKey,failureMessageKey); }
    const response = await request('/api/chat/pilot?format=chat&convId=' + convId); assert.match(response.headers.get('cache-control'), /no-store/);
    const data = await response.json(); assert.equal(data.messages.length,expectedAttempts * 2);
    assert.equal(data.messages[failureIndex * 2 + 1].messageKey,failureMessageKey);
    const publicJson = JSON.stringify(data);
    for (const privateText of ['PRIVATE_INVALID_DRAFT','PRIVATE_V3_INVALID_DRAFT','PRIVATE_FORGED_QUOTE','PRIVATE_DIAGNOSTICS','requestAudit','responseAudit','evidenceDraftAudit','"quote":','S99']) assert.ok(!publicJson.includes(privateText));
    const source = new URL(data.messages[1].sources[0].url,base);
    const query = source.search;
    assert.equal((await request('/api/chat/pilot'+query)).status,200);
    assert.equal((await denied('/api/chat/pilot'+query)).status,403);
    source.searchParams.set('ref','S99'); assert.equal((await request('/api/chat/pilot'+source.search)).status,403);
    source.searchParams.set('turnId',row.id); source.searchParams.set('ref','S1'); assert.equal((await request('/api/chat/pilot'+source.search)).status,404);
    const foreign = await db.conversation.create({data:{userId:'m4-other-admin-20260906',role:'CLIENT',metadata:{m4:true},expiresAt:new Date(Date.now()+60000)}});
    try { assert.equal((await request('/api/chat/pilot?convId='+foreign.id)).status,403); }
    finally { await db.conversation.delete({where:{id:foreign.id}}); }
    assert.deepEqual((await db.m4PilotLedger.findUnique({ where: { id: before.id } })).totals,before.totals);
    assert.equal(await db.m4PilotTurn.count({where:{pilotId:before.id}}),expectedAttempts);
    assert.equal(await db.chatTurn.count({where:{userId,conversationId:convId}}),expectedAttempts);
    report.push('forged-fields:400','cross-origin:403','failed-key-parallel:200/same-terminal','refresh:' + (expectedAttempts * 2) + '-ordered-messages','private-draft:hidden','source-owner:200','source-other:403','source-invalid:403','source-failed-turn:404','foreign-conversation:403','ledger:unchanged');
    if(process.env.M4_HTTP_OUTPUT) await fs.writeFile(process.env.M4_HTTP_OUTPUT,JSON.stringify({checks:report,pass:report.length,fail:0,skip:0,newModelCalls:0,totals:before.totals},null,2),{flag:'wx'});
  } finally { await db.$disconnect(); }
});
