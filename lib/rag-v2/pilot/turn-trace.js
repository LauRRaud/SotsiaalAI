// The admin's view of one chat turn (owner 21.10.2026: "admin peaks saama vajadusel vaadata, kuidas toimus küsimuse
// koostamine AI poolt, kuidas see liikus läbi rag andmebaasi ja kuidas AI formuleeris vastuse", and "mis on valikute
// põhjused"). Built from the turn's own audit row as the turn wrote it: nothing is searched or asked again. A row the
// retention made lean (ADR-093) has only the answer and its sources left, and the view says so.
//
//   question   what was asked, by whom (the role the answer addressed) and under which plan, prompt and profile
//   plan       what the AI made of the question for the search: the search variants, places, person and language
//   lanes      the search's lanes (knowledge, the municipality's records, providers, periods) and what each gave
//   pool       the passages the selection model read, in their fused order: each one's place in every channel, what
//              each place gave the fused score, whether it was a reserved place, the model's pick and the final ref
//   evidence   every passage sent to the answer: why it is there (ranked, a cross-reference of S2, a companion
//              provision, …), its source card and heading, its scores, and whether the answer cited it
//   additions  what the lanes after the ranked passages read and added, and why candidates were left out
//   answer     the answer as published, and the request it was written from (instructions, role text, evidence)
//   profile    the numbers the search worked with (places, room, weights), for the explanation
export const TURN_TRACE_VERSION = 'rag-v2/turn-trace-1';

const value = field => (field && typeof field === 'object' && 'value' in field ? field.value : field) ?? null;
const firstLine = text => (typeof text === 'string' ? text.split('\n')[0].trim() : '') || null;
const developerTexts = body => (Array.isArray(body?.input) ? body.input : []).filter(item => item?.role === 'developer').map(item => String(item.content ?? ''));
function userRole(body) {
  const user = (Array.isArray(body?.input) ? body.input : []).find(item => item?.role === 'user');
  try { return JSON.parse(user?.content ?? 'null')?.dialogue?.userRole ?? null; } catch { return null; }
}
const promptVersion = request => request?.promptVersion ?? request?.body?.instructions?.match(/Dialogue extension: ([\w.-]+)/u)?.[1] ?? null;

// A reason as a plain record: its type and the ref of the passage that brought it, where there is one.
function reasonOf(reason, refOfEvidence) {
  if (typeof reason === 'string') return { type: reason };
  if (!reason || typeof reason !== 'object') return { type: 'unknown' };
  const { type, seed_evidence_id: seed, ...rest } = reason;
  return { type: type ?? 'unknown', ...(seed ? { from: refOfEvidence.get(seed) ?? null } : {}), ...rest };
}

// Each model call as the provider adapter measured it (provider.js): the first byte, the first visible text of a streamed
// answer and the whole response, and how much of the input came from the provider's prompt cache.
const rounded = value => (Number.isFinite(value) ? Math.round(value) : null);
function stages(events) {
  // ADR-170: code says why a call failed (a time limit before the answer's retry).
  return (Array.isArray(events) ? events : []).map(event => ({ stage: event.stage, state: event.state ?? null, code: event.code ?? null,
    input: event.usage?.input ?? null, output: event.usage?.output ?? null, reasoning: event.usage?.reasoning ?? null, cachedInput: event.usage?.cachedInput ?? null,
    nanoUsd: event.cost?.nanoUsd ?? event.estimatedNanoUsd ?? null, ms: rounded(event.timings?.completeResponseMs),
    firstDataMs: rounded(event.timings?.firstDataMs), firstTextMs: rounded(event.timings?.firstTextMs), streaming: event.timings?.streaming ?? null }));
}

// ADR-167: how the turn's municipality was decided (the source scope: its state, the person it is for, the candidates of a
// shared name, how it is read, and the user's place of work it carries).
const scopeSummary = scope => (scope && typeof scope === 'object' ? { state: scope.state ?? null, region: scope.region ?? null, person: scope.person ?? null,
  candidates: Array.isArray(scope.candidates) ? scope.candidates : [], asked_in: scope.asked_in ?? null, interpretation: scope.interpretation ?? null,
  work_regions: Array.isArray(scope.work_regions) ? scope.work_regions : [] } : null);

/** The view of an opened turn row (openTurn): plain data, no ids of other users, no vectors. */
export function turnTrace(row) {
  const payload = row?.payload || {}, packet = payload.packet || {}, request = payload.requestAudit || {}, assist = payload.searchAssist || null;
  const evidenceList = Array.isArray(packet.evidence) ? packet.evidence : [];
  const refOfEvidence = new Map(evidenceList.map((entry, index) => [entry.evidence_id, `S${index + 1}`]));
  const refOfUnit = new Map(evidenceList.map((entry, index) => [entry.unit_id, `S${index + 1}`]));
  const answer = payload.answer || null;
  const cited = new Set((answer?.blocks || []).flatMap(block => block.refs || []));
  const laneOf = new Map();
  for (const lane of packet.retrieval_context?.lanes || []) for (const ref of lane.refs || []) if (!laneOf.has(ref)) laneOf.set(ref, lane.key);
  const audits = new Map((request.laneAudit?.lanes || []).map(lane => [lane.key, lane]));

  const evidence = evidenceList.map((entry, index) => {
    const ref = `S${index + 1}`, card = entry.source_metadata || {}, bib = entry.bibliography || {};
    return { ref, cited: cited.has(ref), lane: laneOf.get(ref) ?? null, title: bib.title ?? null,
      sourceType: value(card.source_type), authority: value(card.authority), date: bib.publication_date ?? bib.publication_year ?? value(card.valid_from),
      web: card.web_address ?? null, heading: firstLine(entry.search_aids?.heading_prefix),
      provision: entry.legal_place ? [entry.legal_place.section ? `§ ${entry.legal_place.section}` : null, ...(entry.legal_place.subsections || []).map(item => `lg ${item}`)].filter(Boolean).join(' ') || null : null,
      reason: reasonOf(entry.selection?.reason, refOfEvidence), ranks: entry.selection?.ranks || {}, contributions: entry.selection?.rrf_contributions || {},
      score: entry.selection?.rrf_score ?? null, chars: typeof entry.source_text === 'string' ? entry.source_text.length : null, text: entry.source_text ?? null };
  });

  // The selection model's pool: the knowledge lane's candidates in their fused order (P1 … Pn as the model read them).
  // ADR-158: the picks are the knowledge lane's own (its rerank.selected, by unit id). The turn's searchAssist.rerank is
  // the last selection call of the turn, which a publication-period lane may have made after the knowledge lane; its
  // cards are used only when they are this pool's (the same number), and otherwise the lane audit's own titles.
  const knowledge = audits.get('knowledge'), rerank = knowledge?.rerank || null, cards = assist?.rerank?.candidates || [];
  const shown = rerank?.candidates && cards.length === rerank.candidates.length ? cards : rerank?.candidates ? [] : cards;
  const pickedUnits = new Map((rerank?.selected || []).map((unit, index) => [unit, index + 1]));
  const pickedCards = new Map((assist?.rerank?.selected || []).map((id, index) => [id, index + 1]));
  const leftOut = new Map((knowledge?.pool_left_out || []).map(item => [item.unit_id, item.reason]));
  const reserved = new Set(rerank?.reserved || []);
  const size = Math.max(shown.length, rerank?.candidates?.length || 0);
  const pool = Array.from({ length: size }, (_, index) => {
    const unit = rerank?.candidates?.[index] ?? null, fused = rerank?.fused?.[index] || {}, card = shown[index] || {};
    const id = card.id ?? `P${index + 1}`;
    return { id, title: card.title ?? fused.title ?? null, section: card.section ?? null, sourceType: card.source_type ?? null, authority: card.authority ?? null,
      lead: card.lead ?? fused.lead ?? null, validFrom: card.valid_from ?? null, reserved: unit ? reserved.has(unit) : false,
      score: fused.score ?? null, ranks: fused.ranks || {}, contributions: fused.contributions || {},
      pick: (unit ? pickedUnits.get(unit) : pickedCards.get(id)) ?? null, ref: unit ? refOfUnit.get(unit) ?? null : null, leftOut: unit ? leftOut.get(unit) ?? null : null };
  });

  const profile = request.profile || null, query = profile?.query || null;
  return {
    version: TURN_TRACE_VERSION,
    question: { turnId: row?.id ?? null, createdAt: row?.createdAt ?? null, state: row?.state ?? null, plan: row?.pilotId ?? null,
      text: payload.query?.question ?? payload.query?.text ?? null, searchText: payload.query?.text ?? null, language: request.language ?? payload.query?.language ?? null,
      role: userRole(request.body), promptVersion: promptVersion(request), answerVersion: request.answerVersion ?? payload.answerVersion ?? null,
      profile: profile?.id ?? null, generation: request.generationId ?? packet.generation_id ?? null,
      lean: payload.lean?.version ? { at: payload.lean.at ?? null } : null,
      // Why a turn did not finish: its error code and, for an answer the validation refused, where and the refused text.
      failure: row?.state !== 'completed' && (payload.error || payload.responseAudit?.validation?.valid === false) ? { error: payload.error ?? null,
        validation: payload.responseAudit?.validation?.valid === false ? { code: payload.responseAudit.validation.code ?? null,
          path: payload.responseAudit.validation.path ?? null, received: payload.responseAudit.validation.received ?? null } : null } : null },
    plan: assist ? { queries: assist.queries || [], places: assist.places || [], plannedPlaces: assist.plannedPlaces || [], person: assist.person ?? null,
      language: assist.language ?? null, failures: assist.failures || [], greeting: Boolean(assist.greeting), thanks: Boolean(assist.thanks),
      assistantQuestion: Boolean(assist.assistantQuestion), changePlaces: assist.changePlaces ?? null } : null,
    stages: stages(payload.events), phases: payload.timings?.phases || null, searchTimings: payload.timings?.search || null,
    lanes: (packet.retrieval_context?.lanes || []).map(lane => {
      const audit = audits.get(lane.key);
      return { key: lane.key, kind: lane.kind, state: lane.state, refs: lane.refs || [], coverage: lane.coverage ?? null,
        candidateCounts: audit?.measurements?.candidate_counts ?? null, leftOut: audit?.left_out ?? null, warnings: audit?.warnings || [] };
    }),
    laneAudit: Boolean(request.laneAudit),
    pool, evidence,
    additions: knowledge ? Object.fromEntries(['cross_references', 'question_references', 'named_act_references', 'companion_provisions', 'list_continuations',
      'dependency_additions'].filter(name => knowledge.measurements?.[name] !== undefined).map(name => [name, knowledge.measurements[name]])) : null,
    records: packet.record_context ? { region: packet.record_context.region ?? null, view: packet.record_context.view ?? null,
      scope: scopeSummary(packet.record_context.scope),
      catalogue: packet.record_context.catalogue_count ?? null, listed: packet.record_context.listed_count ?? null,
      entries: (packet.record_context.entries || []).map(entry => ({ key: entry.key, kind: entry.kind, detail: entry.detail,
        title: value(entry.fields?.title) ?? value(entry.fields?.name) ?? null })) } : null,
    answer: answer ? { kind: answer.kind ?? null, blocks: (answer.blocks || []).map(block => ({ text: block.text, refs: block.refs || [] })),
      limitations: answer.limitations || [], clarification: answer.clarification ?? null,
      // ADR-160: what the server repaired in the model's answer before it was published.
      repairs: Array.isArray(payload.answerRepair?.repairs) ? payload.answerRepair.repairs : [] } : null,
    request: request.body ? { model: request.body.model ?? null, reasoning: request.body.reasoning?.effort ?? null, maxOutput: request.body.max_output_tokens ?? null,
      instructions: request.body.instructions ?? null, developer: developerTexts(request.body),
      evidenceChars: JSON.stringify(packet.model_context ?? null).length, modelContext: packet.model_context ?? null } : null,
    profile: query ? { id: profile.id, method: query.method ?? null, weights: query.channelWeights ?? null, finalLimit: query.finalLimit ?? null,
      limits: query.limits ?? null, rrf: profile.generation_requirements?.rrf_constant ?? null,
      lanes: Object.fromEntries(['graph', 'semanticGraph', 'references', 'namedActs', 'referenceSubsections'].map(name => [name, Boolean(query[name])])) } : null,
  };
}
