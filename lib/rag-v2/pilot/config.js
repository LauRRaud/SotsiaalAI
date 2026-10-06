import fs from 'node:fs/promises';
import { digest, reject, PROMPT_VERSION, READABLE_PROMPT_VERSIONS, QUESTION_VERSION, ANSWER_VERSION, ANSWER_SCHEMA } from './contracts.js';
import { implementationManifest } from './provenance.js';
import { embeddingConfig } from '../search/embedding.js';
import { retrievalProfile } from '../search/profiles.js';
import { ANSWER_ENDPOINT, EMBEDDING_ENDPOINT } from './provider.js';
import { evidenceDraftEnabled, evidenceDraftContract, EVIDENCE_DRAFT_VERSION,
  EVIDENCE_DRAFT_PROMPT,
  HISTORICAL_EVIDENCE_DRAFT_V1_SCHEMA_HASH, HISTORICAL_EVIDENCE_DRAFT_V1_ANSWER_SCHEMA_HASH } from './evidence-draft.js';
import { dialogueEnabled, DIALOGUE_PROMPT_VERSION, READABLE_DIALOGUE_PROMPT_VERSIONS, DIALOGUE_SEARCH_VERSION, READABLE_DIALOGUE_SEARCH_VERSIONS } from './dialogue.js';
import { RECORD_RETRIEVAL_VERSION, READABLE_RECORD_RETRIEVAL_VERSIONS } from '../search/structured-record-source.js';
import { dialogueStateContract, REGION_STATE_VERSION, TYPED_STATE_VERSIONS } from './dialogue-state.js';
import { unifiedRetrievalEnabled } from './retrieval-plan.js';
import { searchAssistEnabled } from './search-assist.js';

// The approved plan (about 1 MB with every document version) is parsed and hashed once per file
// version: every turn and every restored turn reads it several times (acceptance test 27.09.2026).
let planCache = null, manifestCache = null;
async function planFile(file) {
  let stat; try { stat = await fs.stat(file); } catch { reject('not_configured', 503); }
  const key = `${file}\0${stat.mtimeMs}\0${stat.size}\0${stat.ino}`;
  if (planCache?.key !== key) {
    let parsed; try { parsed = JSON.parse(await fs.readFile(file, 'utf8')); } catch { reject('not_configured', 503); }
    const { approval: _approval, ...plan } = parsed;
    planCache = { key, config: deepFreeze(parsed), hash: digest(parsed), planHash: digest(plan) };
  }
  return planCache;
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) deepFreeze(v); }
  return value;
}
// The running code only changes with a restart; its manifest is recomputed at most once a minute.
async function currentImplementationHash() {
  if (!manifestCache || Date.now() - manifestCache.at > 60000) manifestCache = { at: Date.now(), hash: (await implementationManifest()).hash };
  return manifestCache.hash;
}
// ADR-092: a plan may offer the user a choice of the answer's reasoning effort beside its own (`reasoning`, the default).
// The efforts in their order; the chat's menu item switches between the lowest and the highest one offered.
export const REASONING_EFFORTS = Object.freeze(['low', 'medium', 'high']);
export const validReasoningChoices = config => Array.isArray(config.reasoningChoices) && config.reasoningChoices.length >= 2
  && config.reasoningChoices.every(effort => REASONING_EFFORTS.includes(effort)) && new Set(config.reasoningChoices).size === config.reasoningChoices.length
  && config.reasoningChoices.includes(config.reasoning);
/** What a chat may offer and what it asks for when the user chose nothing: null for a plan without a choice. */
export function reasoningOffer(config) {
  if (!config?.reasoningChoices) return null;
  const offered = REASONING_EFFORTS.filter(effort => config.reasoningChoices.includes(effort));
  return { quick: offered[0], thorough: offered.at(-1), fallback: config.reasoning };
}
export async function readPilotConfig(userId, { purpose = 'execute' } = {}) {
  if (!['read', 'execute'].includes(purpose)) reject('invalid_config_purpose');
  if (process.env.M4_PILOT_ENABLED !== '1' || !process.env.M4_PILOT_CONFIG) reject('pilot_disabled', 404);
  const loaded = await planFile(process.env.M4_PILOT_CONFIG), config = loaded.config;
  if (!Array.isArray(config.users) || !config.users.includes(userId)) reject('pilot_access_denied', 403);
  if (!['test', 'real'].includes(config.mode) || !config.id || !config.tenant || config.usage !== 'development_only'
    || config.expiresAt !== null && (!Number.isFinite(Date.parse(config.expiresAt)) || Date.parse(config.expiresAt) <= Date.now())
    || config.retentionHours !== null && (!Number.isInteger(config.retentionHours) || config.retentionHours < 1 || config.retentionHours > 168)
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 60000
    || !config.documents || !Object.keys(config.documents).length) reject('not_configured', 503);
  for (const field of ['attempts', 'tokens', 'nanoUsd']) if (!Number.isSafeInteger(config.budget?.[field]) || config.budget[field] < 0) reject('not_configured', 503);
  if (config.reasoningChoices !== undefined && !validReasoningChoices(config)) reject('not_configured', 503);
  // A renewal names the ledger of the plan the owner approved (ADR-037); a plan never names itself.
  if (config.budgetLedger !== undefined && (typeof config.budgetLedger !== 'string' || !/^m4-[a-z0-9-]+$/.test(config.budgetLedger)
    || config.budgetLedger === config.id)) reject('not_configured', 503);
  const profile = retrievalProfile(config.profileId);
  const embedding = embeddingConfig(config.embedding);
  const candidate = evidenceDraftEnabled(config);
  const evidenceContract = candidate ? evidenceDraftContract(config) : null;
  const continuing = dialogueEnabled(config);
  const stateContract = dialogueStateContract(config);
  if (stateContract && (!continuing || config.dialogueStateSchemaHash !== digest(stateContract.schema))) reject('invalid_dialogue_state_plan', 403);
  // An unchanged historical catalogue plan can still restore its turns; only the current one executes.
  const catalogues = purpose === 'read' ? READABLE_RECORD_RETRIEVAL_VERSIONS : [RECORD_RETRIEVAL_VERSION];
  // A historical unified plan (typed state v2 or v3) can still restore its turns; only v4 executes (ADR-049, ADR-051).
  if (unifiedRetrievalEnabled(config) && (!(purpose === 'read' ? TYPED_STATE_VERSIONS : [REGION_STATE_VERSION]).includes(stateContract?.version)
    || !catalogues.includes(config.recordCatalogue) || config.mode !== 'real'
    || config.budget.embeddingAttempts < 1)) reject('invalid_unified_retrieval_plan', 403);
  if (config.recordCatalogue !== undefined && (!catalogues.includes(config.recordCatalogue) || !continuing)) reject('invalid_record_catalogue_plan', 403);
  if (searchAssistEnabled(config) && !unifiedRetrievalEnabled(config)) reject('invalid_search_assist_plan', 403);
  if (continuing && (candidate || config.fixedPacketFile !== undefined || config.queryReuse)) reject('incompatible_dialogue_plan', 403);
  if (config.fixedPacketFile !== undefined && (typeof config.fixedPacketFile !== 'string' || !/^[a-f0-9]{64}$/.test(config.fixedPacketHash || '')
    || config.questionPolicy?.mode !== 'locked' || config.budget.embeddingAttempts !== 0)) reject('invalid_fixed_packet_plan', 403);
  if (config.mode === 'real') {
    if (candidate) {
      const currentSchemaHash = digest(evidenceContract.schema), currentPrompt = evidenceContract.promptVersion;
      const current = config.evidenceDraftSchemaHash === currentSchemaHash && config.evidenceDraftPromptVersion === currentPrompt
        && (config.answerVersion === undefined || config.answerVersion === ANSWER_VERSION)
        && (config.answerSchemaHash === undefined || config.answerSchemaHash === digest(ANSWER_SCHEMA));
      const historicalV1 = evidenceContract.version === EVIDENCE_DRAFT_VERSION && config.evidenceDraftSchemaHash === HISTORICAL_EVIDENCE_DRAFT_V1_SCHEMA_HASH
        && config.evidenceDraftPromptVersion === EVIDENCE_DRAFT_PROMPT && config.promptVersion === 'm4-grounded-answer-3'
        && config.answerVersion === 'm4-text-refs-3' && config.answerSchemaHash === HISTORICAL_EVIDENCE_DRAFT_V1_ANSWER_SCHEMA_HASH;
      if (purpose === 'execute' ? !current : !current && !historicalV1) reject('evidence_draft_approval_mismatch', 403);
    }
    // A fixed-question run keeps a handful of attempts. An open development chat (dynamic questions)
    // is bounded by its money and token caps, so its attempt caps only stop a runaway loop.
    const stageLimit = config.questionPolicy?.mode === 'bounded_dynamic' ? 5000 : 8;
    for (const stage of ['embeddingAttempts', 'answerAttempts']) {
      if (!Number.isSafeInteger(config.budget[stage]) || config.budget[stage] < (stage === 'embeddingAttempts' ? 0 : 1) || config.budget[stage] > stageLimit) reject('stage_budget_not_configured', 503);
    }
    if (config.queryReuse) {
      const reuse = config.queryReuse;
      if (typeof reuse.pilotId !== 'string' || reuse.pilotId === config.id || !/^[a-f0-9]{64}$/.test(reuse.configHash || '')
        || reuse.expiresAt !== null && (!Number.isFinite(Date.parse(reuse.expiresAt)) || Date.parse(reuse.expiresAt) <= Date.now())
        || !Array.isArray(reuse.entries) || !reuse.entries.length || reuse.entries.length > 8
        || new Set(reuse.entries.map(e => e.queryHash)).size !== reuse.entries.length
        || reuse.entries.some(e => typeof e.turnId !== 'string' || !['queryHash', 'vectorHash', 'embeddingBodyHash'].every(k => /^[a-f0-9]{64}$/.test(e[k] || '')))) reject('invalid_query_reuse_plan', 403);
    }
    if (embedding.embedding_mode !== 'real' || config.endpoint !== ANSWER_ENDPOINT || config.embedding.endpoint !== EMBEDDING_ENDPOINT
      // Old model-bound plans remain readable, but cannot generate new answers.
      || !(purpose === 'read' ? ['gpt-6-luna', 'gpt-5.6-luna'] : ['gpt-6-luna']).includes(config.model)
      || purpose === 'execute' && (config.model !== process.env.OPENAI_MODEL || !process.env.OPENAI_API_KEY)
      || !['low', 'medium', 'high'].includes(config.reasoning) || !Number.isInteger(config.maxOutputTokens) || config.maxOutputTokens < 256
      || config.maxOutputTokens > 16384 || !Number.isInteger(config.maxInputTokens) || config.maxInputTokens < 1 || config.maxInputTokens > 400000
      || !/^proj_[A-Za-z0-9_-]+$/.test(config.accountProject || '') || !config.generationId || config.modelContract !== 'responses-strict-reasoning-v1') reject('not_configured', 503);
    const expectedPrompt = continuing ? DIALOGUE_PROMPT_VERSION : PROMPT_VERSION;
    const expectedQuestion = continuing ? DIALOGUE_SEARCH_VERSION : QUESTION_VERSION;
    if (purpose === 'execute' && (config.promptVersion !== expectedPrompt || config.questionVersion !== expectedQuestion
      || config.implementationHash !== await currentImplementationHash())) reject('implementation_approval_mismatch', 403);
    // Reading an unchanged, still-authorized historical plan cannot authorize new egress.
    if (purpose === 'read' && (!(continuing ? READABLE_DIALOGUE_PROMPT_VERSIONS : READABLE_PROMPT_VERSIONS).includes(config.promptVersion)
      || !(continuing ? READABLE_DIALOGUE_SEARCH_VERSIONS : [QUESTION_VERSION]).includes(config.questionVersion)
      || !config.implementationHash)) reject('unsupported_historical_contract', 403);
    if (!['embeddingInput', 'answerInput', 'answerOutput'].every(k => Number.isSafeInteger(config.prices?.[k]) && config.prices[k] > 0)) reject('price_not_configured', 503);
    const { approval } = config;
    const locked = config.questionPolicy?.mode === 'locked' && Array.isArray(config.questionPolicy.inputs) && config.questionPolicy.inputs.length > 0
      && config.questionPolicy.inputs.every(x => typeof x.question === 'string'
        && (continuing ? ['new', 'same', 'correction', 'new_person'].includes(x.contextMode) : x.contextMode === 'new') && ['et', 'en', 'ru'].includes(x.language));
    const dynamic = config.questionPolicy?.mode === 'bounded_dynamic' && approval?.dynamicQuestions === true;
    if (!approval?.approvedBy || approval.planHash !== loaded.planHash || (!locked && !dynamic) || !approval.queryAndSourceEgress || continuing && approval.dialogueEgress !== true
      || !Number.isFinite(Date.parse(approval.approvedAt)) || Date.parse(approval.approvedAt) > Date.now()) reject('pilot_approval_required', 403);
  } else if (embedding.embedding_mode !== 'mock' || process.env.NODE_ENV === 'production') reject('test_mode_development_only', 503);
  return { ...config, profile, embedding, configHash: loaded.hash };
}
