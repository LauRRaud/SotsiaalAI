import fs from 'node:fs/promises';
import { retrievalProfile } from '../search/profiles.js';
import { embeddingConfig } from '../search/embedding.js';
import { stable } from '../contracts.js';
import { implementationManifest } from './provenance.js';
import { digest, reject } from './contracts.js';
import { runtimeAdapters } from './retrieval.js';
import { DIALOGUE_VERSION, DIALOGUE_PROMPT_VERSION, DIALOGUE_SEARCH_VERSION } from './dialogue.js';
import { TYPED_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_ANSWER_SCHEMA } from './dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from './retrieval-plan.js';
import { RECORD_RETRIEVAL_VERSION } from '../search/structured-record-source.js';
import { ANSWER_ENDPOINT } from './provider.js';
import { SEARCH_ASSIST_VERSION } from './search-assist.js';

// The development chat plan (ADR-028): what the chat may do, bound to the exact runtime code by implementationHash.
// A plan is renewed for a release only in what the code decides (ADR-037); everything the owner approved stays.
export const RELEASE_RENEWAL = 'release_renewal_of_approved_plan';
export const RENEWAL_RULE = 'Omaniku otsus 27.09.2026: väljalase uuendab kinnitatud vestlusplaani automaatselt uuele koodile; '
  + 'kasutajad, eelarve, andmete väljasaatmise load ja indeksipõlvkond jäävad samaks.';
const OWNER_REQUEST = 'direct_owner_request_development_chat';
const DIRECT = [OWNER_REQUEST, RELEASE_RENEWAL];

/** The fields the running code decides. A plan whose values differ cannot execute on this code. */
export async function codeContract() {
  return { implementationHash: (await implementationManifest()).hash,
    dialogueVersion: DIALOGUE_VERSION, promptVersion: DIALOGUE_PROMPT_VERSION, questionVersion: DIALOGUE_SEARCH_VERSION,
    dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION, dialogueStateSchemaHash: digest(TYPED_DIALOGUE_ANSWER_SCHEMA),
    retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION, searchAssist: SEARCH_ASSIST_VERSION };
}
// A plan's ledger is keyed by its id, so every plan has its own; the id carries the minute (and a release's revision).
const planId = (tenant, now, release) => `m4-${tenant}-chat-${now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}${release ? `-r${release}` : ''}`;

/** A new plan over the tenant's active generation, approved by the owner's direct request (`basis`). */
export async function newChatPlan({ generation, tenant, profileId, users, accountProject, prices, reasoning, nanoUsd, basis, now = new Date() }) {
  if (!Array.isArray(users) || users.length !== 1 || !/^proj_[A-Za-z0-9_-]+$/.test(accountProject || '')) reject('template_owner_or_project_missing');
  const profile = retrievalProfile(profileId);
  const documents = Object.fromEntries(Object.entries(generation.snapshot.documents).map(([doc, entry]) => [doc, entry.version_id]));
  const unsigned = { id: planId(tenant, now), mode: 'real',
    tenant, usage: 'development_only', users, expiresAt: null, retentionHours: null, timeoutMs: 60000,
    documents, generationId: generation.id, profileId: profile.id, embedding: embeddingConfig(generation.config.embedding),
    model: 'gpt-6-luna', endpoint: ANSWER_ENDPOINT, accountProject, modelContract: 'responses-strict-reasoning-v1',
    // medium by the owner's decision (27.09.2026): low was 2.5x faster but gave weaker answers.
    reasoning, maxInputTokens: 300000, maxOutputTokens: 4096, ...await codeContract(),
    prices, questionPolicy: { mode: 'bounded_dynamic' },
    // The money cap is the real bound; the attempt caps only stop a runaway loop.
    budget: { attempts: 4000, embeddingAttempts: 2000, answerAttempts: 2000, tokens: 400000000, nanoUsd },
    authorizationBasis: { date: now.toISOString().slice(0, 10), ownerInstruction: basis } };
  return { ...unsigned, approval: { approvedBy: users[0], approvedAt: now.toISOString(), planHash: digest(unsigned),
    dynamicQuestions: true, queryAndSourceEgress: true, dialogueEgress: true, authorization: OWNER_REQUEST } };
}

/** True for a plan whose approval binds exactly its content, given by its only user on a direct request or a renewal. */
export function approvedChatPlan(plan) {
  if (!plan || typeof plan !== 'object' || !plan.approval) return false;
  const { approval, ...unsigned } = plan;
  return approval.planHash === digest(unsigned) && Array.isArray(plan.users) && plan.users.length === 1 && approval.approvedBy === plan.users[0]
    && DIRECT.includes(approval.authorization) && approval.queryAndSourceEgress === true && approval.dialogueEgress === true
    && Number.isFinite(Date.parse(approval.approvedAt));
}

/** The approved plan for this release's code: the same plan in everything the owner approved (users, account,
 *  model, endpoints, prices, budget, egress, corpus generation and documents), with the code's own fields, a new id
 *  and an approval carried forward under the owner's renewal rule. */
export async function renewChatPlan(previous, { release, now = new Date() }) {
  if (!approvedChatPlan(previous) || previous.mode !== 'real' || previous.questionPolicy?.mode !== 'bounded_dynamic') reject('renewal_requires_approved_plan');
  if (!/^[a-f0-9]{7,40}$/.test(release || '')) reject('renewal_release_required');
  const { approval, ...kept } = previous;
  const unsigned = { ...kept, id: planId(previous.tenant, now, release), ...await codeContract(),
    authorizationBasis: { date: now.toISOString().slice(0, 10), ownerInstruction: previous.authorizationBasis?.ownerInstruction ?? null,
      renewal: { from: previous.id, fromPlanHash: approval.planHash, release, rule: RENEWAL_RULE } } };
  return { ...unsigned, approval: { approvedBy: approval.approvedBy, approvedAt: now.toISOString(), planHash: digest(unsigned),
    dynamicQuestions: approval.dynamicQuestions, queryAndSourceEgress: approval.queryAndSourceEgress, dialogueEgress: approval.dialogueEgress,
    authorization: RELEASE_RENEWAL, renewedFrom: { id: previous.id, planHash: approval.planHash } } };
}
/** The fields a renewal must not change, for tests and the release check. */
export function approvedScope(plan) {
  const { approval: _approval, id: _id, authorizationBasis: _basis, implementationHash: _hash, dialogueVersion: _d, promptVersion: _p,
    questionVersion: _q, dialogueStateVersion: _s, dialogueStateSchemaHash: _sh, retrievalRouting: _r, recordCatalogue: _c, searchAssist: _a, ...scope } = plan;
  return stable(scope);
}

/** The chat's own pre-turn checks without a model call: the active generation, profile, versions and directories. */
export async function preflightChatPlan(plan, adapters = runtimeAdapters) {
  const config = { ...plan, profile: retrievalProfile(plan.profileId), configHash: digest(plan) };
  await adapters(async () => config, plan.users[0]).preflight(config);
}

/** Points the chat at `file` in rag.env, keeping a copy of the previous file; returns the copy's path. */
export async function activateChatPlan({ ragEnv, file, plan }) {
  const env = await fs.readFile(ragEnv, 'utf8'), backup = `${ragEnv}.before-${plan.id}`;
  await fs.writeFile(backup, env, { flag: 'wx', mode: 0o600 });
  const lines = env.split('\n').filter(line => !/^(M4_PILOT_CONFIG|M4_PILOT_ENABLED|RAG_V2_ESTNLTK_IDLE_MS)=/.test(line));
  const next = [...lines.filter((line, i) => line || i < lines.length - 1), 'M4_PILOT_ENABLED=1', `M4_PILOT_CONFIG=${file}`, 'RAG_V2_ESTNLTK_IDLE_MS=3600000', ''].join('\n');
  await fs.writeFile(ragEnv, next, { mode: 0o600 });
  return backup;
}
