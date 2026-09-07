import path from 'node:path';
import { hash, stable } from '../contracts.js';
import { readJson } from '../catalog.js';
import { knowledgePreparationDraft, KNOWLEDGE_PREPARATION_VERSION } from '../knowledge-preparation.js';
import { nanoUsd, formatUsd } from '../search/pilot-manifest.js';
import { providerCall } from '../pilot/provider.js';

const SCHEMA = 'rag-v2/knowledge-budget-1';
const error = (code, status = 409) => Object.assign(new Error(code), { code, status });
const safeCode = cause => /^[a-z][a-z0-9_]{1,80}$/.test(cause?.code || '') ? cause.code : 'knowledge_preparation_failed';
const empty = fingerprint => ({ schema_version: SCHEMA, config_fingerprint: fingerprint, entries: {} });
const entryStates = new Set(['sent_unknown', 'response_received', 'draft_ready', 'failed']);

export function knowledgeBudget(value, fingerprint, config) {
  if (value?.schema_version !== SCHEMA || value.config_fingerprint !== fingerprint || !value.entries
    || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw error('knowledge_budget_corrupt', 503);
  let reserved = 0n, tokens = 0;
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !/^[a-f0-9]{64}$/.test(entry?.plan_hash || '') || !entryStates.has(entry.state)
      || typeof entry.actor_id !== 'string' || !/^job_[a-f0-9]{64}$/.test(entry.job_id || '')
      || key !== hash(stable({ job_id: entry.job_id, actor_id: entry.actor_id, plan_hash: entry.plan_hash }))
      || !Number.isSafeInteger(entry.input_tokens) || entry.input_tokens < 1
      || entry.output_tokens !== config.maxOutputTokens || !/^(0|[1-9]\d*)$/.test(entry.reserved_nano_usd || '')
      || BigInt(entry.reserved_nano_usd) !== BigInt(entry.input_tokens) * BigInt(config.prices.input) + BigInt(entry.output_tokens) * BigInt(config.prices.output)) {
      throw error('knowledge_budget_corrupt', 503);
    }
    reserved += BigInt(entry.reserved_nano_usd); tokens += entry.input_tokens;
  }
  const attempts = Object.keys(value.entries).length;
  if (!Number.isSafeInteger(tokens) || attempts > config.maxApiAttempts || tokens > config.maxInputTokens || reserved > nanoUsd(config.maxSpendUsd)) {
    throw error('knowledge_budget_corrupt', 503);
  }
  return { value, reserved, tokens, attempts };
}

/** Runs under the existing intake writer lock. Reservations survive errors and restarts. */
export class KnowledgeJobs {
  constructor({ root, fingerprint, config, writeJson, assertAccess, call = providerCall, apiKey = process.env.OPENAI_API_KEY }) {
    Object.assign(this, { root, fingerprint, config, writeJson, assertAccess, call, apiKey });
    this.file = path.join(root, 'knowledge-budget.json');
  }
  async budget() {
    let value;
    try { value = await readJson(this.file); }
    catch (cause) { if (cause.code !== 'ENOENT') throw cause; value = empty(this.fingerprint); }
    return knowledgeBudget(value, this.fingerprint, this.config);
  }
  async status() {
    const { reserved, attempts, tokens } = await this.budget();
    return { enabled: true, model: this.config.model, cap_usd: this.config.maxSpendUsd, reserved_usd: formatUsd(reserved),
      reserved_attempts: attempts, reserved_input_tokens: tokens };
  }
  identity(receipt, plan) {
    return hash(stable({ job_id: receipt.job_id, actor_id: receipt.actor_id, plan_hash: plan.hash }));
  }
  async response(receipt, plan, entry) {
    const file = path.join(this.root, 'jobs', receipt.job_id, 'knowledge-response.json');
    let response;
    try { response = await readJson(file); }
    catch (cause) { if (cause.code === 'ENOENT') return null; throw cause; }
    if (response.schema_version !== KNOWLEDGE_PREPARATION_VERSION || response.plan_hash !== plan.hash
      || response.actor_id !== receipt.actor_id || response.config_fingerprint !== this.fingerprint
      || entry.response_hash && entry.response_hash !== hash(stable(response))) throw error('knowledge_response_integrity_failed', 503);
    if (!response.error) this.checkUsage(response.usage, entry);
    return response;
  }
  checkUsage(usage, entry) {
    if (!Number.isSafeInteger(usage?.input) || usage.input < 0 || !Number.isSafeInteger(usage?.output) || usage.output < 0
      || usage.input > entry.input_tokens || usage.output > entry.output_tokens) throw error('knowledge_preparation_usage_invalid', 502);
  }
  async read(receipt, plan, bundle) {
    const { value } = await this.budget(), entry = value.entries[this.identity(receipt, plan)];
    if (!entry) return { state: 'not_started' };
    if (entry.state === 'failed') return { state: 'failed', error: entry.error };
    const response = await this.response(receipt, plan, entry);
    if (!response) return { state: 'sent_unknown', error: 'knowledge_preparation_outcome_unknown' };
    if (response.error) return { state: 'failed', error: response.error };
    const draft = knowledgePreparationDraft(response.value, plan, bundle);
    return { state: 'draft_ready', draft, usage: response.usage, timings: response.timings,
      reserved_usd: formatUsd(BigInt(entry.reserved_nano_usd)) };
  }
  async run(receipt, plan, bundle) {
    await this.assertAccess();
    const budget = await this.budget(), key = this.identity(receipt, plan);
    let entry = budget.value.entries[key], response;
    if (entry) {
      response = await this.response(receipt, plan, entry);
      if (!response) throw error(entry.error || 'knowledge_preparation_outcome_unknown');
      if (response.error) throw error(response.error);
    } else {
      if (!this.apiKey) throw error('knowledge_preparation_not_configured', 503);
      const reserve = BigInt(plan.manifest.reserved_nano_usd);
      if (budget.attempts + 1 > this.config.maxApiAttempts || budget.tokens + plan.manifest.input_tokens_reserved > this.config.maxInputTokens
        || budget.reserved + reserve > nanoUsd(this.config.maxSpendUsd)) throw error('knowledge_preparation_aggregate_cap');
      entry = { job_id: receipt.job_id, actor_id: receipt.actor_id, plan_hash: plan.hash, state: 'sent_unknown',
        input_tokens: plan.manifest.input_tokens_reserved, output_tokens: plan.manifest.output_tokens_reserved,
        reserved_nano_usd: plan.manifest.reserved_nano_usd, approved_at: new Date().toISOString(),
        approval_basis: 'Authenticated administrator requested this frozen source preparation within the configured model and aggregate cap.' };
      budget.value.entries[key] = entry;
      await this.writeJson(this.file, budget.value);
      // The durable uncertain state precedes egress. A repeated click cannot send again.
      await this.assertAccess();
      let result;
      try {
        result = await this.call({ stage: 'answer', body: plan.body, config: { ...this.config, mode: 'real' }, apiKey: this.apiKey });
        response = { value: result.value, usage: result.usage, request_id: result.requestId, timings: result.timings };
      } catch (cause) {
        response = { error: safeCode(cause), usage: cause.usage || null, request_id: cause.requestId || null, timings: cause.timings || null };
      }
      response = { schema_version: KNOWLEDGE_PREPARATION_VERSION, plan_hash: plan.hash, actor_id: receipt.actor_id,
        config_fingerprint: this.fingerprint, ...response };
      await this.writeJson(path.join(this.root, 'jobs', receipt.job_id, 'knowledge-response.json'), response);
      entry.response_hash = hash(stable(response));
      entry.state = response.error ? 'failed' : 'response_received';
      if (response.error) entry.error = response.error;
      await this.writeJson(this.file, budget.value);
      if (response.error) throw error(response.error, 502);
    }
    await this.assertAccess();
    this.checkUsage(response.usage, entry);
    try { knowledgePreparationDraft(response.value, plan, bundle); }
    catch (cause) {
      entry.state = 'failed'; entry.error = safeCode(cause);
      await this.writeJson(this.file, budget.value);
      throw cause;
    }
    entry.state = 'draft_ready';
    await this.writeJson(this.file, budget.value);
    return this.read(receipt, plan, bundle);
  }
}
