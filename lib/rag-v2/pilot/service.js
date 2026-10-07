import { buildQuestion, exact, reject, digest, answerRequest, validateAnswer, responseAudit, PROMPT_VERSION, ANSWER_VERSION } from './contracts.js';
import { checkedTokens, MockEmbedding, validateVector } from '../search/embedding.js';
import { auditPacketBytes, AUDIT_PACKET_BYTES } from '../search/model-context.js';
import { checkLeanTurn, isLeanTurn } from './lean-turn.js';
import { historyMessages, historyRecord, historyDialogue } from './history.js';
import { providerCall } from './provider.js';
import { answerTextStream } from './answer-stream.js';
import { testAnswer } from './test-transport.js';
import { pilotExpired } from './lifetime.js';
import { fixedPacket } from './fixed-packet.js';
import { loneGreeting } from './greeting.js';
import { unifiedRetrievalEnabled } from './retrieval-plan.js';
import { evidenceDraftEnabled, evidenceDraftContract, evidenceDraftRequest, projectEvidenceDraft } from './evidence-draft.js';
import { dialogueEnabled, validateDialogueInput, buildDialogueQuery, currentMessageQuery, publishedDialogue, dialogueInput, dialogueRequest, publicContext, DIALOGUE_PROMPT_VERSION } from './dialogue.js';
import { carriedState } from './dialogue-carry.js';
import { locationFields } from '../source-locations.js';
import { answerForms } from './presentation.js';
import { estonianDate } from '../search/legal-validity.js';
import { dialogueStateEnabled, previousStateFor, projectDialogueAnswer, validateStateContext, validateStateRegion, SOFT_STATE_FAILURES, carriedDialogueAnswer,
  FACT_STATE_VERSIONS, REGION_STATE_VERSION, modelStateContext } from './dialogue-state.js';
import { askedRegions, askedPerson } from './person-places.js';
import { searchAssistEnabled, queryPlanRequest, rerankRequest, validateQueryPlan, validateRerank, planLanguage, planPerson, planPlaces, plannedPlaces, candidateRecord } from './search-assist.js';

// Search-assist calls that fail at the provider leave the turn on the plain fused search; access,
// scope and budget refusals still stop the turn.
const ASSIST_SOFT_FAILURES = new Set(['provider_http_error', 'provider_empty_body', 'provider_body_too_large', 'provider_invalid_json',
  'provider_usage_unknown', 'provider_incomplete', 'provider_refusal_or_invalid_output', 'answer_model_mismatch', 'invalid_query_plan',
  'invalid_rerank_selection', 'TimeoutError', 'AbortError']);
// An exhausted plan/rerank attempt cap also leaves the turn on the fused search.
const softAssistFailure = error => ASSIST_SOFT_FAILURES.has(error?.code) || ASSIST_SOFT_FAILURES.has(error?.name) || error?.code === 'pilot_stage_budget_exhausted';
// State v4 (ADR-051): the search plan's checked places and person, saved with the turn, give the people and the focus.
const stateServer = row => ({ places: row.payload.searchAssist?.places || [], person: row.payload.searchAssist?.person || null });

// What a reader needs to check a source: title plus the stored bibliographic fields that exist
// (ADR-020 adds year, journal, issue and printed page range to journal evidence).
function sourceCitation(bibliography = {}) {
  const citation = { authors: Array.isArray(bibliography.authors) && bibliography.authors.length ? bibliography.authors : null,
    year: bibliography.publication_year ?? null, journal: bibliography.journal_title ?? null, issue: bibliography.issue_label ?? null,
    pageRange: bibliography.page_range ?? null };
  return { title: bibliography.title, ...Object.fromEntries(Object.entries(citation).filter(([, value]) => value !== null && value !== '')) };
}
// When the source was collected or checked (a municipality's record, a contact from the register): the sources panel
// shows it, so the answer does not repeat it in every closing sentence.
const sourceChecked = evidence => {
  const value = evidence?.source_metadata?.source_checked_at?.value;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? { checked: value.slice(0, 10) } : {};
};

// A web page's address as its source card names it, and the declared address it stands for (ADR-097): the chat makes
// the address in the answer's text a link to it.
const sourceWeb = evidence => {
  const web = evidence?.source_metadata?.web_address;
  return typeof web?.value === 'string' && typeof web.url === 'string' && /^https:\/\/[^\s"<>]+$/u.test(web.url) ? { web: web.value, webUrl: web.url } : {};
};

// What the chat shows of a completed turn, from its row: the answer, every source of its packet with its citation and
// whether the answer uses it, the forms. The turn's durable record (ADR-094) is made from the same view.
export function completedView(row, mode) {
  const answerVersion = row.payload.answerVersion || row.payload.evidenceDraftAudit?.answerVersion || 'm4-text-refs-1';
  const answer = validateAnswer(row.payload.answer, Object.keys(row.payload.packet.reference_map), answerVersion);
  return { id: row.id, state: 'completed', mode, question: row.payload.question, answer,
    answerVersion, language: row.payload.query.language, context: publicContext(row), forms: answerForms(row.payload.packet, answer),
    messageId: row.payload.messageId, sources: Object.entries(row.payload.packet.reference_map).map(([ref, value]) => ({ ref,
      ...sourceCitation(row.payload.packet.evidence.find(e => e.evidence_id === value.evidence_id)?.bibliography),
      ...sourceChecked(row.payload.packet.evidence.find(e => e.evidence_id === value.evidence_id)),
      ...sourceWeb(row.payload.packet.evidence.find(e => e.evidence_id === value.evidence_id)),
      pages: value.pdf_pages, ...locationFields(value), version: value.document_version_id, used: row.payload.answer.blocks.some(b => b.refs.includes(ref)) })) };
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
    return { ...completedView(row, config.mode),
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
      else if (softAssistFailure(error)) row = await this.store.failed(config, row, stage, error.code || error.name || 'provider_failed').catch(() => row);
      throw Object.assign(error, { row });
    }
    try { row = await this.store.usage(config, row, stage, result); }
    catch (error) { throw Object.assign(error, { row }); }
    return { row, value: result.value };
  }
  // onAnswerText (ADR-040): the answer is requested as a stream and its provisional visible text passed on while the
  // model writes it. The answer is still published only after the same validation and reference checks.
  async run(userId, input, { onAnswerText = null } = {}) {
    exact(input, ['convId', 'clientTurnKey', 'question', 'contextMode', 'language', 'contextTurnId', 'replyToTurnId', 'replyToBlock', 'reasoning']);
    if (input.language !== undefined && !['et', 'en', 'ru'].includes(input.language)) reject('invalid_language');
    if (![input.convId, input.clientTurnKey].every(x => typeof x === 'string' && /^[\w-]{8,100}$/.test(x))) reject('invalid_turn_identity');
    buildQuestion({ question: input.question, contextMode: input.contextMode });
    let config = await this.access();
    // ADR-092: the user's choice of the answer's reasoning effort, only among the efforts the approved plan offers.
    if (input.reasoning !== undefined && !(Array.isArray(config.reasoningChoices) && config.reasoningChoices.includes(input.reasoning))) reject('reasoning_not_offered');
    const continuing = dialogueEnabled(config);
    if (continuing) validateDialogueInput(input);
    else if (['contextTurnId', 'replyToTurnId', 'replyToBlock'].some(key => input[key] !== undefined)) reject('dialogue_not_enabled');
    await this.store.purgeDue();
    const existing = await this.store.existing(config, userId, input);
    if (existing) return this.restore(existing);
    const initialConfigHash = config.configHash;
    config = await this.access(undefined, true);
    if (config.configHash !== initialConfigHash) reject('pilot_scope_changed', 403);
    if (config.mode === 'real' && config.questionPolicy?.mode === 'locked'
      && !config.questionPolicy.inputs.some(x => x.question === input.question && x.contextMode === input.contextMode && x.language === (input.language || 'et'))) reject('question_not_in_approved_plan', 403);
    // Codex J4: the conversation's validated answer that waits for publication is published first, with no model call;
    // when that fails, the new question does not reach the model.
    for (const pending of await this.store.pendingRecovery(config, userId, input.convId)) {
      try { await this.recover(pending); } catch { reject('conversation_recovery_failed', 409); }
    }
    const claimed = await this.store.claim(config, userId, input);
    if (!claimed.fresh) return this.restore(claimed.row);
    let row = claimed.row;
    const start = Date.now(), phases = {};
    let searchTimings = null; // where the search spent its time (search_timings of the adapter), kept with the turn
    // Milliseconds since the turn started, at each finished phase (latency audit of the chat).
    const reached = name => { phases[name] = Date.now() - start; };
    try {
      const stateEnabled = dialogueStateEnabled(config);
      let assistant = null, dialogue = null, previousState = null, stateContext = null, askedBefore = [], askedFor = null;
      if (continuing) {
        const turnId = row.payload.contextAudit.selection.assistantTurnId;
        let source = null;
        if (turnId) {
          source = await this.store.dialogueSource(config, row, turnId);
          if (source.history) {
            // ADR-094: the turn's audit row is gone or belongs to another plan. The dialogue goes on from the turn's
            // record, as the turn was answered then; there is no packet to prove again.
            assistant = historyDialogue(source.history);
            askedBefore = source.history.dialogue.askedRegions || [];
            askedFor = source.history.dialogue.askedPerson ?? null;
          } else {
            await this.access(source);
            await this.checkReferences(config, source.payload.packet);
            this.checkDialogueState(config, source);
            assistant = publishedDialogue(source);
            // ADR-074: the municipality that answer was asked about, and for whom; that person's follow-up may go on about
            // it (questionRegionScope).
            askedBefore = askedRegions(source.payload.packet?.record_context?.scope);
            askedFor = askedPerson(source.payload.packet?.record_context?.scope);
          }
        }
        if (stateEnabled) {
          const stateTurnId = row.payload.contextAudit.selection.stateTurnId;
          if (stateTurnId) {
            const latest = source?.id === stateTurnId ? source : await this.store.dialogueSource(config, row, stateTurnId);
            if (latest.history) previousState = this.historyState(config, latest, row);
            else {
              await this.access(latest);
              this.checkDialogueState(config, latest);
              // A state of the full topic this one continues is handed over as this topic's first state (ADR-070).
              previousState = latest.payload.context?.scopeId === row.payload.context.scopeId
                ? previousStateFor(latest.payload.dialogueState, row.payload.contextAudit)
                : carriedState(latest.payload.dialogueState, row.payload.contextAudit);
            }
          }
          stateContext = validateStateContext({ ...(await this.adapters.dialogueStateContext?.(config) || { regions: [] }),
            asOfDateUTC: new Date().toISOString().slice(0, 10) });
        }
        dialogue = dialogueInput(row.payload.contextAudit, assistant, stateEnabled
          ? { previous: previousState, context: modelStateContext(config.dialogueStateVersion, stateContext) } : null);
      }
      const query = continuing ? buildDialogueQuery(row.payload.contextAudit, config, assistant, previousState)
        : buildQuestion({ question: input.question, contextMode: input.contextMode }, row.payload.previous);
      query.language = input.language || 'et';
      if (askedBefore.length && askedFor && query.scopeTurns) { query.askedRegions = askedBefore; query.askedPerson = askedFor; }
      // ADR-103: the settlements the place check admitted for this turn (query.settlements) are names of their
      // municipalities for the saved state's anchor too, and the turn's record keeps them.
      const settled = assist => {
        if (!query.settlements?.length) return;
        assist.settlements = query.settlements;
        stateContext = this.adapters.turnStateContext?.(stateContext, query) ?? stateContext;
      };
      const settledContext = () => (stateEnabled && stateContext && query.settlements?.length ? { dialogueStateContext: stateContext } : {});
      const embeddingTokens = checkedTokens(query.text, config.embedding);
      await this.adapters.preflight(config);
      row = await this.store.save(config, row, 'claimed', { query, ...(dialogue ? { dialogue: dialogue.value, dialogueTokens: dialogue.tokens } : {}),
        ...(stateEnabled ? { previousDialogueState: previousState, dialogueStateContext: stateContext } : {}) });
      const preparedPacket = await this.adapters.records?.(config, query) || await fixedPacket(config, query);
      let retrieved = preparedPacket;
      // A topic that starts with only a greeting (greeting.js) gets no search plan, no embedding and no search: the answer
      // model replies to it with an empty knowledge lane, in the greeting's language, and the turn is saved like any other.
      const greeting = !preparedPacket && continuing && searchAssistEnabled(config) && unifiedRetrievalEnabled(config)
        && row.payload.contextAudit.userTurns.length === 1 && !assistant ? loneGreeting(input.question) : null;
      if (greeting) {
        const assist = { version: config.searchAssist, queries: [], rerank: null, failures: [], greeting: true };
        if (greeting !== query.language) { assist.language = { interface: query.language, message: greeting }; query.language = greeting; }
        // State v5 reads the message's municipalities itself when there is no plan (as after a failed plan): none here.
        if (config.dialogueStateVersion === REGION_STATE_VERSION && this.adapters.checkedPlaces) {
          query.places = await this.adapters.checkedPlaces(config, query, []); assist.places = query.places; settled(assist);
        }
        retrieved = await this.adapters.search(config, query, null, { greeting: true, variants: [], vectors: new Map(), rerank: null });
        reached('searched');
        searchTimings = retrieved.search_timings || null;
        config = await this.access(row);
        row = await this.store.save(config, row, 'claimed', { searchAssist: assist, query, ...settledContext(), timings: { phases: { ...phases }, ...(searchTimings ? { search: searchTimings } : {}) } });
      }
      if (!preparedPacket && !greeting) {
      // Search assist: the answer model first writes search queries in the vocabulary of official texts.
      const assisted = searchAssistEnabled(config), messages = (query.scopeTurns || [{ text: query.text }]).map(turn => turn.text);
      const assist = assisted ? { version: config.searchAssist, queries: [], rerank: null, failures: [] } : null;
      if (assisted) {
        try {
          // The persons the previous state knows; the plan says which of them the current message is about (ADR-049).
          // The plan names the places of every message the saved state has not read (ADR-051).
          const people = (previousState?.value.people || []).map(entry => entry.person);
          const unread = messages.length - (previousState?.sourceTurnIds.length || 0);
          const planned = await this.assistCall(config, row, 'plan', queryPlanRequest(config, messages, query.language, people, unread), { queries: [] });
          row = planned.row; assist.queries = validateQueryPlan(planned.value, query.text);
          // The answer follows the language the user wrote in; the interface language is the fallback.
          const language = planLanguage(config, planned.value);
          if (language && language !== query.language) { assist.language = { interface: query.language, message: language }; query.language = language; }
          const person = planPerson(config, planned.value, people);
          if (person) { assist.person = person; query.person = person; }
          // ADR-051: whose each named place is, checked against the message; the catalogue and the state both use it.
          const places = planPlaces(config, planned.value);
          // ADR-074: the plan's own attributions stay in the turn record beside the checked ones (audit only; nothing reads
          // them). On 04.10 two turns held only the server's "place_not_attributed", and the record could not tell whether
          // the plan had named no place or its attribution had failed the check.
          if (places) assist.plannedPlaces = plannedPlaces(places);
          if (places && this.adapters.checkedPlaces) { query.places = await this.adapters.checkedPlaces(config, query, places); assist.places = query.places; settled(assist); }
        } catch (error) {
          if (error.row) row = error.row;
          if (!softAssistFailure(error)) throw error;
          assist.failures.push({ stage: 'plan', code: error.code || error.name });
        }
        // State v5 (Codex V1): without the plan's places (a failed plan), the message's municipalities still get the one
        // decision that search and the next state both read.
        if (!Array.isArray(query.places) && config.dialogueStateVersion === REGION_STATE_VERSION && this.adapters.checkedPlaces) {
          query.places = await this.adapters.checkedPlaces(config, query, []); assist.places = query.places; settled(assist);
        }
        // ADR-078: the plan's queries carry what earlier messages add to the request, so the search text is the current
        // message. Without queries (a plan that failed or wrote none, as for a bare correction) the scope's text stays.
        if (continuing && assist.queries.length) {
          const narrowed = currentMessageQuery(query, row.payload.contextAudit, config, assistant);
          if (narrowed) {
            Object.assign(query, narrowed);
            assist.queries = assist.queries.filter(text => text.toLowerCase() !== query.text.trim().toLowerCase());
          }
        }
        config = await this.access(row);
      }
      if (assisted) reached('planned');
      let vector = await this.store.cache(config, userId, query.hash, query.cacheKey);
      if (!vector && config.queryReuse) {
        const reused = await this.store.reuse(config, userId, query);
        if (reused) { vector = reused.vector; row = await this.store.save(config, row, 'claimed', { queryReuse: reused.receipt }); }
      }
      // The question (unless cached) and the planned queries are embedded in one request, and the search starts at the same
      // time (Codex 30.09): its scope, directory and lexical channel need no vector, and each vector read waits for this
      // request. The request records its usage and saves the vector before any vector is given out, so the rerank's
      // writes, which follow the vector channel, stay after it.
      const variants = assist?.queries || [], pending = [...(vector ? [] : [query.text]), ...variants];
      const variantVectors = new Map();
      const embedded = (async () => {
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
        return { vector, variantVectors };
      })();
      // The search's own promises of the vectors; a failed request is the turn's error, reported below.
      const vectorReady = embedded.then(result => result.vector), variantsReady = embedded.then(result => result.variantVectors);
      vectorReady.catch(() => {}); variantsReady.catch(() => {});
      // Search assist, second call: the answer model keeps the fused candidates that carry the answer.
      const rerank = assisted ? async passages => {
        try {
          const selected = await this.assistCall(await this.access(row), row, 'rerank', rerankRequest(config, messages, passages, estonianDate()),
            { useful: passages.slice(0, 3).map(passage => passage.id) });
          row = selected.row;
          const useful = validateRerank(selected.value, passages);
          assist.rerank = { candidates: passages.map(candidateRecord), selected: useful };
          return useful;
        } catch (error) {
          if (error.row) row = error.row;
          if (!softAssistFailure(error)) throw error;
          assist.failures.push({ stage: 'rerank', code: error.code || error.name });
          return null;
        }
      } : null;
      // Both finish before the turn goes on: an early search failure still waits for the request's usage to be recorded,
      // and a failed request (or access withdrawn meanwhile) is the error even when the search failed because of it.
      const [searched, embedding] = await Promise.allSettled([
        this.adapters.search(config, query, vectorReady, assisted ? { variants, vectors: variantsReady, rerank } : null), embedded]);
      if (embedding.status === 'rejected') throw embedding.reason;
      if (searched.status === 'rejected') throw searched.reason;
      retrieved = searched.value;
      reached('searched');
      searchTimings = retrieved.search_timings || null;
      // ADR-091: the acts whose versions were compared for an asked day, and the candidates that came of it.
      if (assisted && retrieved.version_change_places) assist.changePlaces = retrieved.version_change_places;
      if (assisted) {
        config = await this.access(row);
        row = await this.store.save(config, row, 'claimed', { searchAssist: assist, query, ...settledContext(), timings: { phases: { ...phases }, ...(searchTimings ? { search: searchTimings } : {}) } });
      }
      }
      // Persist only the evidence actually sent plus its canonical reference bindings.
      const packet = { tenant: retrieved.tenant, query_id: retrieved.query_id, generation_id: retrieved.generation_id || config.generationId || null,
        model_context: retrieved.model_context, reference_map: retrieved.reference_map, evidence: retrieved.evidence,
        ...(retrieved.dependency_context ? { dependency_context: retrieved.dependency_context } : {}),
        ...(retrieved.retrieval_context ? { retrieval_context: retrieved.retrieval_context, retrieval_audit: retrieved.retrieval_audit } : {}),
        ...(retrieved.record_context ? { record_context: retrieved.record_context } : {}),
        ...(retrieved.version_comparison ? { version_comparison: retrieved.version_comparison } : {}) };
      // The limit reads the packet without the legal dates (ADR-062): a turn that fits without them does not fail over them.
      if (auditPacketBytes(packet) > AUDIT_PACKET_BYTES) reject('audit_packet_too_large');
      config = await this.access(row);
      await this.checkReferences(config, packet);
      const candidate = evidenceDraftEnabled(config);
      const evidenceContract = candidate ? evidenceDraftContract(config) : null;
      // ADR-092: the answer is written with the effort the user chose, else with the plan's own. The search plan and the
      // evidence selection before it are the same either way.
      const answering = input.reasoning && input.reasoning !== config.reasoning ? { ...config, reasoning: input.reasoning } : config;
      const body = candidate ? evidenceDraftRequest(answering, query.text, packet.model_context, query.language)
        : continuing ? dialogueRequest(answering, query.question, packet.model_context, query.language, dialogue.value)
          : answerRequest(answering, query.text, packet.model_context, query.language);
      // A streamed request says so in the audited body; the model, prompt and output contract stay the same.
      const answerText = typeof onAnswerText === 'function'
        ? answerTextStream(text => { if (phases.first_text === undefined) reached('first_text'); onAnswerText(text); }) : null;
      if (answerText) body.stream = true;
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
      const onText = answerText ? delta => answerText.push(delta) : null;
      const result = config.mode === 'test' ? await testAnswer(config, body, packet, inputBound, { onText })
        : await this.call({ stage: 'answer', body, config, apiKey: process.env.OPENAI_API_KEY, ...(onText ? { onText } : {}) });
      reached('answered');
      config = await this.access(row);
      result.audit = responseAudit(result);
      row = await this.store.usage(config, row, 'answer', result);
      const projected = candidate ? await projectEvidenceDraft(result.value, packet, config, this.adapters.canonical, row.payload.answerVersion || ANSWER_VERSION) : null;
      let stateProjection = null;
      if (stateEnabled) {
        try {
          stateProjection = projectDialogueAnswer(result.value, packet, row.payload.contextAudit, stateContext, previousState, config.dialogueStateVersion,
            stateServer(row));
          // State v4 takes each person's municipality from the checked places, not from the model: nothing to anchor.
          if (!FACT_STATE_VERSIONS.includes(config.dialogueStateVersion)) {
            await (this.adapters.validateDialogueStateRegion || validateStateRegion)(stateProjection.audit.value, stateContext, row.payload.contextAudit.userTurns);
          }
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
        responseAudit: { ...row.payload.responseAudit, validation: { valid: true, code: 'validated' } },
        timings: { validatedDraftMs: Date.now() - start, phases, ...(searchTimings ? { search: searchTimings } : {}) } });
      config = await this.access(row);
      row = await this.store.publish(config, row, answer, packet, this.history(config, row, answer, packet));
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
    return this.restore(await this.store.publish(config, row, row.payload.answer, row.payload.packet, this.history(config, row, row.payload.answer, row.payload.packet)));
  }
  // ADR-094: the state a turn's record holds, as the next turn's previous state. A state of another state version, or
  // one that no longer binds to the topic's turns as the dialogue has them, is not memory: the turn goes on without it
  // and the model reads the topic's user turns again, as after a state that could not be verified.
  historyState(config, latest, row) {
    const audit = latest.payload.dialogueState;
    if (!audit || audit.version !== config.dialogueStateVersion) return null;
    try {
      return latest.payload.context?.scopeId === row.payload.context.scopeId
        ? previousStateFor(audit, row.payload.contextAudit) : carriedState(audit, row.payload.contextAudit);
    } catch (error) {
      if (error.code !== 'dialogue_state_scope_mismatch') throw error;
      console.error('[rag-v2] history state not continued', error.code);
      return null;
    }
  }
  // ADR-094: the two messages of the turn's durable record, made from the turn as it is published: the question and
  // the answer as text, and with the answer what the chat shows of the turn and the dialogue goes on from.
  history(config, row, answer, packet) {
    const published = { ...row, payload: { ...row.payload, answer, packet } };
    // A validated answer is never held back for its record: a turn whose record cannot be made is published as turns
    // were before, with placeholder messages, and is then shown from its audit row only.
    try { return historyMessages(historyRecord({ row: published, view: completedView(published, config.mode), packet }), row.payload.question); }
    catch (error) { console.error('[rag-v2] history record not made', error?.code || error?.name); return null; }
  }
  checkDialogueState(config, row) {
    // ADR-093: a lean turn no longer holds what its state was projected from. Its answer and state were proved when it was
    // published; here they must still be the ones proved then.
    if (isLeanTurn(row)) return checkLeanTurn(row);
    if (!dialogueStateEnabled(config) && !row.payload.requestAudit?.dialogueStateVersion) return;
    const fallback = row.payload.dialogueStateFallback;
    if (!dialogueStateEnabled(config) || row.payload.requestAudit?.dialogueStateVersion !== config.dialogueStateVersion
      || !(row.payload.dialogueState || fallback) || !row.payload.responseAudit?.draft?.text || row.payload.responseAudit.draft.truncated) reject('dialogue_state_unavailable', 403);
    const draft = JSON.parse(row.payload.responseAudit.draft.text), previous = row.payload.previousDialogueState ?? null;
    const project = () => projectDialogueAnswer(draft, row.payload.packet, row.payload.contextAudit, row.payload.dialogueStateContext, previous, config.dialogueStateVersion,
      stateServer(row));
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
    if (isLeanTurn(row)) return checkLeanTurn(row);
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
