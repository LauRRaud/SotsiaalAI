import { buildQuestion, exact, reject, digest, answerRequest, validateAnswer, responseAudit, PROMPT_VERSION, ANSWER_VERSION } from './contracts.js';
import { checkedTokens, MockEmbedding, validateVector } from '../search/embedding.js';
import { providerCall } from './provider.js';
import { testAnswer } from './test-transport.js';
import { pilotExpired } from './lifetime.js';
import { fixedPacket } from './fixed-packet.js';
import { evidenceDraftEnabled, evidenceDraftContract, evidenceDraftRequest, projectEvidenceDraft } from './evidence-draft.js';
import { dialogueEnabled, validateDialogueInput, buildDialogueQuery, publishedDialogue, dialogueInput, dialogueRequest, publicContext, DIALOGUE_PROMPT_VERSION } from './dialogue.js';
import { locationFields } from '../source-locations.js';
import { dialogueStateEnabled, previousStateFor, projectDialogueAnswer, validateStateContext, validateStateRegion, SOFT_STATE_FAILURES, carriedDialogueAnswer } from './dialogue-state.js';
import { searchAssistEnabled, queryPlanRequest, rerankRequest, validateQueryPlan, validateRerank, SEARCH_ASSIST_VERSION } from './search-assist.js';

// Search-assist calls that fail at the provider leave the turn on the plain fused search; access,
// scope and budget refusals still stop the turn.
const ASSIST_SOFT_FAILURES = new Set(['provider_http_error', 'provider_empty_body', 'provider_body_too_large', 'provider_invalid_json',
  'provider_usage_unknown', 'provider_incomplete', 'provider_refusal_or_invalid_output', 'answer_model_mismatch', 'invalid_query_plan',
  'invalid_rerank_selection', 'TimeoutError', 'AbortError']);
const softAssistFailure = error => ASSIST_SOFT_FAILURES.has(error?.code) || ASSIST_SOFT_FAILURES.has(error?.name);

// What a reader needs to check a source: title plus the stored bibliographic fields that exist
// (ADR-020 adds year, journal, issue and printed page range to journal evidence).
function sourceCitation(bibliography = {}) {
  const citation = { authors: Array.isArray(bibliography.authors) && bibliography.authors.length ? bibliography.authors : null,
    year: bibliography.publication_year ?? null, journal: bibliography.journal_title ?? null, issue: bibliography.issue_label ?? null,
    pageRange: bibliography.page_range ?? null };
  return { title: bibliography.title, ...Object.fromEntries(Object.entries(citation).filter(([, value]) => value !== null && value !== '')) };
}

export class PilotService {
  constructor({ store, readConfig, adapters, call = providerCall }) { Object.assign(this, { store, readConfig, adapters, call }); }
  async checkReferences(config, packet) {
    if (this.adapters.canonicalPacket) return this.adapters.canonicalPacket(config, packet);
    for (const ref of Object.keys(packet.reference_map)) await this.adapters.canonical(config, packet, ref);
  }
  async access(row, execute = false) {
    const config = await this.readConfig({ purpose: execute ? 'execute' : 'read' });
    if (row && (row.configHash !== config.configHash || pilotExpired(row.expiresAt))) reject('pilot_scope_changed', 403);
    return config;
  }
  async restore(row) {
    const config = await this.access(row);
    await this.store.mutate(config, row, async () => null);
    if (row.state !== 'completed') return { id: row.id, state: row.state, mode: config.mode, question: row.payload.question, context: publicContext(row),
      language: row.payload.query?.language || row.payload.inputLanguage || 'et', recoverable: row.state === 'needs_recovery',
      failureKind: row.state === 'answer_rejected' || row.state === 'stopped'
        ? row.payload.error?.startsWith('context_') ? 'context' : row.payload.error === 'invalid_answer_reference' ? 'references' : 'validation' : null };
    await this.checkReferences(config, row.payload.packet);
    await this.checkEvidenceDraft(config, row);
    this.checkDialogueState(config, row);
    await this.access(row);
    const answerVersion = row.payload.answerVersion || row.payload.evidenceDraftAudit?.answerVersion || 'm4-text-refs-1';
    return { id: row.id, state: 'completed', mode: config.mode, question: row.payload.question, answer: validateAnswer(row.payload.answer, Object.keys(row.payload.packet.reference_map), answerVersion),
      answerVersion, language: row.payload.query.language, context: publicContext(row),
      messageId: row.payload.messageId, sources: Object.entries(row.payload.packet.reference_map).map(([ref, value]) => ({ ref,
        ...sourceCitation(row.payload.packet.evidence.find(e => e.evidence_id === value.evidence_id)?.bibliography),
        pages: value.pdf_pages, ...locationFields(value), version: value.document_version_id, used: row.payload.answer.blocks.some(b => b.refs.includes(ref)) })),
      measurements: { queryTokens: row.payload.query.tokens, events: row.payload.events.map(e => ({ stage: e.stage, state: e.state, reservation: e.reservation, usage: e.usage, estimatedNanoUsd: e.estimatedNanoUsd, timings: e.timings })), timings: row.payload.timings } };
  }
  // One ledgered model call of the search assist ('plan' or 'rerank'): reserve, send, record usage.
  async assistCall(config, row, stage, body, testValue) {
    const inputBound = Buffer.byteLength(JSON.stringify(body), 'utf8') + 1024, outputBound = body.max_output_tokens;
    row = await this.store.reserve(config, row, stage, { tokens: inputBound + outputBound,
      nanoUsd: config.mode === 'real' ? inputBound * config.prices.answerInput + outputBound * config.prices.answerOutput : 0 },
    { bodyHash: digest(body), inputBound, maxOutputTokens: outputBound });
    config = await this.access(row, true);
    row = await this.store.sent(config, row, stage);
    let result;
    try {
      result = config.mode === 'test' ? { value: testValue, usage: { input: inputBound, output: 0 }, requestId: `test-${stage}` }
        : await this.call({ stage, body, config, apiKey: process.env.OPENAI_API_KEY });
    } catch (error) {
      if (error.usage) row = await this.store.usage(config, row, stage, error).catch(() => row);
      throw Object.assign(error, { row });
    }
    row = await this.store.usage(config, row, stage, result);
    return { row, value: result.value };
  }
  async run(userId, input) {
    exact(input, ['convId', 'clientTurnKey', 'question', 'contextMode', 'language', 'contextTurnId', 'replyToTurnId', 'replyToBlock']);
    if (input.language !== undefined && !['et', 'en', 'ru'].includes(input.language)) reject('invalid_language');
    if (![input.convId, input.clientTurnKey].every(x => typeof x === 'string' && /^[\w-]{8,100}$/.test(x))) reject('invalid_turn_identity');
    buildQuestion({ question: input.question, contextMode: input.contextMode });
    let config = await this.access();
    const continuing = dialogueEnabled(config);
    if (continuing) validateDialogueInput(input);
    else if (['contextTurnId', 'replyToTurnId', 'replyToBlock'].some(key => input[key] !== undefined)) reject('dialogue_not_enabled');
    await this.store.purge();
    const existing = await this.store.existing(config, userId, input);
    if (existing) return this.restore(existing);
    const initialConfigHash = config.configHash;
    config = await this.access(undefined, true);
    if (config.configHash !== initialConfigHash) reject('pilot_scope_changed', 403);
    if (config.mode === 'real' && config.questionPolicy?.mode === 'locked'
      && !config.questionPolicy.inputs.some(x => x.question === input.question && x.contextMode === input.contextMode && x.language === (input.language || 'et'))) reject('question_not_in_approved_plan', 403);
    const claimed = await this.store.claim(config, userId, input);
    if (!claimed.fresh) return this.restore(claimed.row);
    let row = claimed.row;
    const start = Date.now(), phases = {};
    // Milliseconds since the turn started, at each finished phase (latency audit of the chat).
    const reached = name => { phases[name] = Date.now() - start; };
    try {
      const stateEnabled = dialogueStateEnabled(config);
      let assistant = null, dialogue = null, previousState = null, stateContext = null;
      if (continuing) {
        const turnId = row.payload.contextAudit.selection.assistantTurnId;
        let source = null;
        if (turnId) {
          source = await this.store.dialogueSource(config, row, turnId);
          await this.access(source);
          await this.checkReferences(config, source.payload.packet);
          this.checkDialogueState(config, source);
          assistant = publishedDialogue(source);
        }
        if (stateEnabled) {
          const stateTurnId = row.payload.contextAudit.selection.stateTurnId;
          if (stateTurnId) {
            const latest = source?.id === stateTurnId ? source : await this.store.dialogueSource(config, row, stateTurnId);
            await this.access(latest);
            this.checkDialogueState(config, latest);
            previousState = previousStateFor(latest.payload.dialogueState, row.payload.contextAudit);
          }
          stateContext = validateStateContext({ ...(await this.adapters.dialogueStateContext?.(config) || { regions: [] }),
            asOfDateUTC: new Date().toISOString().slice(0, 10) });
        }
        dialogue = dialogueInput(row.payload.contextAudit, assistant, stateEnabled ? { previous: previousState, context: stateContext } : null);
      }
      const query = continuing ? buildDialogueQuery(row.payload.contextAudit, config, assistant, previousState)
        : buildQuestion({ question: input.question, contextMode: input.contextMode }, row.payload.previous);
      query.language = input.language || 'et';
      const embeddingTokens = checkedTokens(query.text, config.embedding);
      await this.adapters.preflight(config);
      row = await this.store.save(config, row, 'claimed', { query, ...(dialogue ? { dialogue: dialogue.value, dialogueTokens: dialogue.tokens } : {}),
        ...(stateEnabled ? { previousDialogueState: previousState, dialogueStateContext: stateContext } : {}) });
      const preparedPacket = await this.adapters.records?.(config, query) || await fixedPacket(config, query);
      let retrieved = preparedPacket;
      if (!preparedPacket) {
      // Search assist: the answer model first writes search queries in the vocabulary of official texts.
      const assisted = searchAssistEnabled(config), messages = (query.scopeTurns || [{ text: query.text }]).map(turn => turn.text);
      const assist = assisted ? { version: SEARCH_ASSIST_VERSION, queries: [], rerank: null, failures: [] } : null;
      if (assisted) {
        try {
          const planned = await this.assistCall(config, row, 'plan', queryPlanRequest(config, messages, query.language), { queries: [] });
          row = planned.row; assist.queries = validateQueryPlan(planned.value, query.text);
        } catch (error) {
          if (!softAssistFailure(error)) throw error;
          if (error.row) row = error.row;
          assist.failures.push({ stage: 'plan', code: error.code || error.name });
        }
        config = await this.access(row);
      }
      if (assisted) reached('planned');
      let vector = await this.store.cache(config, userId, query.hash, query.cacheKey);
      if (!vector && config.queryReuse) {
        const reused = await this.store.reuse(config, userId, query);
        if (reused) { vector = reused.vector; row = await this.store.save(config, row, 'claimed', { queryReuse: reused.receipt }); }
      }
      // The question (unless cached) and the planned queries are embedded in one request.
      const variants = assist?.queries || [], pending = [...(vector ? [] : [query.text]), ...variants];
      const variantVectors = new Map();
      if (pending.length) {
        config = await this.access(row);
        const batch = variants.length > 0;
        const body = { input: batch ? pending : query.text, model: config.embedding.model, dimensions: config.embedding.dimensions, encoding_format: 'float' };
        const tokens = batch ? pending.reduce((n, text) => n + checkedTokens(text, config.embedding), 0) : embeddingTokens;
        row = await this.store.reserve(config, row, 'embedding', { tokens, nanoUsd: config.mode === 'real' ? tokens * config.prices.embeddingInput : 0 },
          { inputHash: query.hash, bodyHash: digest(body), inputVersion: query.version, ...(batch ? { searchVariants: variants.length } : {}) });
        config = await this.access(row, true);
        row = await this.store.sent(config, row, 'embedding');
        const mock = config.mode === 'test' ? new MockEmbedding(config.embedding) : null;
        const result = mock ? { value: batch ? await Promise.all(pending.map(text => mock.embed(text))) : await mock.embed(query.text), usage: { input: tokens, output: 0 }, requestId: 'test-embedding' }
          : await this.call({ stage: 'embedding', body, config, apiKey: process.env.OPENAI_API_KEY });
        row = await this.store.usage(config, row, 'embedding', result);
        const values = batch ? result.value : [result.value];
        if (!Array.isArray(values) || values.length !== pending.length) reject('embedding_response_mismatch', 502);
        if (!vector) vector = values.shift();
        variants.forEach((text, i) => variantVectors.set(text, validateVector(values[i], config.embedding)));
      }
      validateVector(vector, config.embedding);
      reached('embedded');
      config = await this.access(row);
      row = await this.store.save(config, row, 'claimed', { vector });
      // Search assist, second call: the answer model keeps the fused candidates that carry the answer.
      const rerank = assisted ? async passages => {
        try {
          const selected = await this.assistCall(await this.access(row), row, 'rerank', rerankRequest(config, messages, passages),
            { useful: passages.slice(0, 3).map(passage => passage.id) });
          row = selected.row;
          const useful = validateRerank(selected.value, passages);
          assist.rerank = { candidates: passages.map(({ id, title }) => ({ id, title })), selected: useful };
          return useful;
        } catch (error) {
          if (!softAssistFailure(error)) throw error;
          if (error.row) row = error.row;
          assist.failures.push({ stage: 'rerank', code: error.code || error.name });
          return null;
        }
      } : null;
      retrieved = await this.adapters.search(config, query, vector, assisted ? { variants, vectors: variantVectors, rerank } : null);
      reached('searched');
      if (assisted) { config = await this.access(row); row = await this.store.save(config, row, 'claimed', { searchAssist: assist }); }
      }
      // Persist only the evidence actually sent plus its canonical reference bindings.
      const packet = { tenant: retrieved.tenant, query_id: retrieved.query_id, generation_id: retrieved.generation_id || config.generationId || null,
        model_context: retrieved.model_context, reference_map: retrieved.reference_map, evidence: retrieved.evidence,
        ...(retrieved.dependency_context ? { dependency_context: retrieved.dependency_context } : {}),
        ...(retrieved.retrieval_context ? { retrieval_context: retrieved.retrieval_context, retrieval_audit: retrieved.retrieval_audit } : {}),
        ...(retrieved.record_context ? { record_context: retrieved.record_context } : {}) };
      if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > 512000) reject('audit_packet_too_large');
      config = await this.access(row);
      await this.checkReferences(config, packet);
      const candidate = evidenceDraftEnabled(config);
      const evidenceContract = candidate ? evidenceDraftContract(config) : null;
      const body = candidate ? evidenceDraftRequest(config, query.text, packet.model_context, query.language)
        : continuing ? dialogueRequest(config, query.question, packet.model_context, query.language, dialogue.value)
          : answerRequest(config, query.text, packet.model_context, query.language);
      // UTF-8 bytes conservatively bound text tokenization including the full schema and prompt.
      // Extra protocol allowance is reserved; exact provider usage remains a separate measurement.
      const inputBound = Buffer.byteLength(JSON.stringify(body), 'utf8') + 1024;
      if (inputBound > config.maxInputTokens) reject('answer_input_budget_exceeded');
      // Durable content before reservation/send; no transaction spans the provider call.
      row = await this.store.save(config, row, 'claimed', { packet, answerVersion: ANSWER_VERSION,
        requestAudit: { body, bodyHash: digest(body), questionHash: query.hash, language: query.language,
          ...(candidate ? { evidenceDraftVersion: evidenceContract.version, evidenceDraftPromptVersion: evidenceContract.promptVersion } : {}),
          ...(stateEnabled ? { dialogueStateVersion: config.dialogueStateVersion } : {}),
          promptVersion: continuing ? DIALOGUE_PROMPT_VERSION : PROMPT_VERSION, answerVersion: ANSWER_VERSION, questionVersion: query.version,
          profile: config.profile, generationId: packet.generation_id, savedAt: new Date().toISOString() } });
      row = await this.store.reserve(config, row, 'answer', { tokens: inputBound + config.maxOutputTokens,
        nanoUsd: config.mode === 'real' ? inputBound * config.prices.answerInput + config.maxOutputTokens * config.prices.answerOutput : 0 },
      { bodyHash: digest(body), inputBound, maxOutputTokens: config.maxOutputTokens });
      config = await this.access(row, true);
      row = await this.store.sent(config, row, 'answer');
      const result = config.mode === 'test' ? await testAnswer(config, body, packet, inputBound)
        : await this.call({ stage: 'answer', body, config, apiKey: process.env.OPENAI_API_KEY });
      reached('answered');
      config = await this.access(row);
      result.audit = responseAudit(result);
      row = await this.store.usage(config, row, 'answer', result);
      const projected = candidate ? await projectEvidenceDraft(result.value, packet, config, this.adapters.canonical, row.payload.answerVersion || ANSWER_VERSION) : null;
      let stateProjection = null;
      if (stateEnabled) {
        try {
          stateProjection = projectDialogueAnswer(result.value, packet, row.payload.contextAudit, stateContext, previousState, config.dialogueStateVersion);
          await (this.adapters.validateDialogueStateRegion || validateStateRegion)(stateProjection.audit.value, stateContext);
        } catch (error) {
          // An unverifiable state is not memory, but the validated answer is still published.
          if (!SOFT_STATE_FAILURES.includes(error.code)) throw error;
          stateProjection = carriedDialogueAnswer(result.value, packet, previousState, error.code);
        }
      }
      const answer = projected?.answer || stateProjection?.answer || validateAnswer(result.value, Object.keys(packet.reference_map));
      config = await this.access(row);
      await this.checkReferences(config, packet);
      // Persist validated draft first. A later message transaction failure can recover without generation.
      row = await this.store.save(config, row, 'needs_recovery', { answer, ...(projected ? { evidenceDraftAudit: projected.audit } : {}),
        ...(stateProjection ? { dialogueState: stateProjection.audit, ...(stateProjection.fallback ? { dialogueStateFallback: stateProjection.fallback } : {}) } : {}),
        responseAudit: { ...row.payload.responseAudit, validation: { valid: true, code: 'validated' } }, timings: { validatedDraftMs: Date.now() - start, phases } });
      config = await this.access(row);
      row = await this.store.publish(config, row, answer, packet);
      const restored = await this.restore(row);
      restored.measurements.timings = { ...restored.measurements.timings, publishedMs: Date.now() - start };
      return restored;
    } catch (error) {
      if (row.state === 'completed') throw error; // A failed restore must not rewrite a committed answer's state.
      // Revocation/deletion/expiry also guards late audit writes. Never recreate missing rows.
      try {
        config = await this.access(row);
        if (error.usage && row.payload.events.at(-1)?.state === 'sent_unknown') {
          const audit = row.payload.events.at(-1).stage === 'answer'
            ? responseAudit(error, { valid: false, code: error.code || 'provider_failed' }) : undefined;
          row = await this.store.usage(config, row, row.payload.events.at(-1).stage, { ...error, audit });
        }
        const unknown = row.payload.events.some(e => e.state === 'sent_unknown');
        const answerReceived = row.payload.events.some(e => e.stage === 'answer' && e.state === 'response_received');
        const state = row.state === 'needs_recovery' ? 'needs_recovery' : unknown ? 'unknown' : answerReceived ? 'answer_rejected' : 'stopped';
        const code = /^[a-z_]+$/.test(error.code || '') ? error.code : 'pilot_failed';
        const audit = row.payload.responseAudit || (error.draftText !== undefined ? responseAudit(error) : null);
        await this.store.save(config, row, state, { error: code, ...(audit ? { responseAudit: { ...audit,
          validation: error.validation || { valid: false, code } } } : {}) });
      } catch { /* A failed/forbidden write leaves the conservative reservation and cannot retry. */ }
      throw Object.assign(error, { pilotTurnId: row.id });
    }
  }
  async recover(row) {
    const config = await this.access(row);
    if (row.state !== 'needs_recovery' || !row.payload.answer || !row.payload.packet) return this.restore(row);
    const answerVersion = row.payload.answerVersion || row.payload.evidenceDraftAudit?.answerVersion || 'm4-text-refs-1';
    validateAnswer(row.payload.answer, Object.keys(row.payload.packet.reference_map), answerVersion);
    await this.checkEvidenceDraft(config, row);
    this.checkDialogueState(config, row);
    await this.checkReferences(config, row.payload.packet);
    await this.access(row);
    return this.restore(await this.store.publish(config, row, row.payload.answer, row.payload.packet));
  }
  checkDialogueState(config, row) {
    if (!dialogueStateEnabled(config) && !row.payload.requestAudit?.dialogueStateVersion) return;
    const fallback = row.payload.dialogueStateFallback;
    if (!dialogueStateEnabled(config) || row.payload.requestAudit?.dialogueStateVersion !== config.dialogueStateVersion
      || !(row.payload.dialogueState || fallback) || !row.payload.responseAudit?.draft?.text || row.payload.responseAudit.draft.truncated) reject('dialogue_state_unavailable', 403);
    const draft = JSON.parse(row.payload.responseAudit.draft.text), previous = row.payload.previousDialogueState ?? null;
    const project = () => projectDialogueAnswer(draft, row.payload.packet, row.payload.contextAudit, row.payload.dialogueStateContext, previous, config.dialogueStateVersion);
    let projected;
    if (fallback) {
      // The recorded failure must reproduce: an invalid state stays invalid; a region failure
      // (asynchronous analyzer check) has a structurally valid projection.
      let code = null;
      try { project(); } catch (error) { code = error.code; }
      if (code !== (fallback.code === 'dialogue_state_region_unanchored' ? null : fallback.code)) reject('dialogue_state_projection_mismatch', 403);
      projected = carriedDialogueAnswer(draft, row.payload.packet, previous, fallback.code);
      if (digest(projected.fallback) !== digest(fallback)) reject('dialogue_state_projection_mismatch', 403);
    } else projected = project();
    if (digest(projected.audit) !== digest(row.payload.dialogueState ?? null) || digest(projected.answer) !== digest(row.payload.answer)) reject('dialogue_state_projection_mismatch', 403);
  }
  async checkEvidenceDraft(config, row) {
    if (!row.payload.requestAudit?.evidenceDraftVersion) return;
    const contract = evidenceDraftContract(config);
    if (!contract || row.payload.requestAudit.evidenceDraftVersion !== contract.version
      || row.payload.requestAudit.evidenceDraftPromptVersion !== contract.promptVersion
      || row.payload.responseAudit?.draft?.truncated) reject('evidence_draft_unavailable', 403);
    const answerVersion = row.payload.answerVersion || row.payload.evidenceDraftAudit?.answerVersion || 'm4-text-refs-1';
    const projected = await projectEvidenceDraft(JSON.parse(row.payload.responseAudit.draft.text), row.payload.packet, config, this.adapters.canonical, answerVersion);
    if (digest(projected.audit) !== digest(row.payload.evidenceDraftAudit) || digest(projected.answer) !== digest(row.payload.answer)) reject('evidence_projection_mismatch', 403);
  }
}
