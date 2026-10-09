import test from 'node:test';
import assert from 'node:assert/strict';
import { turnFacts, chatHealthReport, ledgerUse } from '../lib/rag-v2/pilot/health-report.js';
import { leanPayload } from '../lib/rag-v2/pilot/lean-turn.js';

// ADR-125 (10.10.2026): the report an operator reads to see how the chat's turns end and what the plan has left. Every
// row here is synthetic: an invented municipality, an invented person and example.invalid addresses.
const QUESTION = 'Kas Näidisvalla hooldekodu koht on Mari Maasikale liiga kallis?', ANSWER = 'Näidisvallas maksab hooldekodu koht 1200 eurot kuus.';
const LIMITATION = 'Ma ei saa selle teabe põhjal öelda, kui suur on omaosalus.', CLARIFICATION = 'Kas ta elab Näidisvallas või Proovilinnas?';
const QUERY = 'hooldekodu kohatasu ja omaosalus', TITLE = 'Näidisvalla hooldekodu hinnakiri', LEAD = 'Kohatasu kinnitab vallavalitsus kord aastas';
const TEXTS = [QUESTION, ANSWER, LIMITATION, CLARIFICATION, QUERY, TITLE, LEAD, 'Mari Maasikas', 'Näidisva', 'Proovilinn', 'mari@example.invalid', 'user-synthetic', 'conv-synthetic', 'turn-synthetic', 'proj_synthetic'];

let serial = 0;
const turn = (at, state, ...parts) => ({ id: `turn-synthetic-${++serial}`, chatTurnId: `chat-turn-synthetic-${serial}`, pilotId: 'm4-synthetic', state, createdAt: new Date(at), updatedAt: new Date(at),
  payload: Object.assign({ question: QUESTION, contextMode: 'new', tenant: 'synthetic', userId: 'user-synthetic-7', convId: 'conv-synthetic-7', inputLanguage: 'et', events: [],
    contextAudit: { userTurns: [{ turnId: 'turn-synthetic-0', text: QUESTION }] }, dialogue: { user: QUESTION, contact: 'mari@example.invalid' } }, ...parts) });
const answered = kind => ({ answer: { kind, blocks: ['grounded', 'partial'].includes(kind) ? [{ text: ANSWER, factual: true, refs: ['S1'] }] : [],
  limitations: ['partial', 'unsupported'].includes(kind) ? [LIMITATION] : [], clarification: kind === 'clarification' ? CLARIFICATION : null },
responseAudit: { draft: { text: ANSWER }, validation: { valid: true, code: 'validated' } } });
// A turn's record of its search assist as the service saves it: the plan's queries, the selection's candidates and choice.
const assist = (queries, selected, extra = {}) => ({ searchAssist: { version: 'rag-v2/search-assist-13', queries: Array.from({ length: queries }, (_, at) => `${QUERY} ${at}`),
  rerank: selected === null ? null : { candidates: [{ id: 'p0', title: TITLE, lead: LEAD }], selected: Array.from({ length: selected }, (_, at) => `p${at}`) }, failures: [],
  places: [{ name: 'Näidisvald', person: 'Mari Maasikas' }], ...extra } });
const timed = (phases, whole = null) => ({ timings: { phases, ...(whole === null ? {} : { validatedDraftMs: whole }) } });
const reservation = (stage, state, tokens, nanoUsd) => ({ stage, state, reservation: { tokens, nanoUsd }, bodyHash: 'synthetic' });
const report = (rows, rest = {}) => chatHealthReport({ turns: rows.map(turnFacts), now: new Date('2026-10-10T09:00:00Z'), ...rest });

// Two days of turns in Estonia's calendar: 21:30 UTC on the 8th is half past midnight on the 9th in Tallinn.
const DAY_ONE = '2026-10-08T09:00:00Z', DAY_TWO = '2026-10-08T21:30:00Z';
const rows = () => [
  turn(DAY_ONE, 'completed', answered('grounded'), assist(2, 4), timed({ planned: 1000, embedded: 1500, searched: 5000, first_text: 7000, answered: 12000 }, 12400),
    { events: [reservation('plan', 'response_received', 9000, 5000000), reservation('answer', 'response_received', 60000, 15000000)] }),
  turn(DAY_ONE, 'completed', answered('partial'), assist(3, 7), timed({ planned: 2000, embedded: 2600, searched: 6000, answered: 14000 }, 14500)),
  turn(DAY_ONE, 'completed', answered('clarification'), assist(0, 0)),
  turn(DAY_ONE, 'completed', answered('unsupported'), assist(1, 2)),
  turn(DAY_ONE, 'completed', answered('grounded'), assist(1, null)),
  turn(DAY_ONE, 'completed', answered('clarification'), assist(0, null, { greeting: true })),
  turn(DAY_ONE, 'completed', answered('clarification'), assist(0, null, { thanks: true })),
  // A timed-out plan (a DOMException's numeric code) and a failed selection left the turn on the plain search; its answer was then rejected.
  turn(DAY_TWO, 'answer_rejected', assist(0, null, { failures: [{ stage: 'plan', code: 23 }, { stage: 'rerank', code: 'provider_http_error' }] }),
    { error: 'invalid_answer_reference', responseAudit: { draft: { text: ANSWER }, validation: { valid: false, code: 'invalid_answer_reference', received: { text: ANSWER } } } }),
  turn(DAY_TWO, 'unknown', assist(2, 5), { error: 'pilot_failed', events: [reservation('embedding', 'response_received', 40, 5200), reservation('answer', 'sent_unknown', 90000, 20000000)] }),
  turn(DAY_TWO, 'stopped', { error: 'pilot_budget_exhausted' }),
  // Still running: its sent call is in flight, not lost.
  turn(DAY_TWO, 'plan_sent', { events: [reservation('plan', 'sent_unknown', 9000, 5000000)] }),
  // Published after a publication that failed first: the old code stays in the row, the turn did not fail.
  turn(DAY_TWO, 'completed', answered('grounded'), assist(3, 9), { error: 'turn_superseded' }),
  // A row whose code fields hold text: counted, never printed.
  turn(DAY_TWO, 'stopped', { error: QUESTION, responseAudit: { validation: { valid: false, code: ANSWER } } }),
];

test('ADR-125: every count of the turns, in total and per day of Estonia\'s calendar', () => {
  const { turns } = report(rows());
  assert.deepEqual(turns.total, { turns: 13,
    by_state: { completed: 8, answer_rejected: 1, unknown: 1, stopped: 2, plan_sent: 1 },
    failed_by_code: { invalid_answer_reference: 1, pilot_failed: 1, pilot_budget_exhausted: 1, other: 1 },
    calls_without_response: { answer: 1 },
    answers_by_kind: { grounded: 3, partial: 1, clarification: 3, unsupported: 1 },
    validation_failures_by_code: { invalid_answer_reference: 1, other: 1 },
    lean: 0, routes: { greeting: 1, thanks: 1 },
    search_plan: { failed: 1, no_query: 1, '1_query': 2, '2_queries': 2, '3_queries': 2, not_recorded: 3 },
    selection: { failed: 1, nothing: 1, '1-2': 1, '3-5': 2, '6-9': 2, not_run: 1, not_recorded: 3 },
    search_assist_failures: { plan: { 23: 1 }, rerank: { provider_http_error: 1 } },
    largest_reservation: { tokens: 90000, nanoUsd: 20000000 },
    since_start_ms: { phases: { planned: { n: 2, median: 1500, p95: 2000 }, embedded: { n: 2, median: 2050, p95: 2600 }, searched: { n: 2, median: 5500, p95: 6000 },
      first_text: { n: 1, median: 7000, p95: 7000 }, answered: { n: 2, median: 13000, p95: 14000 } }, whole_turn: { n: 2, median: 13450, p95: 14500 } } });
  // The plan and the selection are counted for the turns that searched: all but the greeting and the thank-you.
  for (const part of ['search_plan', 'selection']) assert.equal(Object.values(turns.total[part]).reduce((sum, n) => sum + n, 0), 11, part);
  assert.deepEqual(Object.keys(turns.by_day), ['2026-10-08', '2026-10-09']);
  const [first, second] = Object.values(turns.by_day);
  assert.deepEqual([first.turns, first.by_state, first.failed_by_code, first.routes, first.answers_by_kind], [7, { completed: 7 }, {}, { greeting: 1, thanks: 1 }, { grounded: 2, partial: 1, clarification: 3, unsupported: 1 }]);
  assert.deepEqual([second.turns, second.by_state, second.answers_by_kind], [6, { answer_rejected: 1, unknown: 1, stopped: 2, plan_sent: 1, completed: 1 }, { grounded: 1, partial: 0, clarification: 0, unsupported: 0 }]);
  assert.deepEqual([second.failed_by_code, second.calls_without_response, second.search_plan.failed, second.selection['6-9'], second.since_start_ms.whole_turn],
    [{ invalid_answer_reference: 1, pilot_failed: 1, pilot_budget_exhausted: 1, other: 1 }, { answer: 1 }, 1, 1, { n: 0, median: null, p95: null }]);
  assert.deepEqual([first.largest_reservation, second.largest_reservation], [{ tokens: 60000, nanoUsd: 15000000 }, { tokens: 90000, nanoUsd: 20000000 }]);
  // Nothing to report is a report too, and a row that is no row does not stop it.
  const empty = report([]);
  assert.deepEqual([empty.turns.total.turns, empty.turns.by_day, empty.turns.total.since_start_ms, empty.ledger], [0, {}, { phases: {}, whole_turn: { n: 0, median: null, p95: null } }, null]);
  assert.deepEqual(report([null, {}, { state: 'completed', createdAt: 'no date', payload: 'text' }]).turns.by_day.unknown.by_state, { other: 2, completed: 1 });
});

test('ADR-125: the median and the 95th percentile of each phase and of the whole turn', () => {
  const day = (date, values) => values.map(ms => turn(`${date}T10:00:00Z`, 'completed', answered('grounded'), assist(1, 1), timed({ answered: ms, searched: ms / 2 }, ms + 100)));
  const steps = (count, step) => Array.from({ length: count }, (_, at) => (at + 1) * step);
  // Given out of order: 20 values on one day, 21 on the next, 100 on the third, one on the fourth.
  const { turns } = report([...day('2026-10-05', steps(20, 1000).reverse()), ...day('2026-10-06', steps(21, 100)), ...day('2026-10-07', steps(100, 10).reverse()), ...day('2026-10-08', [4200])]);
  const of = date => turns.by_day[date].since_start_ms;
  assert.deepEqual(of('2026-10-05'), { phases: { answered: { n: 20, median: 10500, p95: 19000 }, searched: { n: 20, median: 5250, p95: 9500 } }, whole_turn: { n: 20, median: 10600, p95: 19100 } });
  assert.deepEqual([of('2026-10-06').phases.answered, of('2026-10-06').whole_turn], [{ n: 21, median: 1100, p95: 2000 }, { n: 21, median: 1200, p95: 2100 }]);
  assert.deepEqual(of('2026-10-07').phases.answered, { n: 100, median: 505, p95: 950 });
  assert.deepEqual(of('2026-10-08').phases.answered, { n: 1, median: 4200, p95: 4200 });
  // All 142 together: the 71st and 72nd values are 650 and 660, the 135th is 13 000.
  assert.deepEqual(turns.total.since_start_ms.phases.answered, { n: 142, median: 655, p95: 13000 });
  // A time that is no number, or below zero, is left out; a phase the code did not name is counted under 'other'.
  const odd = report([turn(DAY_ONE, 'completed', answered('grounded'), timed({ answered: '12000', searched: -5, planned: null, [QUESTION]: 300 }, Number.NaN))]).turns.total.since_start_ms;
  assert.deepEqual(odd, { phases: { other: { n: 1, median: 300, p95: 300 } }, whole_turn: { n: 0, median: null, p95: null } });
});

test('ADR-125: lean rows are counted apart: they keep the answer and the times, not the search assist', () => {
  const packet = { tenant: 'synthetic', query_id: 'q', reference_map: {}, evidence: [] };
  const whole = (kind, record) => ({ ...turn(DAY_ONE, 'completed', answered(kind), record, timed({ searched: 900, answered: 3000 }, 3100)).payload, packet });
  // The real lean form of a greeting turn and of a searched turn (lean-turn.js): the route and the plan's queries are gone.
  const lean = [whole('clarification', assist(0, null, { greeting: true })), whole('grounded', assist(3, 6))].map(payload => ({ state: 'completed', createdAt: new Date(DAY_ONE), payload: leanPayload(payload, new Date(DAY_TWO)) }));
  assert.deepEqual(lean.map(row => Object.keys(row.payload.searchAssist)), [['places'], ['places']]);
  const { total } = report([...lean, turn(DAY_ONE, 'completed', answered('partial'), assist(2, 3), timed({ searched: 1100, answered: 5000 }, 5200))]).turns;
  assert.deepEqual([total.turns, total.lean, total.routes, total.answers_by_kind], [3, 2, { greeting: 0, thanks: 0 }, { grounded: 1, partial: 1, clarification: 1, unsupported: 0 }]);
  assert.deepEqual([total.search_plan, total.selection], [{ failed: 0, no_query: 0, '1_query': 0, '2_queries': 1, '3_queries': 0 }, { failed: 0, nothing: 0, '1-2': 0, '3-5': 1, '6-9': 0 }]);
  assert.deepEqual(total.since_start_ms, { phases: { searched: { n: 3, median: 900, p95: 1100 }, answered: { n: 3, median: 3000, p95: 5000 } }, whole_turn: { n: 3, median: 3100, p95: 5200 } });
});

test('ADR-125: the plan\'s caps against its ledger, near the cap and past it', () => {
  const budget = { attempts: 4000, embeddingAttempts: 2000, answerAttempts: 2000, tokens: 400000000, nanoUsd: 3000000000 };
  const ledger = totals => ({ id: 'm4-synthetic', configHash: 'synthetic', updatedAt: new Date('2026-10-10T08:00:00Z'), totals });
  const near = ledgerUse(budget, ledger({ attempts: 3990, tokens: 123456789, nanoUsd: 2985000000, embeddingAttempts: 998, answerAttempts: 997, planAttempts: 998, rerankAttempts: 996 }), { tokens: 90000, nanoUsd: 20000000 });
  assert.deepEqual(near, { started: true, updated_at: '2026-10-10T08:00:00.000Z', caps: {
    attempts: { cap: 4000, used: 3990, left: 10, share: 0.9975 }, embeddingAttempts: { cap: 2000, used: 998, left: 1002, share: 0.499 }, answerAttempts: { cap: 2000, used: 997, left: 1003, share: 0.4985 },
    tokens: { cap: 400000000, used: 123456789, left: 276543211, share: 0.3086 }, nanoUsd: { cap: 3000000000, used: 2985000000, left: 15000000, share: 0.995 },
    // The plan names no cap for these two: the store gives each twice the answers' attempts.
    planAttempts: { cap: 4000, used: 998, left: 3002, share: 0.2495 }, rerankAttempts: { cap: 4000, used: 996, left: 3004, share: 0.249 } },
  // 0.5% of the money is left, and it is less than one call reserves: the next turn is refused although money remains.
  refusing: ['nanoUsd'] });
  // The same ledger read without a reservation to compare with: only a cap with nothing left refuses.
  assert.deepEqual(ledgerUse(budget, ledger({ attempts: 3990, tokens: 123456789, nanoUsd: 2985000000, embeddingAttempts: 998, answerAttempts: 997, planAttempts: 998, rerankAttempts: 996 })).refusing, []);
  const spent = ledgerUse(budget, ledger({ attempts: 4000, tokens: 400000100, nanoUsd: 2000000000, embeddingAttempts: 1000, answerAttempts: 2000, planAttempts: 500, rerankAttempts: 500 }));
  assert.deepEqual([spent.refusing, spent.caps.attempts, spent.caps.tokens, spent.caps.answerAttempts.left], [['attempts', 'answerAttempts', 'tokens'], { cap: 4000, used: 4000, left: 0, share: 1 }, { cap: 400000000, used: 400000100, left: -100, share: 1 }, 0]);
  // No ledger row: nothing was reserved under the plan yet. An old ledger without the stage counters has no number for them.
  const fresh = ledgerUse(budget, null);
  assert.deepEqual([fresh.started, fresh.updated_at, fresh.caps.nanoUsd, fresh.caps.planAttempts, fresh.refusing], [false, null, { cap: 3000000000, used: 0, left: 3000000000, share: 0 }, { cap: 4000, used: 0, left: 4000, share: 0 }, []]);
  const old = ledgerUse(budget, ledger({ attempts: 12, tokens: 5000, nanoUsd: 700 }));
  assert.deepEqual([old.caps.attempts.used, old.caps.answerAttempts, old.refusing], [12, { cap: 2000, used: null, left: null, share: null }, []]);
  assert.deepEqual([ledgerUse(budget, { totals: 'text', updatedAt: 'no date' }).updated_at, ledgerUse(null, null).caps], [null, {}]);
  // A plan that allows no embedding at all (a fixed packet) refuses one from the start; text in a budget is no cap.
  assert.deepEqual(ledgerUse({ attempts: 8, embeddingAttempts: 0, note: QUESTION }, null), { started: false, updated_at: null, caps: { attempts: { cap: 8, used: 0, left: 8, share: 0 }, embeddingAttempts: { cap: 0, used: 0, left: 0, share: null } }, refusing: ['embeddingAttempts'] });
  // In the report the largest reservation is the one found among the turns read.
  const whole = report(rows(), { budget, ledger: ledger({ attempts: 3990, tokens: 123456789, nanoUsd: 2985000000, embeddingAttempts: 998, answerAttempts: 997, planAttempts: 998, rerankAttempts: 996 }) });
  assert.deepEqual([whole.ledger.refusing, whole.ledger.caps.nanoUsd.share, whole.turns.total.largest_reservation.nanoUsd], [['nanoUsd'], 0.995, 20000000]);
});

test('ADR-125: the provider calls\' receipts per day: what was billed and what is still only reserved', () => {
  const receipt = (at, stage, state, reserved, billed) => ({ id: `turn-synthetic-1:${stage}`, userId: 'user-synthetic-7', turnId: 'turn-synthetic-1', projectId: 'proj_synthetic', stage, state,
    reservedNanoUsd: BigInt(reserved), billedNanoUsd: billed === null ? null : BigInt(billed), createdAt: new Date(at) });
  const receipts = [receipt(DAY_ONE, 'plan', 'settled', 5000000, 300000), receipt(DAY_ONE, 'embedding', 'settled', 13000, 2600), receipt(DAY_ONE, 'answer', 'settled', 21000000, 3100000),
    receipt(DAY_TWO, 'answer', 'unknown', 20000000, null), receipt(DAY_TWO, 'rerank', 'not_sent', 6000000, 0), receipt(DAY_TWO, 'answer', 'sent', 18000000, null)];
  const { provider_calls: calls } = report([], { receipts });
  assert.deepEqual(calls.total, { calls: 6, by_stage: { plan: 1, embedding: 1, answer: 3, rerank: 1 }, by_state: { settled: 3, unknown: 1, not_sent: 1, sent: 1 }, billed_nano_usd: 3402600, reserved_unsettled_nano_usd: 38000000, largest_reserved_nano_usd: 21000000 });
  assert.deepEqual(calls.by_day, { '2026-10-08': { calls: 3, by_stage: { plan: 1, embedding: 1, answer: 1 }, by_state: { settled: 3 }, billed_nano_usd: 3402600, reserved_unsettled_nano_usd: 0, largest_reserved_nano_usd: 21000000 },
    '2026-10-09': { calls: 3, by_stage: { answer: 2, rerank: 1 }, by_state: { unknown: 1, not_sent: 1, sent: 1 }, billed_nano_usd: 0, reserved_unsettled_nano_usd: 38000000, largest_reserved_nano_usd: 20000000 } });
  // Where turns are not read (more than one account) the receipts still say what one call reserves: with 15 000 000
  // left of the money and a call that reserved 21 000 000, the ledger part names the money as refusing.
  const budget = { attempts: 4000, answerAttempts: 2000, nanoUsd: 3000000000 }, ledger = { totals: { attempts: 900, answerAttempts: 300, planAttempts: 300, rerankAttempts: 300, nanoUsd: 2985000000 } };
  assert.deepEqual([report([], { receipts, budget, ledger }).ledger.refusing, report([], { budget, ledger }).ledger.refusing], [['nanoUsd'], []]);
});

test('ADR-125: no text of a question, an answer, a passage, a title or a user reaches the report', () => {
  const packet = { tenant: 'synthetic', query_id: 'q', reference_map: {}, evidence: [] };
  const lean = { state: 'completed', createdAt: new Date(DAY_ONE), payload: leanPayload({ ...turn(DAY_ONE, 'completed', answered('partial'), assist(2, 2)).payload, packet }) };
  const all = [...rows(), lean, turn(DAY_TWO, QUESTION, { answer: { kind: ANSWER } }, assist(1, 1, { failures: [{ stage: TITLE, code: LEAD }] }))];
  const receipts = [{ id: 'turn-synthetic-1:answer', userId: 'user-synthetic-7', turnId: 'turn-synthetic-1', projectId: 'proj_synthetic', stage: 'answer', state: QUERY, reservedNanoUsd: 5n, billedNanoUsd: 2n, createdAt: new Date(DAY_ONE) }];
  const made = report(all, { receipts, budget: { attempts: 10, nanoUsd: 1000, note: QUESTION }, ledger: { id: 'm4-synthetic', configHash: 'synthetic', totals: { attempts: 3, nanoUsd: 900, note: ANSWER }, updatedAt: new Date(DAY_TWO) } });
  // The rows do hold the texts; neither what is kept of a row nor the report does.
  for (const text of TEXTS.slice(0, 7)) assert.ok(JSON.stringify(all).includes(text), text);
  for (const text of TEXTS) for (const [name, value] of [['facts', all.map(turnFacts)], ['report', made]]) assert.equal(JSON.stringify(value).includes(text), false, `${name}: ${text}`);
  // Numbers only: every key and every string in the report is a name, a code or a time, with no space in it.
  const strings = [], walk = value => {
    if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { strings.push(key); walk(child); }
  };
  walk(made);
  for (const text of strings) assert.match(text, /^[A-Za-z0-9_:.-]{1,64}$/);
  assert.deepEqual([made.turns.total.by_state.other, made.turns.total.answers_by_kind.other, made.turns.total.search_assist_failures.other, made.provider_calls.total.by_state], [1, undefined, { other: 1 }, { other: 1 }]);
});
