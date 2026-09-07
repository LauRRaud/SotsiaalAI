import fs from 'node:fs/promises';
import { digest, reject, PROMPT_VERSION, READABLE_PROMPT_VERSIONS, QUESTION_VERSION, ANSWER_VERSION, ANSWER_SCHEMA } from './contracts.js';
import { implementationManifest } from './provenance.js';
import { embeddingConfig } from '../search/embedding.js';
import { retrievalProfile } from '../search/profiles.js';
import { ANSWER_ENDPOINT, EMBEDDING_ENDPOINT } from './provider.js';
import { evidenceDraftEnabled, evidenceDraftContract, EVIDENCE_DRAFT_VERSION,
  EVIDENCE_DRAFT_PROMPT,
  HISTORICAL_EVIDENCE_DRAFT_V1_SCHEMA_HASH, HISTORICAL_EVIDENCE_DRAFT_V1_ANSWER_SCHEMA_HASH } from './evidence-draft.js';
import { dialogueEnabled, DIALOGUE_PROMPT_VERSION, READABLE_DIALOGUE_PROMPT_VERSIONS, DIALOGUE_SEARCH_VERSION } from './dialogue.js';

export async function readPilotConfig(userId, { purpose = 'execute' } = {}) {
  if (!['read', 'execute'].includes(purpose)) reject('invalid_config_purpose');
  if (process.env.M4_PILOT_ENABLED !== '1' || !process.env.M4_PILOT_CONFIG) reject('pilot_disabled', 404);
  let config; try { config = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8')); } catch { reject('not_configured', 503); }
  if (!Array.isArray(config.users) || !config.users.includes(userId)) reject('pilot_access_denied', 403);
  if (!['test', 'real'].includes(config.mode) || !config.id || !config.tenant || config.usage !== 'development_only'
    || config.expiresAt !== null && (!Number.isFinite(Date.parse(config.expiresAt)) || Date.parse(config.expiresAt) <= Date.now())
    || config.retentionHours !== null && (!Number.isInteger(config.retentionHours) || config.retentionHours < 1 || config.retentionHours > 168)
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 60000
    || !config.documents || !Object.keys(config.documents).length) reject('not_configured', 503);
  for (const field of ['attempts', 'tokens', 'nanoUsd']) if (!Number.isSafeInteger(config.budget?.[field]) || config.budget[field] < 0) reject('not_configured', 503);
  const profile = retrievalProfile(config.profileId);
  const embedding = embeddingConfig(config.embedding);
  const candidate = evidenceDraftEnabled(config);
  const evidenceContract = candidate ? evidenceDraftContract(config) : null;
  const continuing = dialogueEnabled(config);
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
    for (const stage of ['embeddingAttempts', 'answerAttempts']) {
      if (!Number.isSafeInteger(config.budget[stage]) || config.budget[stage] < (stage === 'embeddingAttempts' ? 0 : 1) || config.budget[stage] > 8) reject('stage_budget_not_configured', 503);
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
      || config.model !== 'gpt-5.6-luna' || purpose === 'execute' && (config.model !== process.env.OPENAI_MODEL || !process.env.OPENAI_API_KEY)
      || !['low', 'medium', 'high'].includes(config.reasoning) || !Number.isInteger(config.maxOutputTokens) || config.maxOutputTokens < 256
      || config.maxOutputTokens > 4096 || !Number.isInteger(config.maxInputTokens) || config.maxInputTokens < 1 || config.maxInputTokens > 128000
      || !/^proj_[A-Za-z0-9_-]+$/.test(config.accountProject || '') || !config.generationId || config.modelContract !== 'responses-strict-reasoning-v1') reject('not_configured', 503);
    const expectedPrompt = continuing ? DIALOGUE_PROMPT_VERSION : PROMPT_VERSION;
    const expectedQuestion = continuing ? DIALOGUE_SEARCH_VERSION : QUESTION_VERSION;
    if (purpose === 'execute' && (config.promptVersion !== expectedPrompt || config.questionVersion !== expectedQuestion
      || config.implementationHash !== (await implementationManifest()).hash)) reject('implementation_approval_mismatch', 403);
    // Reading an unchanged, still-authorized historical plan cannot authorize new egress.
    if (purpose === 'read' && (!(continuing ? READABLE_DIALOGUE_PROMPT_VERSIONS : READABLE_PROMPT_VERSIONS).includes(config.promptVersion)
      || config.questionVersion !== expectedQuestion || !config.implementationHash)) reject('unsupported_historical_contract', 403);
    if (!['embeddingInput', 'answerInput', 'answerOutput'].every(k => Number.isSafeInteger(config.prices?.[k]) && config.prices[k] > 0)) reject('price_not_configured', 503);
    const { approval, ...plan } = config;
    const locked = config.questionPolicy?.mode === 'locked' && Array.isArray(config.questionPolicy.inputs) && config.questionPolicy.inputs.length > 0
      && config.questionPolicy.inputs.every(x => typeof x.question === 'string'
        && (continuing ? ['new', 'same', 'correction', 'new_person'].includes(x.contextMode) : x.contextMode === 'new') && ['et', 'en', 'ru'].includes(x.language));
    const dynamic = config.questionPolicy?.mode === 'bounded_dynamic' && approval?.dynamicQuestions === true;
    if (!approval?.approvedBy || approval.planHash !== digest(plan) || (!locked && !dynamic) || !approval.queryAndSourceEgress || continuing && approval.dialogueEgress !== true
      || !Number.isFinite(Date.parse(approval.approvedAt)) || Date.parse(approval.approvedAt) > Date.now()) reject('pilot_approval_required', 403);
  } else if (embedding.embedding_mode !== 'mock' || process.env.NODE_ENV === 'production') reject('test_mode_development_only', 503);
  return { ...config, profile, embedding, configHash: digest(config) };
}
