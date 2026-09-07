import { buildQuestion, exact, reject, digest, answerRequest, validateAnswer, responseAudit, PROMPT_VERSION, ANSWER_VERSION } from './contracts.js';
import { checkedTokens, MockEmbedding, validateVector } from '../search/embedding.js';
import { providerCall } from './provider.js';
import { testAnswer } from './test-transport.js';
import { pilotExpired } from './lifetime.js';
import { fixedPacket } from './fixed-packet.js';
import { evidenceDraftEnabled, evidenceDraftContract, evidenceDraftRequest, projectEvidenceDraft } from './evidence-draft.js';
import { dialogueEnabled, validateDialogueInput, buildDialogueQuery, publishedDialogue, dialogueInput, dialogueRequest, publicContext, DIALOGUE_PROMPT_VERSION } from './dialogue.js';

export class PilotService {
  constructor({ store, readConfig, adapters, call = providerCall }) { Object.assign(this, { store, readConfig, adapters, call }); }
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
    for (const ref of Object.keys(row.payload.packet.reference_map)) await this.adapters.canonical(config, row.payload.packet, ref);
    await this.checkEvidenceDraft(config, row);
    await this.access(row);
    const answerVersion = row.payload.answerVersion || row.payload.evidenceDraftAudit?.answerVersion || 'm4-text-refs-1';
    return { id: row.id, state: 'completed', mode: config.mode, question: row.payload.question, answer: validateAnswer(row.payload.answer, Object.keys(row.payload.packet.reference_map), answerVersion),
      answerVersion, language: row.payload.query.language, context: publicContext(row),
      messageId: row.payload.messageId, sources: Object.entries(row.payload.packet.reference_map).map(([ref, value]) => ({ ref,
        title: row.payload.packet.evidence.find(e => e.evidence_id === value.evidence_id)?.bibliography.title,
        pages: value.pdf_pages, version: value.document_version_id, used: row.payload.answer.blocks.some(b => b.refs.includes(ref)) })),
      measurements: { queryTokens: row.payload.query.tokens, events: row.payload.events.map(e => ({ stage: e.stage, state: e.state, reservation: e.reservation, usage: e.usage, estimatedNanoUsd: e.estimatedNanoUsd, timings: e.timings })), timings: row.payload.timings } };
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
    const start = Date.now();
    try {
      let assistant = null, dialogue = null;
      if (continuing) {
        const turnId = row.payload.contextAudit.selection.assistantTurnId;
        if (turnId) {
          const source = await this.store.dialogueSource(config, row, turnId);
          await this.access(source);
          for (const ref of Object.keys(source.payload.packet.reference_map)) await this.adapters.canonical(config, source.payload.packet, ref);
          assistant = publishedDialogue(source);
        }
        dialogue = dialogueInput(row.payload.contextAudit, assistant);
      }
      const query = continuing ? buildDialogueQuery(row.payload.contextAudit, config, assistant)
        : buildQuestion({ question: input.question, contextMode: input.contextMode }, row.payload.previous);
      query.language = input.language || 'et';
      const embeddingTokens = checkedTokens(query.text, config.embedding);
      await this.adapters.preflight(config);
      row = await this.store.save(config, row, 'claimed', { query, ...(dialogue ? { dialogue: dialogue.value, dialogueTokens: dialogue.tokens } : {}) });
      const preparedPacket = await fixedPacket(config, query);
      let retrieved = preparedPacket;
      if (!preparedPacket) {
      let vector = await this.store.cache(config, userId, query.hash, query.cacheKey);
      if (!vector && config.queryReuse) {
        const reused = await this.store.reuse(config, userId, query);
        if (reused) { vector = reused.vector; row = await this.store.save(config, row, 'claimed', { queryReuse: reused.receipt }); }
      }
      if (!vector) {
        config = await this.access(row);
        const body = { input: query.text, model: config.embedding.model, dimensions: config.embedding.dimensions, encoding_format: 'float' };
        row = await this.store.reserve(config, row, 'embedding', { tokens: embeddingTokens, nanoUsd: config.mode === 'real' ? embeddingTokens * config.prices.embeddingInput : 0 },
          { inputHash: query.hash, bodyHash: digest(body), inputVersion: query.version });
        config = await this.access(row, true);
        row = await this.store.sent(config, row, 'embedding');
        const result = config.mode === 'test' ? { value: await new MockEmbedding(config.embedding).embed(query.text), usage: { input: embeddingTokens, output: 0 }, requestId: 'test-embedding' }
          : await this.call({ stage: 'embedding', body, config, apiKey: process.env.OPENAI_API_KEY });
        row = await this.store.usage(config, row, 'embedding', result);
        vector = validateVector(result.value, config.embedding);
      } else validateVector(vector, config.embedding);
      config = await this.access(row);
      row = await this.store.save(config, row, 'claimed', { vector });
      retrieved = await this.adapters.search(config, query, vector);
      }
      // Persist only the evidence actually sent plus its canonical reference bindings.
      const packet = { tenant: retrieved.tenant, query_id: retrieved.query_id, generation_id: retrieved.generation_id || config.generationId || null,
        model_context: retrieved.model_context, reference_map: retrieved.reference_map, evidence: retrieved.evidence,
        ...(retrieved.dependency_context ? { dependency_context: retrieved.dependency_context } : {}) };
      if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > 512000) reject('audit_packet_too_large');
      config = await this.access(row);
      for (const ref of Object.keys(packet.reference_map)) await this.adapters.canonical(config, packet, ref);
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
          promptVersion: continuing ? DIALOGUE_PROMPT_VERSION : PROMPT_VERSION, answerVersion: ANSWER_VERSION, questionVersion: query.version,
          profile: config.profile, generationId: packet.generation_id, savedAt: new Date().toISOString() } });
      row = await this.store.reserve(config, row, 'answer', { tokens: inputBound + config.maxOutputTokens,
        nanoUsd: config.mode === 'real' ? inputBound * config.prices.answerInput + config.maxOutputTokens * config.prices.answerOutput : 0 },
      { bodyHash: digest(body), inputBound, maxOutputTokens: config.maxOutputTokens });
      config = await this.access(row, true);
      row = await this.store.sent(config, row, 'answer');
      const result = config.mode === 'test' ? await testAnswer(config, body, packet, inputBound)
        : await this.call({ stage: 'answer', body, config, apiKey: process.env.OPENAI_API_KEY });
      config = await this.access(row);
      result.audit = responseAudit(result);
      row = await this.store.usage(config, row, 'answer', result);
      const projected = candidate ? await projectEvidenceDraft(result.value, packet, config, this.adapters.canonical, row.payload.answerVersion || ANSWER_VERSION) : null;
      const answer = projected ? projected.answer : validateAnswer(result.value, Object.keys(packet.reference_map));
      config = await this.access(row);
      for (const ref of Object.keys(packet.reference_map)) await this.adapters.canonical(config, packet, ref);
      // Persist validated draft first. A later message transaction failure can recover without generation.
      row = await this.store.save(config, row, 'needs_recovery', { answer, ...(projected ? { evidenceDraftAudit: projected.audit } : {}),
        responseAudit: { ...row.payload.responseAudit, validation: { valid: true, code: 'validated' } }, timings: { validatedDraftMs: Date.now() - start } });
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
    for (const ref of Object.keys(row.payload.packet.reference_map)) await this.adapters.canonical(config, row.payload.packet, ref);
    await this.access(row);
    return this.restore(await this.store.publish(config, row, row.payload.answer, row.payload.packet));
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
