// ADR-125 (10.10.2026): how the chat's turns end and what the running plan has left, in numbers only (no question,
// answer, passage, title or user). Before this nothing read the plan's spending ledger, counted the turns that failed
// or said how long a turn takes; when a plan's lifetime budget ran out, users were told "too many requests" and nothing
// was logged. The storage report (storage-report.js) says what the chat takes on disk; this one says how its turns go.
// It reads no database itself: the caller hands it rows, receipts and the ledger, so it runs the same in a test.
//   turnFacts         what the report keeps of one turn's row: closed labels and numbers
//   chatHealthReport  the counts per day (Estonia's calendar day of the turn's start) and in total, the provider
//                     calls' receipts the same way, and the plan's caps against its ledger
import { estonianDate } from '../search/legal-validity.js';

const KINDS = Object.freeze(['grounded', 'partial', 'clarification', 'unsupported']);
// A count's key is a state, a code or a name the turn's own code wrote. Whatever else stands in such a field is counted
// as 'other', so no stored text can become a key of the report. A number is a DOMException's code, which the search
// assist records as it is: 23 is a provider call that passed its time limit, 20 one that was aborted.
const label = value => (Number.isInteger(value) ? String(value) : typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value) ? value : 'other');
const count = (counts, key) => { counts[key] = (counts[key] || 0) + 1; };
const amount = value => (typeof value === 'bigint' ? Number(value) : Number.isFinite(value) ? value : 0);
const dayOf = value => { const at = new Date(value); return Number.isNaN(at.getTime()) ? 'unknown' : estonianDate(at); };
// The median is the middle value (of an even number of values, the mean of the two middle ones). The 95th percentile
// is the nearest rank: the smallest value that 95% of the values do not exceed; of fewer than 20 values, the largest.
const spread = values => {
  if (!values.length) return { n: 0, median: null, p95: null };
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return { n: sorted.length, median: Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2), p95: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]) };
};

/** What the report keeps of one turn. row: a turn's row as openTurn gives it, or read without its large parts (the
 *  packet, the request and the vector): nothing here reads them, nor the question, the answer's text or the user. */
export function turnFacts(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  // A lean row (lean-turn.js) kept its answer, costs and times, and of the search assist only the places and the person.
  const lean = payload.lean !== undefined && payload.lean !== null, assist = lean ? null : payload.searchAssist;
  const events = Array.isArray(payload.events) ? payload.events : [], failures = Array.isArray(assist?.failures) ? assist.failures : [];
  // A greeting or a thank-you asks for no plan and no selection (ADR-067, ADR-120): it is counted as its route only.
  const route = assist?.greeting === true ? 'greeting' : assist?.thanks === true ? 'thanks' : null, searched = !lean && !route;
  const failed = stage => failures.some(item => item?.stage === stage);
  const queries = Array.isArray(assist?.queries) ? assist.queries.length : 0, kept = Array.isArray(assist?.rerank?.selected) ? assist.rerank.selected.length : null;
  const phases = payload.timings?.phases && typeof payload.timings.phases === 'object' ? payload.timings.phases : {};
  const reserved = key => Math.max(0, ...events.map(event => event?.reservation?.[key]).filter(Number.isFinite));
  return { day: dayOf(row?.createdAt), state: label(row?.state), lean, route,
    // A completed turn may still carry the code of a publication that failed first and was then recovered: it did not fail.
    error: row?.state !== 'completed' && payload.error !== undefined && payload.error !== null ? label(payload.error) : null,
    // A turn ends 'unknown' when a call was sent and no response came back: its time limit passed, or the process was
    // lost. The turn's own error code does not say so (a timeout is saved as 'pilot_failed'); the call's stage does.
    unanswered: row?.state !== 'unknown' ? [] : events.filter(event => event?.state === 'sent_unknown').map(event => label(event.stage)),
    kind: row?.state !== 'completed' ? null : KINDS.includes(payload.answer?.kind) ? payload.answer.kind : 'other',
    // The same holds for the validation record: a publication that failed and was recovered leaves its code there.
    validation: !['completed', 'needs_recovery'].includes(row?.state) && payload.responseAudit?.validation?.valid === false ? label(payload.responseAudit.validation.code) : null,
    // Without a record of the search assist the turn ended before its search did, or its plan has no search assist.
    plan: !searched ? null : !assist ? 'not_recorded' : failed('plan') ? 'failed' : ['no_query', '1_query', '2_queries', '3_queries'][queries] ?? 'more',
    // 'not_run': the search called no selection (it had no passage to choose among).
    selection: !searched ? null : !assist ? 'not_recorded' : failed('rerank') ? 'failed' : kept === null ? 'not_run' : kept === 0 ? 'nothing' : kept <= 2 ? '1-2' : kept <= 5 ? '3-5' : kept <= 9 ? '6-9' : 'more',
    assistFailures: failures.map(item => [label(item?.stage), label(item?.code)]),
    phases: Object.fromEntries(Object.entries(phases).filter(([, ms]) => Number.isFinite(ms) && ms >= 0).map(([name, ms]) => [label(name), ms])),
    whole: Number.isFinite(payload.timings?.validatedDraftMs) ? payload.timings.validatedDraftMs : null,
    reserved: { tokens: reserved('tokens'), nanoUsd: reserved('nanoUsd') } };
}

function turnTally() {
  const out = { turns: 0, by_state: {}, failed_by_code: {}, calls_without_response: {}, answers_by_kind: Object.fromEntries(KINDS.map(kind => [kind, 0])), validation_failures_by_code: {},
    lean: 0, routes: { greeting: 0, thanks: 0 }, search_plan: { failed: 0, no_query: 0, '1_query': 0, '2_queries': 0, '3_queries': 0 }, selection: { failed: 0, nothing: 0, '1-2': 0, '3-5': 0, '6-9': 0 },
    search_assist_failures: {}, largest_reservation: { tokens: 0, nanoUsd: 0 } };
  const phases = {}, whole = [];
  return { add(fact) {
    out.turns++; count(out.by_state, fact.state);
    if (fact.error) count(out.failed_by_code, fact.error);
    for (const stage of fact.unanswered) count(out.calls_without_response, stage);
    if (fact.kind) count(out.answers_by_kind, fact.kind);
    if (fact.validation) count(out.validation_failures_by_code, fact.validation);
    if (fact.lean) out.lean++;
    if (fact.route) out.routes[fact.route]++;
    if (fact.plan) count(out.search_plan, fact.plan);
    if (fact.selection) count(out.selection, fact.selection);
    for (const [stage, code] of fact.assistFailures) count(out.search_assist_failures[stage] ||= {}, code);
    for (const [name, ms] of Object.entries(fact.phases)) (phases[name] ||= []).push(ms);
    if (fact.whole !== null) whole.push(fact.whole);
    for (const key of ['tokens', 'nanoUsd']) out.largest_reservation[key] = Math.max(out.largest_reservation[key], fact.reserved[key]);
  }, done: () => ({ ...out,
    // A phase's time is the milliseconds from the turn's start to the end of that phase (service.js, `reached`), not the
    // phase's own length. The whole turn is from its start to its checked answer, before the write that publishes it;
    // only a turn that got that far has one.
    since_start_ms: { phases: Object.fromEntries(Object.entries(phases).map(([name, values]) => [name, spread(values)])), whole_turn: spread(whole) } }) };
}

// The receipts as the cost snapshot reads them (lib/usage/costSnapshot.js): what was billed, and what is still only
// reserved because the call's outcome is not known. A call that was never sent ('not_sent') cost nothing.
function callTally() {
  const out = { calls: 0, by_stage: {}, by_state: {}, billed_nano_usd: 0, reserved_unsettled_nano_usd: 0, largest_reserved_nano_usd: 0 };
  return { add(receipt) {
    out.calls++; count(out.by_stage, label(receipt?.stage)); count(out.by_state, label(receipt?.state));
    out.billed_nano_usd += amount(receipt?.billedNanoUsd); out.largest_reserved_nano_usd = Math.max(out.largest_reserved_nano_usd, amount(receipt?.reservedNanoUsd));
    if (['reserved', 'sent', 'unknown'].includes(receipt?.state)) out.reserved_unsettled_nano_usd += amount(receipt?.reservedNanoUsd);
  }, done: () => out };
}

function perDay(items, day, tally) {
  const total = tally(), days = new Map();
  for (const item of items) {
    const key = day(item);
    if (!days.has(key)) days.set(key, tally());
    total.add(item); days.get(key).add(item);
  }
  return { total: total.done(), by_day: Object.fromEntries([...days].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, one]) => [key, one.done()])) };
}

/** The running plan's caps against its ledger: each cap, what is used, what is left and the share used.
 *  budget: the plan's `budget`; ledger: the plan's M4PilotLedger row (contracts.js budgetLedgerId says which one a plan
 *  spends against), null when no call was reserved under it yet; largest: the largest single reservation among the
 *  turns and receipts read. `refusing` lists the caps a next call no longer fits under. A call is reserved by its
 *  upper bound before it is sent (store.js, reserve), so tokens and money refuse while something is still left: when
 *  less is left than one call reserves. An attempt counter refuses when nothing is left. */
export function ledgerUse(budget, ledger, largest = {}) {
  const caps = Object.fromEntries(Object.entries(budget || {}).filter(([, cap]) => Number.isFinite(cap)));
  // A plan names no cap for the search plan and the selection: each has twice the answers' attempts (store.js, reserve).
  if (Number.isFinite(caps.answerAttempts)) for (const key of ['planAttempts', 'rerankAttempts']) caps[key] ??= caps.answerAttempts * 2;
  const totals = ledger?.totals && typeof ledger.totals === 'object' ? ledger.totals : {}, lines = {}, refusing = [];
  for (const [key, cap] of Object.entries(caps)) {
    // Without a ledger row nothing is used yet. A ledger that lacks a counter (an old one) has no number to give.
    const used = !ledger ? 0 : Number.isFinite(totals[key]) ? totals[key] : null, left = used === null ? null : cap - used;
    lines[key] = { cap, used, left, share: used === null || cap <= 0 ? null : Math.round(used / cap * 10000) / 10000 };
    if (left !== null && left < (largest[key] > 0 ? largest[key] : 1)) refusing.push(key);
  }
  const written = new Date(ledger?.updatedAt ?? Number.NaN);
  return { started: Boolean(ledger), updated_at: Number.isNaN(written.getTime()) ? null : written.toISOString(), caps: lines, refusing };
}

/** turns: turnFacts of the rows read; receipts: the provider calls' receipts of the same days (AiProviderCall rows:
 *  stage, state, reservedNanoUsd, billedNanoUsd, createdAt); budget and ledger as ledgerUse takes them (no budget: no
 *  ledger part); now: the moment of the report. */
export function chatHealthReport({ turns = [], receipts = [], budget = null, ledger = null, now = new Date() } = {}) {
  const tallied = perDay(turns, fact => fact.day, turnTally), calls = perDay(receipts, receipt => dayOf(receipt?.createdAt), callTally);
  // A receipt holds its call's reserved money too, and receipts are read where turns may not be (more than one account):
  // without them the ledger part could not say there that the money left is less than one call reserves.
  const largest = { tokens: tallied.total.largest_reservation.tokens, nanoUsd: Math.max(tallied.total.largest_reservation.nanoUsd, calls.total.largest_reserved_nano_usd) };
  return { at: now.toISOString(), turns: tallied, provider_calls: calls, ledger: budget ? ledgerUse(budget, ledger, largest) : null };
}
