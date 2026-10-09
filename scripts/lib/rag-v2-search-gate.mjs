// The search gate (ADR-122, 10.10.2026): the rules of the free check that tells, before a release, whether search got
// worse. No I/O of its own: the one question it replays goes through the adapters it is handed. The command is
// scripts/rag-v2-search-gate.mjs.
//
// Until now a change to search was checked by a paid conversation run started by hand, or by a probe written for that
// one change (docs/audits/rag-v2-heading-passages-2026-10-03-probes.mjs). Here a fixed set of questions with saved
// query vectors goes through the chat's own search, a hook stands in place of the selection model, and what comes back
// is kept as a row and compared with the same question's row of an earlier run.
//
// A row can be kept and shown anywhere: beside the question's id it holds only hashes, places, counts and times. No
// question, passage or title, and no record or document id, is in it in clear.
//   pool              the candidates the selection model would read, in their order: [text hash, title hash] of each
//                     (the text is the indexed one, heading path and body; sha256, first 16 hex)
//   reserve_from      the first place of the national-law reserve (ADR-032), when the packet's rerank audit names it
//   largest_document  how many places the title with the most candidates takes
//   deciding          for each deciding phrase of the catalogue, the place of the first candidate that holds it, or null
//   fallback          the evidence of a turn whose selection model failed (the hook returns null, so the seeds follow
//                     the fused order): the hashes of its excerpts (the body alone, so not a pool hash), and the tokens
//                     of the whole context
//   records           the municipal catalogue: region, view, counts, entries by detail, contacts as a count
//   ms                the search, and each lane's own time (lanes run side by side)
//
// A verdict per question, the gravest first:
//   error           the present run could not search it                                   exit 20
//   deciding_lost   a deciding passage that was among the candidates no longer is         exit 20
//   deciding_worse  a deciding passage stands later among them                            exit 10
//   changed         candidates entered or left or moved, the largest document's places,
//                   the fallback evidence or the catalogue differ                         exit 10
//   not_compared    the question, its vectors or its presence differ between the runs     exit 10
//   better          a deciding passage came among the candidates or stands earlier, none
//                   stands later, and the catalogue is as it was                          exit 0
//   same, skipped   nothing differs; neither run had the vectors                          exit 0
import { hash, stable } from '../../lib/rag-v2/contracts.js';
import { acceptDialogue, buildDialogueQuery } from '../../lib/rag-v2/pilot/dialogue.js';
import { REGION_STATE_VERSION } from '../../lib/rag-v2/pilot/dialogue-state.js';
import { INTERPRETATION, USER_PERSON } from '../../lib/rag-v2/pilot/record-scope.js';
import { SEARCH_ASSIST_VERSION, validateQueryPlan } from '../../lib/rag-v2/pilot/search-assist.js';
import { RECORD_RETRIEVAL_VERSION } from '../../lib/rag-v2/search/structured-record-source.js';

export const GATE_RUN_VERSION = 'rag-v2/search-gate-run-1';
// What decides a search beside the code under test. Two runs that differ in one of these are not compared unless the
// caller allows that difference by name. A plan's configHash is not here: every release renews the plan.
export const DECIDES = Object.freeze(['generation', 'documents', 'profile', 'recordCatalogue', 'searchAssist', 'embedding', 'date']);
export const VERDICTS = Object.freeze(['error', 'deciding_lost', 'deciding_worse', 'changed', 'not_compared', 'better', 'same', 'skipped']);
const RECORD_FIELDS = ['region', 'view', 'catalogue_count', 'listed_count', 'relevant_summaries', 'completeness', 'details', 'contacts'];
const short = text => hash(String(text ?? '')).slice(0, 16), spaced = text => text.replace(/\s+/gu, ' ');

/**
 * fetch for the gate's process: a request to Qdrant's origin passes, any other host throws before anything is sent, so
 * no code the gate loads can reach a model or buy an embedding. The origin is read at each call (the application's own
 * modules may load the env file after the guard is set), and a redirect is an error, so an answer cannot lead elsewhere.
 */
export function qdrantOnly(network, qdrantUrl) {
  const origin = value => { try { return new URL(value?.url ?? value).origin; } catch { return null; } };
  return async (input, init) => {
    const target = origin(input);
    if (!target || target !== origin(qdrantUrl())) throw Object.assign(new Error('search_gate_network_refused'), { code: 'search_gate_network_refused' });
    return network(input, { ...init, redirect: 'error' });
  };
}

// A catalogue's queries stand in for the search plan, so each must be one the plan's own check keeps as written.
function planned(question) {
  try { return Array.isArray(question.queries) && stable(validateQueryPlan({ queries: question.queries }, question.text)) === stable(question.queries); } catch { return false; }
}
/**
 * The questions that cannot be replayed, by id; none for a catalogue the gate takes. The schema is the graph
 * catalogues' (tests/evaluation/graph): id, text, up to three queries, the deciding phrases (evidence_text; a question
 * may have none) and the municipality (region) of a question about one. An id names a row, so it is used once among
 * all the questions given. A catalogue's date is not read: the chat's search reads today's.
 */
export function validateGateCatalogue(catalogue) {
  if (!Array.isArray(catalogue?.questions) || !catalogue.questions.length) return ['questions'];
  const problems = [], seen = new Set();
  for (const question of catalogue.questions) {
    const phrases = question?.evidence_text ?? [];
    if (!question || !/^[a-z0-9-]+$/u.test(question.id || '') || seen.has(question.id) || typeof question.text !== 'string' || !question.text || question.text.trim() !== question.text
      || !planned(question) || !Array.isArray(phrases) || phrases.some(phrase => typeof phrase !== 'string' || !phrase.trim())
      || question.region !== undefined && !/^[a-z_]+$/u.test(question.region)) problems.push(question?.id || '?');
    seen.add(question?.id);
  }
  return problems;
}

/**
 * The plan as the release of the code under test will have it. A release renews the approved plan in what the code
 * decides (ADR-037, chat-plan.js codeContract); of those fields these three are the search's (the catalogue, the state
 * version that says how places are read, and the search assist the gate's queries and hook stand in for), and with
 * unchanged code they are the plan's own. The gate reads the live plan under changed code: an overlay that raises the
 * catalogue's version would otherwise not be measured at all, because the adapter refuses every question that names no
 * municipality as a plan of another catalogue (record_catalogue_not_configured). A run names the versions it searched with.
 */
export const releasedPlan = config => ({ ...config, dialogueStateVersion: REGION_STATE_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION, searchAssist: SEARCH_ASSIST_VERSION });

/** The query of a conversation's first message, built by the service's own two steps (service.js: the accepted context,
 *  then the query with no earlier answer and no saved state), in Estonian as the catalogues are. */
export function gateQuery(question, config) {
  const accepted = acceptDialogue(config, { question: question.text, contextMode: 'new' }, [], null, `gate-${question.id}`);
  return { ...buildDialogueQuery(accepted, config, null, null), language: 'et' };
}
/** The scope a first message gets when its plan's queries name the municipality (record-scope.js); here the catalogue names it. */
export const forcedScope = region => ({ state: 'search_plan_region', region, person: USER_PERSON, interpretation: INTERPRETATION });

/** One hash of everything a question's replay starts from: its text, queries, municipality, deciding phrases and saved
 *  vectors. A run keeps it beside its rows, so an edited question or a vector bought again is not read as a change of search. */
export const questionInput = (question, vectors) => short(stable({ text: question.text, queries: question.queries, region: question.region ?? null,
  evidence_text: question.evidence_text ?? [], vectors: [question.text, ...question.queries].map(text => hash(JSON.stringify(vectors.get(text) ?? null))) }));
/** A run's values of DECIDES, from the plan as it was read and the Estonian calendar date (legal validity reads today's date). */
export const searchIdentity = (config, date) => ({ generation: config.generationId, documents: hash(stable(config.documents)), profile: config.profileId,
  recordCatalogue: config.recordCatalogue ?? null, searchAssist: config.searchAssist ?? null, embedding: hash(stable(config.embedding)), date });

/** What the knowledge search left: the candidates the hook received, and the evidence of the knowledge and period lanes. */
export function observeKnowledge(question, pool, packet) {
  const texts = pool.map(passage => spaced(passage.text)), titles = pool.map(passage => short(passage.title)), perTitle = new Map();
  for (const title of titles) perTitle.set(title, (perTitle.get(title) || 0) + 1);
  // Which candidates are the reserve's only the lane's own audit says (retrieval.js: rerank.candidates and reserved). The
  // packet the chat's search returns is the merged one and carries no such audit today; the place is then null.
  const reserved = new Set(packet.rerank?.reserved || []), reserveAt = (packet.rerank?.candidates || []).findIndex(unit => reserved.has(unit));
  // The lanes say whose each excerpt is. A municipal record's excerpt may be a contact's own text: never hashed.
  const refs = new Set((packet.retrieval_context?.lanes || []).filter(lane => lane.kind !== 'local_records').flatMap(lane => lane.refs));
  return { pool: pool.map((passage, index) => [short(passage.text), titles[index]]), reserve_from: reserveAt < 0 ? null : reserveAt + 1,
    largest_document: Math.max(0, ...perTitle.values()),
    deciding: (question.evidence_text ?? []).map(phrase => { const at = texts.findIndex(text => text.includes(spaced(phrase))); return at < 0 ? null : at + 1; }),
    fallback: { evidence: (packet.evidence || []).filter((_, index) => refs.has(`S${index + 1}`)).map(entry => short(entry.source_text)),
      // The count a budget reads: annotations (an act's dates, a passage's provision label) are outside it, and a change in them
      // is not a change in what the search found.
      context_tokens: packet.measurements?.budget_context_tokens ?? packet.measurements?.model_context_tokens ?? null } };
}

/** What the municipal catalogue showed, in counts: which municipality, which view, how many records and summaries, the
 *  entries by their detail and how many of them are contacts. Null when the search has no catalogue. */
export function observeRecords(packet) {
  const context = packet.record_context;
  if (!context) return null;
  const details = {};
  for (const entry of context.entries || []) details[entry.detail] = (details[entry.detail] || 0) + 1;
  return { region: context.region ?? null, view: context.view ?? null, catalogue_count: context.catalogue_count ?? null, listed_count: context.listed_count ?? null,
    relevant_summaries: context.relevant_summaries ?? null, completeness: context.completeness ?? null, details,
    contacts: (context.entries || []).filter(entry => entry.kind === 'contact').length };
}

/** A searched question's row of a run. */
export function gateRow(question, pool, packet) {
  const lanes = Object.entries(packet.search_timings?.lanes || {}).map(([lane, times]) => [lane, times.lane ?? null]);
  return { id: question.id, state: 'ok', ...observeKnowledge(question, pool, packet), records: observeRecords(packet),
    ms: { search: packet.search_timings?.since_start_ms?.merged ?? null, ...Object.fromEntries(lanes) } };
}

/**
 * One question through the chat's search (adapters.unifiedSearch), as a first message whose plan gave the catalogue's
 * queries and no places: the place check with an empty list, then the search, in the service's order. The vectors are
 * the saved ones; a question without all of them is skipped and nothing is embedded. The hook keeps the candidates and
 * selects nothing. A question that names its municipality is searched there, for this call only: where a turn's
 * municipality comes from is not what the gate judges.
 */
export async function replayQuestion(adapters, config, question, vectors) {
  if ([question.text, ...question.queries].some(text => !vectors.has(text))) return { id: question.id, state: 'skipped_no_vector' };
  let pool = [];
  try {
    const query = gateQuery(question, config), scope = question.region ? forcedScope(question.region) : null;
    query.places = await adapters.checkedPlaces(config, query, []);
    const search = scope ? Object.assign(Object.create(adapters), { searchScope: async () => ({ scope, knowledgeRegion: scope }) }) : adapters;
    const packet = await search.unifiedSearch(config, query, vectors.get(question.text), { variants: question.queries,
      vectors: new Map(question.queries.map(text => [text, vectors.get(text)])), rerank: async passages => { pool = passages; return null; } });
    return gateRow(question, pool, packet);
  } catch (error) {
    // The code alone: an error's message may quote what it failed on.
    return { id: question.id, state: 'error', error: String(error?.code || error?.name || 'search_failed').slice(0, 80) };
  }
}

// How many of a list have no counterpart in the other. A text that stands twice counts twice: two versions of an act
// may share a passage word for word.
function without(list, other) {
  const left = new Map();
  for (const key of other) left.set(key, (left.get(key) || 0) + 1);
  return list.filter(key => { const open = left.get(key) || 0; left.set(key, open - 1); return open < 1; }).length;
}

/** One question's verdict: its row of the present run against its row of the baseline (either may be missing). */
export function compareRow(baseline, present) {
  const id = (present || baseline).id;
  if (!present) return { id, verdict: 'not_compared', reason: 'only_in_baseline' };
  if (present.state === 'error') return { id, verdict: 'error', error: present.error };
  if (present.state !== 'ok' || baseline?.state !== 'ok') return { id, verdict: baseline?.state === present.state ? 'skipped' : 'not_compared',
    reason: present.state !== 'ok' ? present.state : baseline ? `baseline_${baseline.state}` : 'no_baseline' };
  const before = baseline.pool.map(([text]) => text), after = present.pool.map(([text]) => text);
  const deciding = present.deciding.map((place, index) => ({ before: baseline.deciding[index] ?? null, after: place }));
  const lost = deciding.some(item => item.before && !item.after), worse = deciding.some(item => item.before && item.after > item.before);
  const better = deciding.some(item => item.after && (!item.before || item.after < item.before));
  const entered = without(after, before), left = without(before, after), moved = after.filter((text, index) => text !== before[index]).length;
  const kept = { entered: without(present.fallback.evidence, baseline.fallback.evidence), left: without(baseline.fallback.evidence, present.fallback.evidence) };
  const tokens = [baseline.fallback.context_tokens, present.fallback.context_tokens];
  const knowledge = { ...(entered || left ? { candidates: { entered, left } } : moved ? { moved } : {}),
    ...(baseline.largest_document !== present.largest_document ? { largest_document: [baseline.largest_document, present.largest_document] } : {}),
    ...(kept.entered || kept.left || tokens[0] !== tokens[1] ? { fallback: { ...kept, context_tokens: tokens } } : {}) };
  const records = Object.fromEntries(RECORD_FIELDS.filter(key => stable(baseline.records?.[key]) !== stable(present.records?.[key]))
    .map(key => [key, [baseline.records?.[key] ?? null, present.records?.[key] ?? null]]));
  const catalogue = Object.keys(records).length > 0;
  // A deciding passage that came or moved up brought other candidates in and out with it: that alone is no finding.
  // The catalogue is another lane, and its change is one whatever the knowledge lane did.
  const verdict = lost ? 'deciding_lost' : worse ? 'deciding_worse' : catalogue || Object.keys(knowledge).length && !better ? 'changed' : better ? 'better' : 'same';
  return { id, verdict, deciding, ...knowledge, ...(catalogue ? { records } : {}) };
}

/** Why two runs are not compared: the values of DECIDES that differ and that the caller did not allow by name. */
export function refusal(baseline, present, allow = []) {
  if (baseline?.schema_version !== GATE_RUN_VERSION || present?.schema_version !== GATE_RUN_VERSION) {
    return [{ key: 'schema_version', baseline: baseline?.schema_version ?? null, present: present?.schema_version ?? null }];
  }
  return DECIDES.filter(key => !allow.includes(key) && stable(baseline.search?.[key]) !== stable(present.search?.[key]))
    .map(key => ({ key, baseline: baseline.search?.[key] ?? null, present: present.search?.[key] ?? null }));
}

const middle = (rows, key) => { const list = rows.map(row => row.ms?.[key]).filter(Number.isFinite).sort((a, b) => a - b); return list.length ? list[Math.floor(list.length / 2)] : null; };
/**
 * The present run against the baseline: a refusal (exit 2), or a verdict per question and a summary with the exit code:
 * 0 the same or better, 10 differences to read, 20 a deciding passage lost or an error. Runs in which no question could
 * be judged are refused too: an exit 0 would say that search is as it was.
 */
export function compareRuns(baseline, present, { allow = [] } = {}) {
  const refused = refusal(baseline, present, allow);
  if (refused.length) return { ok: false, exit: 2, refused };
  const earlier = new Map(baseline.rows.map(row => [row.id, row])), replayed = new Set(present.rows.map(row => row.id));
  const rows = [...present.rows.map(row => (row.state === 'ok' && earlier.get(row.id)?.state === 'ok' && baseline.inputs?.[row.id] !== present.inputs?.[row.id]
    ? { id: row.id, verdict: 'not_compared', reason: 'question_changed' } : compareRow(earlier.get(row.id), row))),
  ...baseline.rows.filter(row => !replayed.has(row.id)).map(row => compareRow(row))];
  const counts = Object.fromEntries(VERDICTS.map(verdict => [verdict, rows.filter(row => row.verdict === verdict).length]));
  if (rows.length === counts.skipped + counts.not_compared) return { ok: false, exit: 2, refused: [{ key: 'nothing_compared', baseline: baseline.rows.length, present: present.rows.length }] };
  return { ok: true, exit: counts.error || counts.deciding_lost ? 20 : counts.deciding_worse || counts.changed || counts.not_compared ? 10 : 0,
    allowed: DECIDES.filter(key => stable(baseline.search?.[key]) !== stable(present.search?.[key])),
    summary: { questions: rows.length, ...counts, median_search_ms: { baseline: middle(baseline.rows, 'search'), present: middle(present.rows, 'search') } }, rows };
}
