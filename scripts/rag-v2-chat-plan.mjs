// Builds, checks and (with --activate) switches the chat page to an approved RAG v2 dialogue plan over
// one tenant's active search generation: open questions, typed dialogue state, the unified retrieval
// route and the municipal catalogue, bounded by a money cap. Run on the server from the app root:
//   sudo -n env $(sudo -n cat /etc/sotsiaalai/rag.env | xargs) node --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-chat-plan.mjs --tenant sotsiaalai-corpus --profile hybrid-estnltk-chat-v1 \
//     --template /etc/sotsiaalai/m4-luna6-20260923.json --out /etc/sotsiaalai/m4-corpus-chat-20260927.json \
//     --budget-usd 3 --basis "<owner instruction>" [--activate]
// The template supplies only the approved user, account project and prices. Nothing is sent to a provider.
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';
import { readPilotConfig } from '../lib/rag-v2/pilot/config.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { DIALOGUE_VERSION, DIALOGUE_PROMPT_VERSION, DIALOGUE_SEARCH_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { TYPED_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_ANSWER_SCHEMA } from '../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { ANSWER_ENDPOINT } from '../lib/rag-v2/pilot/provider.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';

const { values } = parseArgs({ options: { tenant: { type: 'string' }, profile: { type: 'string' }, template: { type: 'string' },
  out: { type: 'string' }, 'budget-usd': { type: 'string' }, basis: { type: 'string' }, 'rag-env': { type: 'string', default: '/etc/sotsiaalai/rag.env' },
  activate: { type: 'boolean', default: false } } });
const usd = Number(values['budget-usd']);
if (!values.tenant || !values.profile || !values.template || !values.out?.startsWith('/etc/sotsiaalai/') || !(usd > 0 && usd <= 10) || !values.basis) {
  throw Error('usage: --tenant --profile --template --out /etc/sotsiaalai/<file> --budget-usd <0-10] --basis <text> [--activate]');
}
const template = JSON.parse(await fs.readFile(values.template, 'utf8'));
if (!Array.isArray(template.users) || template.users.length !== 1 || !/^proj_[A-Za-z0-9_-]+$/.test(template.accountProject || '')) throw Error('template_owner_or_project_missing');
const profile = retrievalProfile(values.profile);
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
let plan;
try {
  const generation = await postgres.active(values.tenant);
  const documents = Object.fromEntries(Object.entries(generation.snapshot.documents).map(([doc, entry]) => [doc, entry.version_id]));
  const nanoUsd = Math.round(usd * 1e9);
  const unsigned = { id: `m4-${values.tenant}-chat-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`, mode: 'real',
    tenant: values.tenant, usage: 'development_only', users: template.users, expiresAt: null, retentionHours: null, timeoutMs: 60000,
    documents, generationId: generation.id, profileId: profile.id, embedding: embeddingConfig(generation.config.embedding),
    model: 'gpt-6-luna', endpoint: ANSWER_ENDPOINT, accountProject: template.accountProject, modelContract: 'responses-strict-reasoning-v1',
    reasoning: 'medium', maxInputTokens: 300000, maxOutputTokens: 4096, implementationHash: (await implementationManifest()).hash,
    dialogueVersion: DIALOGUE_VERSION, promptVersion: DIALOGUE_PROMPT_VERSION, questionVersion: DIALOGUE_SEARCH_VERSION,
    dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION, dialogueStateSchemaHash: digest(TYPED_DIALOGUE_ANSWER_SCHEMA),
    retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION, searchAssist: SEARCH_ASSIST_VERSION,
    prices: template.prices, questionPolicy: { mode: 'bounded_dynamic' },
    // The money cap is the real bound; the attempt caps only stop a runaway loop.
    budget: { attempts: 4000, embeddingAttempts: 2000, answerAttempts: 2000, tokens: 400000000, nanoUsd },
    authorizationBasis: { date: new Date().toISOString().slice(0, 10), ownerInstruction: values.basis } };
  plan = { ...unsigned, approval: { approvedBy: template.users[0], approvedAt: new Date().toISOString(), planHash: digest(unsigned),
    dynamicQuestions: true, queryAndSourceEgress: true, dialogueEgress: true, authorization: 'direct_owner_request_development_chat' } };
  // The same checks the chat runs before a turn: active generation, profile, versions and directories.
  const config = { ...plan, profile, configHash: digest(plan) };
  await runtimeAdapters(async () => config, template.users[0]).preflight(config);
} finally { await postgres.close(); }
await fs.writeFile(values.out, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o640 });
const summary = { out: values.out, id: plan.id, tenant: plan.tenant, generation: plan.generationId, profile: plan.profileId,
  documents: Object.keys(plan.documents).length, budgetUsd: usd, implementationHash: plan.implementationHash.slice(0, 12), activated: false };
if (values.activate) {
  const env = await fs.readFile(values['rag-env'], 'utf8');
  await fs.writeFile(`${values['rag-env']}.before-${plan.id}`, env, { flag: 'wx', mode: 0o600 });
  const lines = env.split('\n').filter(line => !/^(M4_PILOT_CONFIG|M4_PILOT_ENABLED|RAG_V2_ESTNLTK_IDLE_MS)=/.test(line));
  const next = [...lines.filter((line, i) => line || i < lines.length - 1), `M4_PILOT_ENABLED=1`, `M4_PILOT_CONFIG=${values.out}`, 'RAG_V2_ESTNLTK_IDLE_MS=3600000', ''].join('\n');
  await fs.writeFile(values['rag-env'], next, { mode: 0o600 });
  Object.assign(process.env, { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: values.out });
  const checked = await readPilotConfig(plan.users[0]);
  summary.activated = checked.id === plan.id;
}
console.log(JSON.stringify(summary));
process.exit(0);
