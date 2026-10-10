// Checks of one turn of a whole-conversation evaluation (tests/evaluation/dialogue/scenarios-corpus-1.json). Each check
// says what it measures, so a failure points at what to fix: 'search' (the right source was not found), 'answer' (it
// was found but the answer is wrong or incomplete) or 'state' (the conversation's municipality, person or catalogue).
import { headingSection } from '../search/legal-references.js';

export const EXPECTATIONS = Object.freeze({
  region: 'state', service_summary: 'state', details: 'state', contacts: 'state', crisis: 'state', previous_state_cleared: 'state',
  // The saved dialogue state, not only the catalogue (Codex review 29.09, F5): the region of the person the turn was
  // about, each person's own region, whose need the search plan read, and that the model's new state was kept.
  state_region: 'state', person_regions: 'state', person: 'state', state_kept: 'state',
  evidence: 'search', found_valid_on: 'search', cited: 'answer', must: 'answer', must_not: 'answer', valid_on: 'answer', clarification: 'answer',
  // ADR-054: an exact phrase of the source (a condition or an exception) is in the evidence the answer was given.
  evidence_text: 'search',
  // Codex review of #320: a phrase alone does not say which provision it came from (SHS § 25 and § 29 share a sentence), and
  // a cited title does not say which passage of the act was cited. One evidence passage of the named act and section holds
  // the phrase (evidence_provision), and the answer cites a passage of that act and section (cited_provision). The section
  // is the passage's place in the document's structure (its heading path), not a number found in its text.
  evidence_provision: 'search', cited_provision: 'answer',
  // Whether the turn took the greeting route (no search plan, no search): true for a lone greeting, false for a request.
  greeting: 'search',
  // ADR-072: what the search plan set out to find. None of its queries matches the pattern: a search with the right
  // person and municipality can still be about the wrong subject (an answered question searched again).
  plan_queries_must_not: 'search',
  // ADR-077: what the selection step kept. None of the kept passages has a title matching the pattern: a selection that
  // keeps passages about an earlier, answered question fills the evidence with another subject.
  selected_must_not: 'search',
  // ADR-077: a question about what changes on a date needs both versions of the act. Each listed day is the first day of
  // a version of the act the turn's evidence (or cited) patterns name, among the found sources (found_versions_from) or
  // among the cited ones (cited_versions_from). Versions share their title; the day tells them apart, for a municipal act too.
  found_versions_from: 'search', cited_versions_from: 'answer',
  // The fact lifecycle (Codex follow-up 29.09, 7.6), read from the saved facts, never from model.accepted: a person's fact
  // whose quote matches is current, is not current, or has become superseded or retracted; a fact the server left out
  // passes only with its own allowance (kind, reason, and the person or fact when the allowance names one).
  facts_present: 'state', facts_absent: 'state', fact_changes: 'state', allowed_dropped: 'state',
  // ADR-129 (10.10.2026): what the server's provision check counted of the answer (provision-check.js, the turn's
  // provisionAudit). names_provision true: a block names a provision; false: the answer names none anywhere.
  // provisions_at_most: the answer names no more provisions than this (a help seeker's answer stays readable).
  // Whether each named provision is supported is checked on every turn that has the audit (provisions_supported).
  names_provision: 'answer', provisions_at_most: 'answer',
});
const DATE_EXPECTATIONS = ['valid_on', 'found_valid_on'];
const VERSION_EXPECTATIONS = ['found_versions_from', 'cited_versions_from'];
const FACT_KEYS = ['facts_present', 'facts_absent', 'fact_changes', 'allowed_dropped'];
const PROVISION_KEYS = ['evidence_provision', 'cited_provision'];
const FACT_STATUSES = ['current', 'superseded', 'retracted', 'archived'];
const DROP_KINDS = ['state', 'new_fact', 'superseded', 'needs', 'unknowns', 'periods'];
// The user's own statements; a left-out need or open question is the model's inference, not a lost fact.
const LIFECYCLE_DROPS = ['state', 'new_fact', 'superseded', 'periods'];
const personOf = value => String(value).normalize('NFC').trim().toLowerCase();
const text = value => typeof value === 'string' && value.trim();
function factProblem(key, value) {
  if (!Array.isArray(value) || !value.length || !value.every(item => item && typeof item === 'object' && !Array.isArray(item))) return `${key} needs a list of objects`;
  if (key === 'allowed_dropped') return value.every(item => DROP_KINDS.includes(item.kind) && text(item.reason)) ? null : `${key} needs kind and reason`;
  if (!value.every(item => text(item.person) && text(item.quote))) return `${key} needs person and quote`;
  return key !== 'fact_changes' || value.every(item => [item.status].flat().every(status => FACT_STATUSES.includes(status))) ? null : `${key} status`;
}

// The roles a scenario may name: the chat service's own (contracts.js USER_ROLES).
export const SCENARIO_ROLES = Object.freeze(['specialist', 'help_seeker', 'service_provider']);
/** The catalogue's own shape: known expectation keys and modes, before anything is run or paid for. */
export function validateCatalogue(catalogue) {
  const problems = [];
  if (!Array.isArray(catalogue?.scenarios) || !catalogue.scenarios.length) problems.push('no scenarios');
  const ids = new Set();
  for (const scenario of catalogue?.scenarios || []) {
    if (!/^[a-z0-9-]+$/.test(scenario.id || '') || ids.has(scenario.id)) problems.push(`scenario id ${scenario.id}`);
    ids.add(scenario.id);
    // The role the scenario's user holds (the chat takes it from the signed-in account); absent means none is sent.
    if (scenario.role !== undefined && !SCENARIO_ROLES.includes(scenario.role)) problems.push(`${scenario.id}: role ${scenario.role}`);
    for (const [index, turn] of (scenario.turns || []).entries()) {
      const where = `${scenario.id} turn ${index + 1}`;
      if (!['new', 'same', 'correction', 'new_person'].includes(turn.mode)) problems.push(`${where}: mode ${turn.mode}`);
      if (typeof turn.text !== 'string' || !turn.text.trim()) problems.push(`${where}: text`);
      if (index === 0 && turn.mode !== 'new') problems.push(`${where}: a conversation starts with 'new'`);
      for (const [key, value] of Object.entries(turn.expect || {})) {
        if (!(key in EXPECTATIONS)) problems.push(`${where}: unknown expectation ${key}`);
        if (['evidence', 'cited', 'must', 'must_not', 'evidence_text', 'plan_queries_must_not', 'selected_must_not'].includes(key) && !(Array.isArray(value) && value.every(item => typeof item === 'string'))) problems.push(`${where}: ${key} needs a list of patterns`);
        if (DATE_EXPECTATIONS.includes(key) && value !== 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(`${where}: ${key} ${value}`);
        if (VERSION_EXPECTATIONS.includes(key) && !(Array.isArray(value) && value.length && value.every(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
          && (turn.expect.evidence || turn.expect.cited || []).length)) problems.push(`${where}: ${key} needs a list of days and an evidence or cited pattern naming the act`);
        if (key === 'person_regions' && (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length)) problems.push(`${where}: person_regions needs persons`);
        if (key === 'state_kept' && value !== true) problems.push(`${where}: state_kept is true or absent`);
        if (key === 'greeting' && typeof value !== 'boolean') problems.push(`${where}: greeting is true or false`);
        if (key === 'names_provision' && typeof value !== 'boolean') problems.push(`${where}: names_provision is true or false`);
        if (key === 'provisions_at_most' && !(Number.isInteger(value) && value >= 0)) problems.push(`${where}: provisions_at_most needs a whole number`);
        if (FACT_KEYS.includes(key) && factProblem(key, value)) problems.push(`${where}: ${factProblem(key, value)}`);
        if (PROVISION_KEYS.includes(key) && !(Array.isArray(value) && value.length && value.every(item => item && typeof item === 'object' && !Array.isArray(item)
          && text(item.title) && typeof item.section === 'string' && /^\d+(\^\d+)?$/u.test(item.section) && (key === 'cited_provision' ? item.text === undefined : text(item.text))
          && Object.keys(item).every(name => ['title', 'section', 'text'].includes(name))))) problems.push(`${where}: ${key} needs title, section${key === 'cited_provision' ? '' : ' and text'}`);
      }
    }
  }
  return problems;
}

const matches = (pattern, text) => new RegExp(pattern, 'iu').test(text || '');

/**
 * What the provision checks read of a saved turn: every evidence passage with its document's title, its own section
 * (from the passage's heading path, as the search reads it) and its text, and the passages the answer's references name.
 */
export function turnPassages(packet, answer) {
  const passageOf = entry => ({ title: entry.bibliography?.title || '', section: headingSection(entry.search_aids?.heading_prefix), text: entry.source_text || '' });
  const evidence = packet?.evidence || [], byId = new Map(evidence.map(entry => [entry.evidence_id, entry]));
  const refs = new Set((answer?.blocks || []).flatMap(block => block.refs || []));
  return { evidencePassages: evidence.map(passageOf),
    citedPassages: [...refs].map(ref => byId.get(packet?.reference_map?.[ref]?.evidence_id)).filter(Boolean).map(passageOf) };
}

/** One turn: `observed` is what the turn produced; `validity(documentId)` gives a national legal text's validity
 *  ({ from, to }) or null for any other source. Returns every check with its kind and whether it passed. */
export function checkTurn(expect = {}, observed, { today, validity = () => null, version = () => null } = {}) {
  const checks = [];
  const add = (key, ok, detail) => checks.push({ key, kind: EXPECTATIONS[key] || 'state', ok: Boolean(ok), detail });
  checks.push({ key: 'completed', kind: 'answer', ok: observed.state === 'completed', detail: observed.error || observed.state });
  if ('region' in expect) add('region', observed.region === expect.region, `region ${observed.region ?? null}, expected ${expect.region}`);
  if (expect.service_summary) add('service_summary', observed.summaries.some(title => matches(expect.service_summary, title)), `summaries: ${observed.summaries.join(', ') || '-'}`);
  if (expect.details) add('details', observed.details.some(title => matches(expect.details, title)), `details: ${observed.details.join(', ') || '-'}`);
  if (expect.contacts) add('contacts', observed.contacts > 0, `contact persons ${observed.contacts}`);
  if ('crisis' in expect) add('crisis', observed.crisis === expect.crisis, `crisis ${observed.crisis}`);
  if ('greeting' in expect) add('greeting', Boolean(observed.greeting) === expect.greeting, `greeting route ${Boolean(observed.greeting)}, expected ${expect.greeting}`);
  if (expect.previous_state_cleared) add('previous_state_cleared', observed.previousStateCleared === true, 'previous person\'s state');
  if ('state_region' in expect) add('state_region', (observed.stateRegion ?? null) === expect.state_region,
    `state region ${observed.stateRegion ?? null}, expected ${expect.state_region}${observed.stateFallback ? ` (new state rejected: ${observed.stateFallback})` : ''}`);
  for (const [person, region] of Object.entries(expect.person_regions || {})) {
    const found = observed.personRegions?.[person] ?? null;
    add('person_regions', found === region, `${person}: state region ${found}, expected ${region}`);
  }
  if ('person' in expect) add('person', (observed.person ?? null) === expect.person, `plan person ${observed.person ?? null}, expected ${expect.person}`);
  for (const pattern of expect.plan_queries_must_not || []) {
    const found = (observed.queries || []).filter(query => matches(pattern, query));
    add('plan_queries_must_not', !found.length, found.length ? `/${pattern}/ in the search plan: ${found.join(' | ')}` : `/${pattern}/ in none of the ${(observed.queries || []).length} planned queries`);
  }
  for (const pattern of expect.selected_must_not || []) {
    const kept = observed.rerank?.selected || [], found = kept.filter(title => matches(pattern, title));
    add('selected_must_not', !found.length, found.length ? `/${pattern}/ among the passages the selection kept: ${[...new Set(found)].join(' | ')}`
      : observed.rerank ? `/${pattern}/ in none of the ${kept.length} kept passages' titles` : `/${pattern}/: no selection recorded`);
  }
  if (expect.state_kept) add('state_kept', !observed.stateFallback, observed.stateFallback ? `new state rejected: ${observed.stateFallback}` : 'new state kept');
  const facts = observed.facts || [], quoted = (want, fact) => personOf(fact.person) === personOf(want.person) && fact.support.some(source => matches(want.quote, source.quote));
  const current = want => facts.some(fact => fact.status === 'current' && quoted(want, fact));
  for (const want of expect.facts_present || []) add('facts_present', current(want), `${want.person}: /${want.quote}/ among the current facts`);
  for (const want of expect.facts_absent || []) add('facts_absent', !current(want), `${want.person}: /${want.quote}/ not among the current facts`);
  for (const want of expect.fact_changes || []) {
    const statuses = [want.status].flat(), found = facts.filter(fact => quoted(want, fact));
    add('fact_changes', found.some(fact => statuses.includes(fact.status)),
      `${want.person}: /${want.quote}/ ${found.map(fact => `${fact.id} ${fact.status}`).join(', ') || 'no such fact'}, expected ${statuses.join(' or ')}`);
  }
  if (FACT_KEYS.some(key => key in expect)) {
    // Each allowance covers one drop; a drop without its own allowance is a lost change.
    const allowances = [...(expect.allowed_dropped || [])], unexpected = [];
    for (const item of (observed.dropped || []).filter(entry => LIFECYCLE_DROPS.includes(entry.kind))) {
      const at = allowances.findIndex(allow => allow.kind === item.kind && allow.reason === item.reason
        && (!allow.person || personOf(allow.person) === item.person) && (!allow.fact || allow.fact === item.fact));
      if (at < 0) unexpected.push(item); else allowances.splice(at, 1);
    }
    add('allowed_dropped', !unexpected.length, unexpected.length ? `left out without an allowance: ${unexpected.map(item => [item.kind, item.reason, item.person || item.fact].filter(Boolean).join(' ')).join('; ')}`
      : `${(observed.dropped || []).filter(entry => LIFECYCLE_DROPS.includes(entry.kind)).length} facts or changes left out, each allowed`);
  }
  for (const pattern of expect.evidence || []) add('evidence', observed.evidenceTitles.some(title => matches(pattern, title)), `/${pattern}/ among ${observed.evidenceTitles.length} found sources`);
  const spaced = text => text.replace(/\s+/gu, ' ');
  for (const phrase of expect.evidence_text || []) add('evidence_text', (observed.evidenceTexts || []).some(text => spaced(text).includes(spaced(phrase))),
    `"${phrase.slice(0, 60)}" in the evidence text`);
  // A provision: a passage of the act (title pattern) whose own section is the named one; evidencePassages and
  // citedPassages are { title, section, text } of the evidence the answer was given and of the passages it cites.
  const provision = (want, passage) => matches(want.title, passage.title) && passage.section === want.section
    && (want.text === undefined || spaced(passage.text || '').includes(spaced(want.text)));
  const where = want => `§ ${want.section} of /${want.title}/`;
  for (const want of expect.evidence_provision || []) add('evidence_provision', (observed.evidencePassages || []).some(passage => provision(want, passage)),
    `"${want.text.slice(0, 60)}" in a passage of ${where(want)}`);
  for (const want of expect.cited_provision || []) add('cited_provision', (observed.citedPassages || []).some(passage => provision(want, passage)),
    `the answer cites a passage of ${where(want)}; cited: ${(observed.citedPassages || []).map(passage => `${passage.title}${passage.section ? ` § ${passage.section}` : ''}`).join(', ') || '-'}`);
  for (const pattern of expect.cited || []) add('cited', observed.cited.some(source => matches(pattern, source.title)), `/${pattern}/ among cited: ${observed.cited.map(source => source.title).join(', ') || '-'}`);
  for (const pattern of expect.must || []) add('must', matches(pattern, observed.text), `/${pattern}/ in the answer`);
  for (const pattern of expect.must_not || []) add('must_not', !matches(pattern, observed.text), `/${pattern}/ not in the answer`);
  if ('clarification' in expect) add('clarification', observed.clarification === expect.clarification, `asks for a circumstance: ${observed.clarification}`);
  // ADR-129: the provision check's own counts. A turn without the audit named nothing and had no labelled passage.
  const audit = observed.provisions || null, counted = { mentions: audit?.mentions ?? 0, naming: audit?.blocks_naming ?? 0, bare: audit?.bare_subsections ?? 0 };
  const namedAs = `blocks naming a provision ${counted.naming}, provisions named ${counted.mentions}${counted.bare ? `, subsections without their section (not read) ${counted.bare}` : ''}`;
  if ('names_provision' in expect) add('names_provision', expect.names_provision ? counted.naming >= 1 : counted.mentions === 0 && counted.bare === 0, `${namedAs}, expected ${expect.names_provision ? 'at least one' : 'none'}`);
  if ('provisions_at_most' in expect) add('provisions_at_most', counted.mentions <= expect.provisions_at_most, `${namedAs}, at most ${expect.provisions_at_most}`);
  // Every turn with the audit: no named provision of kind d (found nowhere in what the turn held). The server publishes
  // such an answer (the check's list of refused kinds is empty, 10.10.2026), so this check is where a run shows it. The
  // detail lists the mentions to read by hand: those that are not the label of a cited passage, and those that name
  // no act after another act was named.
  if (audit) checks.push({ key: 'provisions_supported', kind: 'answer', ok: audit.failed !== true && !(audit.kinds?.d > 0),
    detail: audit.failed ? 'the provision check failed on this turn' : `kinds ${Object.entries(audit.kinds || {}).filter(([, n]) => n).map(([kind, n]) => `${kind} ${n}`).join(', ') || '-'}${(audit.items || []).length
      ? `; to read by hand: ${audit.items.map(item => `${item.provision} (${item.kind}${item.source ? ', not an act' : ''}${item.collision ? ', collision' : ''}${item.after_other_act ? ', no act named after another act' : ''}, ${item.at})`).join('; ')}` : ''}` });
  // The versions of one act share its title, so the date checks judge each act on its own (Codex review 28.09): another
  // law in force on the date never vouches for a wrong version of the asked act. An answer may cite today's version of
  // an act beside the asked one (to compare); sources without validity are not judged by date.
  const acts = sources => {
    const byTitle = new Map();
    for (const source of sources) {
      const valid = validity(source.documentId);
      if (valid) byTitle.set(source.title, [...(byTitle.get(source.title) || []), { source, valid }]);
    }
    return [...byTitle];
  };
  const inForce = (valid, date) => valid.from <= date && (!valid.to || valid.to >= date);
  const missing = (list, date) => list.filter(([, versions]) => !versions.some(({ valid }) => inForce(valid, date)));
  const listed = list => list.flatMap(([, versions]) => versions).map(({ source, valid }) => `${source.title} ${valid.from}..${valid.to ?? 'open'}`).join('; ') || '-';
  if (expect.found_valid_on) {
    // The search check judges the acts the turn expects (its evidence or cited patterns), else every found act.
    const date = expect.found_valid_on === 'today' ? today : expect.found_valid_on, patterns = expect.evidence || expect.cited || [];
    const expected = acts(observed.found || []).filter(([title]) => !patterns.length || patterns.some(pattern => matches(pattern, title)));
    add('found_valid_on', expected.length > 0 && !missing(expected, date).length, `found legal texts for ${date}: ${listed(expected)}`);
  }
  // `version(documentId)` gives any indexed act's validity, a municipal one's too ({ from, to }); null for other sources.
  for (const [key, sources] of [['found_versions_from', observed.found || []], ['cited_versions_from', observed.cited || []]]) {
    if (!expect[key]) continue;
    const patterns = expect.evidence || expect.cited || [];
    const starts = sources.filter(source => patterns.some(pattern => matches(pattern, source.title))).map(source => version(source.documentId)?.from).filter(Boolean);
    for (const day of expect[key]) add(key, starts.includes(day), `a version from ${day} among the ${key === 'found_versions_from' ? 'found' : 'cited'} versions of the act: ${[...new Set(starts)].sort().join(', ') || '-'}`);
  }
  if (expect.valid_on) {
    const date = expect.valid_on === 'today' ? today : expect.valid_on, cited = acts(observed.cited), wrong = missing(cited, date);
    add('valid_on', !wrong.length, wrong.length ? `not in force on ${date}: ${listed(wrong)}` : `cited for ${date}: ${listed(cited)}`);
  }
  // Where the fault lies: a missing source first (search), then the answer, then the conversation state.
  const failed = checks.filter(check => !check.ok);
  const verdict = !failed.length ? 'passed' : failed.some(check => check.kind === 'search') ? 'search'
    : failed.some(check => check.kind === 'answer') ? 'answer' : 'state';
  return { checks, verdict };
}

// The kinds the provision check gives a named provision (provision-check.js, PROVISION_KINDS).
const PROVISION_KINDS = Object.freeze(['a', 'b', 'c', 'v', 's', 'p', 'q', 'd']);
const PROVISION_COUNTS = Object.freeze(['from_other_sources', 'collisions', 'after_other_act', 'outside_blocks', 'act_named', 'act_not_shown', 'word_forms', 'bare_subsections']);
/**
 * ADR-129: what a run's turns say of named provisions, for each role and in total (key 'all'). scenarios: the report's
 * scenarios ({ role, turns: [{ observed }] }), observed.provisions being the turn's provision audit or null. Per line:
 * the turns, those completed, those refused for a provision (unsupported_provision: none while the check's list of
 * refused kinds is empty, 10.10.2026; then kind d shows in the kinds and as a failed provisions_supported), the
 * completed answers that name a provision in a block, the mentions by kind and the audit's other counts (kind b from a
 * source that is no act and a mention without an act after another act among them), the median and the largest number
 * of mentions in one completed answer, and the cost a turn (a turn was 0.0041 USD in ADR-123's run). Numbers only.
 * One run a question is no rate: it says whether the mechanism works.
 */
export function provisionTotals(scenarios) {
  const lines = new Map(), line = () => ({ turns: 0, completed: 0, refused: 0, check_failed: 0, answers_naming: 0, mentions: 0, kinds: Object.fromEntries(PROVISION_KINDS.map(kind => [kind, 0])),
    ...Object.fromEntries(PROVISION_COUNTS.map(key => [key, 0])), per_answer: [], usd: 0 });
  for (const scenario of scenarios || []) for (const turn of scenario.turns || []) {
    const observed = turn.observed || {}, audit = observed.provisions || null;
    for (const key of ['all', scenario.role || 'no_role']) {
      if (!lines.has(key)) lines.set(key, line());
      const tally = lines.get(key);
      tally.turns++; tally.usd += Number.isFinite(observed.usd) ? observed.usd : 0;
      if (observed.error === 'unsupported_provision') tally.refused++;
      if (audit?.failed) tally.check_failed++;
      if (observed.state === 'completed') { tally.completed++; tally.per_answer.push(audit?.mentions ?? 0); if (audit?.blocks_naming > 0) tally.answers_naming++; }
      if (!audit || audit.failed) continue;
      tally.mentions += audit.mentions ?? 0;
      for (const kind of PROVISION_KINDS) tally.kinds[kind] += audit.kinds?.[kind] ?? 0;
      for (const count of PROVISION_COUNTS) tally[count] += audit[count] ?? 0;
    }
  }
  return Object.fromEntries([...lines].map(([key, { per_answer: counts, usd, ...tally }]) => {
    const sorted = [...counts].sort((a, b) => a - b), middle = sorted.length >> 1;
    return [key, { ...tally, median_mentions: !sorted.length ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, largest_mentions: sorted.at(-1) ?? null,
      usd: +usd.toFixed(4), usd_per_turn: tally.turns ? +(usd / tally.turns).toFixed(4) : null }];
  }));
}
