// Builds, checks and (with --activate) switches the chat page to an approved RAG v2 dialogue plan over
// one tenant's active search generation: open questions, typed dialogue state, the unified retrieval
// route and the municipal catalogue, bounded by a money cap. Run on the server in the running release's directory with
// that release's env file, so the plan is bound to the code and the settings the service runs:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-chat-plan.mjs --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v1 \
//     --template /etc/sotsiaalai/m4-luna6-20260923.json --out /etc/sotsiaalai/m4-corpus-chat-20260927.json \
//     --budget-usd 3 --basis "<owner instruction>" [--activate]
// The template supplies only the approved user, account project and prices. Nothing is sent to a provider.
// --activate writes rag.env, which the next release's env file is made from. The running release reads only its own
// env file: `scripts/rag-v2-plan-release.mjs activate --plan <out> --rag-env <that file>` and a restart bring the plan
// to it (scripts/rag-v2-corpus-run.sh does both; docs/rag-v2/runbook-corpus-increment.md, section 9).
// A release renews the active plan for its own code without this script (scripts/rag-v2-plan-release.mjs, ADR-037).
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { readPilotConfig, validAuditDays, validReasoningChoices, validRetentionHours } from '../lib/rag-v2/pilot/config.js';
import { budgetLedgerId } from '../lib/rag-v2/pilot/contracts.js';
import { activateChatPlan, newChatPlan, preflightChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';

const { values } = parseArgs({ options: { tenant: { type: 'string' }, profile: { type: 'string' }, template: { type: 'string' },
  out: { type: 'string' }, 'budget-usd': { type: 'string' }, basis: { type: 'string' }, reasoning: { type: 'string', default: 'medium' }, 'rag-env': { type: 'string', default: '/etc/sotsiaalai/rag.env' },
  // ADR-092: the efforts a user may choose between in the chat, e.g. "low,medium"; --reasoning stays the one used unasked.
  'reasoning-choices': { type: 'string' },
  // The plan file this one replaces for a setting only (not for a new corpus): the new plan keeps counting against that
  // plan's ledger, so --budget-usd stays one cap over both and the money already spent stays spent. Without it the new
  // plan starts its own count from zero.
  'continue-ledger': { type: 'string' },
  // ADR-093: days a finished turn keeps its full audit before it is made lean (0 = lean when published). Without it a
  // turn keeps its full audit for good.
  'audit-days': { type: 'string' },
  // ADR-094: hours a turn's audit row lives before it is deleted (1-168); the conversation stays in its own messages
  // and follows the 90-day rule. Without it the plan has no time limit: rows and conversations are kept (development).
  'retention-hours': { type: 'string' },
  activate: { type: 'boolean', default: false } } });
const usd = Number(values['budget-usd']);
const reasoningChoices = values['reasoning-choices'] ? values['reasoning-choices'].split(',').map(effort => effort.trim()) : null;
const auditDays = values['audit-days'] === undefined ? null : Number(values['audit-days']);
const retentionHours = values['retention-hours'] === undefined ? null : Number(values['retention-hours']);
if (!['low', 'medium', 'high'].includes(values.reasoning) || !values.tenant || !values.profile || !values.template || !values.out?.startsWith('/etc/sotsiaalai/') || !(usd > 0 && usd <= 10) || !values.basis
  || reasoningChoices && !validReasoningChoices({ reasoning: values.reasoning, reasoningChoices }) || auditDays !== null && !validAuditDays(auditDays) || retentionHours !== null && !validRetentionHours(retentionHours)) {
  throw Error('usage: --tenant --profile --template --out /etc/sotsiaalai/<file> --budget-usd <0-10] --basis <text> [--reasoning-choices low,medium] [--continue-ledger <plan file>] [--audit-days <0-365>] [--retention-hours <1-168>] [--activate]');
}
const template = JSON.parse(await fs.readFile(values.template, 'utf8'));
const budgetLedger = values['continue-ledger'] ? budgetLedgerId(JSON.parse(await fs.readFile(values['continue-ledger'], 'utf8'))) : null;
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
let plan;
try {
  const generation = await postgres.active(values.tenant);
  plan = await newChatPlan({ generation, tenant: values.tenant, profileId: values.profile, users: template.users, accountProject: template.accountProject,
    prices: template.prices, reasoning: values.reasoning, reasoningChoices, budgetLedger, auditDays, retentionHours, nanoUsd: Math.round(usd * 1e9), basis: values.basis });
  // The same checks the chat runs before a turn: active generation, profile, versions and directories.
  await preflightChatPlan(plan);
} finally { await postgres.close(); }
await fs.writeFile(values.out, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o640 });
const summary = { out: values.out, id: plan.id, tenant: plan.tenant, generation: plan.generationId, profile: plan.profileId,
  documents: Object.keys(plan.documents).length, budgetUsd: usd, reasoning: plan.reasoning, reasoningChoices: plan.reasoningChoices ?? null, budgetLedger: plan.budgetLedger ?? null, auditDays: plan.auditDays ?? null, retentionHours: plan.retentionHours,
  implementationHash: plan.implementationHash.slice(0, 12), activated: false };
if (values.activate) {
  await activateChatPlan({ ragEnv: values['rag-env'], file: values.out, plan });
  Object.assign(process.env, { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: values.out });
  const checked = await readPilotConfig(plan.users[0]);
  summary.activated = checked.id === plan.id;
}
console.log(JSON.stringify(summary));
process.exit(0);
