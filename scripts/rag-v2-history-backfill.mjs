// ADR-094: gives every completed chat turn that has an audit row but no durable record its record, made from the row
// as it is made at publication: the turn's two messages get the question and the answer as text, and the answer's
// message the record. For turns published before the conversation was kept in its own messages (their messages are
// placeholders, and a plan change hides them), and for records of the first step that lack the topic's user turns.
// Only a placeholder or the turn's own text is written over; no audit row is changed. No model or embedding call.
// Prints counts only. --dry-run counts what would be written and writes nothing.
// Run on the server in the running release's directory with that release's env file:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-history-backfill.mjs [--dry-run]
import { parseArgs } from 'node:util';
import { recordStoredTurns } from '../lib/rag-v2/pilot/history-backfill.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const { default: prisma } = await import('../lib/prisma.js');
const started = Date.now();
const summary = await recordStoredTurns(prisma, { dryRun: values['dry-run'] });
console.log(JSON.stringify({ ...summary, seconds: Math.round((Date.now() - started) / 1000) }));
await prisma.$disconnect();
process.exit(0);
