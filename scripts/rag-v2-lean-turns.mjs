// ADR-093: makes whole completed chat turns older than --days lean, batch after batch, until none is left or the time
// given is used. For what the retention sweep does not do by itself: the turns an earlier plan left whole when a plan
// starts to publish lean (--days 0; the sweep does not look for whole turns under such a plan), and a backlog.
// The lean form is one-way: what a turn lets go cannot be brought back from its row. No model or embedding call.
// --dry-run counts the turns that are due and writes nothing.
// Run on the server in the running release's directory with that release's env file:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-lean-turns.mjs --days 0 [--minutes 10] [--dry-run]
import { parseArgs } from 'node:util';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';

const { values } = parseArgs({ options: { days: { type: 'string' }, minutes: { type: 'string', default: '10' }, 'dry-run': { type: 'boolean', default: false } } });
const days = Number(values.days), minutes = Number(values.minutes);
if (values.days === undefined || !Number.isInteger(days) || days < 0 || days > 365 || !(minutes > 0 && minutes <= 120)) {
  throw Error('usage: --days <0-365> [--minutes <0-120], default 10] [--dry-run]');
}
const { default: prisma } = await import('../lib/prisma.js');
const before = new Date(Date.now() - days * 86400000);
const due = async () => (await prisma.$queryRaw`SELECT count(*)::int AS n FROM "M4PilotTurn" WHERE state = 'completed' AND "createdAt" < ${before} AND NOT jsonb_exists(payload, 'lean')`)[0].n;
const summary = { days, before: before.toISOString(), dueBefore: await due(), madeLean: 0, dueAfter: null, dryRun: values['dry-run'] };
if (!values['dry-run']) {
  const started = Date.now(), store = new PilotStore(prisma);
  for (;;) {
    const sweep = await store.slimDue(days, { budgetMs: Math.max(1000, minutes * 60000 - (Date.now() - started)) });
    summary.madeLean += sweep.slimmed;
    // `more` after a sweep that made nothing lean means the rest cannot be made lean now; after one that did, time ran out.
    if (!sweep.more || !sweep.slimmed || Date.now() - started >= minutes * 60000) break;
  }
  summary.seconds = Math.round((Date.now() - started) / 1000);
}
summary.dueAfter = await due();
console.log(JSON.stringify(summary));
await prisma.$disconnect();
process.exit(0);
