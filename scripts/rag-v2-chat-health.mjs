// ADR-125 (10.10.2026): how the chat is doing. Read-only; prints numbers only (no question, answer, passage, title or
// user). Per day and in total for the turns of the last --days days: how they ended (by state, the failed ones by error
// code and by the call that got no response), the answers by kind, validation failures by code, the greeting and thanks
// routes, what the search plan and the selection did, and the median and 95th percentile of the time to each phase and
// of the whole turn; the provider calls' receipts of the same days; and the running plan's caps against its ledger
// with what is left (lib/rag-v2/pilot/health-report.js says how each is counted).
// No model call, no embedding request, nothing is written to a database: the provider's module is not loaded, and
// fetch and Node's http and https requests are refused in this process. The database is the only thing read.
// Turns are read only while the application has one account (the test account); with more accounts --turns-until
// <ISO time> must name a moment up to which it had one, and later turns are left unread (the guard of
// scripts/rag-v2-coverage-map.mjs). The ledger and the receipts hold no content and are read either way; of a receipt
// only its stage, state, sums and time are read, not whose it is.
// The turn counts are of rows still stored: a plan with a retention time deletes a turn's row when it ends (the
// report's plan.retentionHours), and a deleted conversation takes its rows along. The provider calls' receipts are the
// count that survives that.
// Run on the server in the running release's directory with that release's env file:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-chat-health.mjs --days 7 [--out <file>] [--turns-until <ISO time>]
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { parseArgs } from 'node:util';
import { budgetLedgerId } from '../lib/rag-v2/pilot/contracts.js';
import { turnFacts, chatHealthReport } from '../lib/rag-v2/pilot/health-report.js';

const deny = () => { throw Error('chat_health_network_forbidden'); };
globalThis.fetch = deny; http.request = deny; http.get = deny; https.request = deny; https.get = deny;

const { values } = parseArgs({ options: { days: { type: 'string', default: '7' }, out: { type: 'string' }, 'turns-until': { type: 'string' } } });
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1 || days > 90 || (values['turns-until'] && Number.isNaN(Date.parse(values['turns-until'])))) throw Error('usage: [--days <1-90>] [--out <file>] [--turns-until <ISO time>]');
const plan = process.env.M4_PILOT_ENABLED === '1' && process.env.M4_PILOT_CONFIG ? JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8')) : null;
const { default: prisma } = await import('../lib/prisma.js');
const now = new Date(), since = new Date(now.getTime() - days * 86400000), until = values['turns-until'] ? new Date(values['turns-until']) : null;

const accounts = await prisma.user.count(), turns = [];
let read = { accounts, skipped: 'more than one account and no --turns-until' };
if (accounts === 1 || until) {
  // The ids first, then the rows a few at a time: a row's payload can be a hundred kilobytes and only its facts are
  // kept. The packet, the request and the vector have columns of their own (ADR-094) and are not read at all.
  const listed = await prisma.m4PilotTurn.findMany({ where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } }, select: { id: true } });
  for (let start = 0; start < listed.length; start += 50) {
    for (const row of await prisma.m4PilotTurn.findMany({ where: { id: { in: listed.slice(start, start + 50).map(item => item.id) } }, select: { state: true, payload: true, createdAt: true } })) turns.push(turnFacts(row));
  }
  read = { accounts, until: until ? until.toISOString() : null, rows: turns.length };
}
const receipts = await prisma.aiProviderCall.findMany({ where: { createdAt: { gte: since } }, select: { stage: true, state: true, reservedNanoUsd: true, billedNanoUsd: true, createdAt: true } });
const ledger = plan ? await prisma.m4PilotLedger.findUnique({ where: { id: budgetLedgerId(plan) } }) : null;

const report = { plan: plan ? { id: plan.id, ledger: budgetLedgerId(plan), auditDays: plan.auditDays ?? null, retentionHours: plan.retentionHours ?? null } : null, days, since: since.toISOString(), read,
  ...chatHealthReport({ turns, receipts, budget: plan?.budget ?? null, ledger, now }) };
if (values.out) await fs.writeFile(values.out, JSON.stringify(report, null, 1));
// Written with its callback: on a pipe a long report was cut at the first 64 KB when the process ended at once.
await new Promise(done => process.stdout.write(`${JSON.stringify(report)}\n`, done));
await prisma.$disconnect();
process.exit(0);
