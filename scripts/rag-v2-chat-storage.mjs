// ADR-094, step 5: what the chat takes on disk and how it grows. Read-only; prints numbers only (no question, answer
// or source text): the tables' sizes, the audit rows by form (whole, lean), what the last day and week added, the
// durable records in the conversations' messages, and what waits for a sweep (rows past their time that are not purged,
// whole rows older than the running plan's audit time, conversations past their time). The free space is the disk of
// the directory given by --disk (default /).
// Run on the server in the running release's directory with that release's env file:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-chat-storage.mjs [--disk /]
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chatStorageReport } from '../lib/rag-v2/pilot/storage-report.js';

const { values } = parseArgs({ options: { disk: { type: 'string', default: '/' } } });
const plan = process.env.M4_PILOT_ENABLED === '1' && process.env.M4_PILOT_CONFIG ? JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8')) : null;
const { default: prisma } = await import('../lib/prisma.js');
const report = await chatStorageReport(prisma, { auditDays: Number.isInteger(plan?.auditDays) ? plan.auditDays : null });
const disk = await fs.statfs(values.disk).then(stat => ({ path: values.disk, free_bytes: stat.bavail * stat.bsize, total_bytes: stat.blocks * stat.bsize }), () => null);
console.log(JSON.stringify({ plan: plan ? { id: plan.id, auditDays: plan.auditDays ?? null, retentionHours: plan.retentionHours ?? null } : null, disk, ...report }));
await prisma.$disconnect();
process.exit(0);
