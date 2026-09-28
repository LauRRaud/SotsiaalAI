// Checks of one turn of a whole-conversation evaluation (tests/evaluation/dialogue/scenarios-corpus-1.json). Each check
// says what it measures, so a failure points at what to fix: 'search' (the right source was not found), 'answer' (it
// was found but the answer is wrong or incomplete) or 'state' (the conversation's municipality, person or catalogue).
export const EXPECTATIONS = Object.freeze({
  region: 'state', service_summary: 'state', details: 'state', contacts: 'state', crisis: 'state', previous_state_cleared: 'state',
  evidence: 'search', cited: 'answer', must: 'answer', must_not: 'answer', valid_on: 'answer', clarification: 'answer',
});

/** The catalogue's own shape: known expectation keys and modes, before anything is run or paid for. */
export function validateCatalogue(catalogue) {
  const problems = [];
  if (!Array.isArray(catalogue?.scenarios) || !catalogue.scenarios.length) problems.push('no scenarios');
  const ids = new Set();
  for (const scenario of catalogue?.scenarios || []) {
    if (!/^[a-z0-9-]+$/.test(scenario.id || '') || ids.has(scenario.id)) problems.push(`scenario id ${scenario.id}`);
    ids.add(scenario.id);
    for (const [index, turn] of (scenario.turns || []).entries()) {
      const where = `${scenario.id} turn ${index + 1}`;
      if (!['new', 'same', 'correction', 'new_person'].includes(turn.mode)) problems.push(`${where}: mode ${turn.mode}`);
      if (typeof turn.text !== 'string' || !turn.text.trim()) problems.push(`${where}: text`);
      if (index === 0 && turn.mode !== 'new') problems.push(`${where}: a conversation starts with 'new'`);
      for (const [key, value] of Object.entries(turn.expect || {})) {
        if (!(key in EXPECTATIONS)) problems.push(`${where}: unknown expectation ${key}`);
        if (['evidence', 'cited', 'must', 'must_not'].includes(key) && !(Array.isArray(value) && value.every(item => typeof item === 'string'))) problems.push(`${where}: ${key} needs a list of patterns`);
        if (key === 'valid_on' && value !== 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(`${where}: valid_on ${value}`);
      }
    }
  }
  return problems;
}

const matches = (pattern, text) => new RegExp(pattern, 'iu').test(text || '');

/** One turn: `observed` is what the turn produced; `validity(documentId)` gives a national legal text's validity
 *  ({ from, to }) or null for any other source. Returns every check with its kind and whether it passed. */
export function checkTurn(expect = {}, observed, { today, validity = () => null } = {}) {
  const checks = [];
  const add = (key, ok, detail) => checks.push({ key, kind: EXPECTATIONS[key] || 'state', ok: Boolean(ok), detail });
  checks.push({ key: 'completed', kind: 'answer', ok: observed.state === 'completed', detail: observed.error || observed.state });
  if ('region' in expect) add('region', observed.region === expect.region, `region ${observed.region ?? null}, expected ${expect.region}`);
  if (expect.service_summary) add('service_summary', observed.summaries.some(title => matches(expect.service_summary, title)), `summaries: ${observed.summaries.join(', ') || '-'}`);
  if (expect.details) add('details', observed.details.some(title => matches(expect.details, title)), `details: ${observed.details.join(', ') || '-'}`);
  if (expect.contacts) add('contacts', observed.contacts > 0, `contact persons ${observed.contacts}`);
  if ('crisis' in expect) add('crisis', observed.crisis === expect.crisis, `crisis ${observed.crisis}`);
  if (expect.previous_state_cleared) add('previous_state_cleared', observed.previousStateCleared === true, 'previous person\'s state');
  for (const pattern of expect.evidence || []) add('evidence', observed.evidenceTitles.some(title => matches(pattern, title)), `/${pattern}/ among ${observed.evidenceTitles.length} found sources`);
  for (const pattern of expect.cited || []) add('cited', observed.cited.some(source => matches(pattern, source.title)), `/${pattern}/ among cited: ${observed.cited.map(source => source.title).join(', ') || '-'}`);
  for (const pattern of expect.must || []) add('must', matches(pattern, observed.text), `/${pattern}/ in the answer`);
  for (const pattern of expect.must_not || []) add('must_not', !matches(pattern, observed.text), `/${pattern}/ not in the answer`);
  if ('clarification' in expect) add('clarification', observed.clarification === expect.clarification, `asks for a circumstance: ${observed.clarification}`);
  if (expect.valid_on) {
    const date = expect.valid_on === 'today' ? today : expect.valid_on;
    const outside = observed.cited.map(source => ({ source, valid: validity(source.documentId) }))
      .filter(({ valid }) => valid && (valid.from > date || (valid.to && valid.to < date)));
    add('valid_on', outside.length === 0, outside.length ? `not in force on ${date}: ${outside.map(({ source, valid }) => `${source.title} ${valid.from}..${valid.to ?? 'open'}`).join('; ')}` : `cited legal texts in force on ${date}`);
  }
  // Where the fault lies: a missing source first (search), then the answer, then the conversation state.
  const failed = checks.filter(check => !check.ok);
  const verdict = !failed.length ? 'passed' : failed.some(check => check.kind === 'search') ? 'search'
    : failed.some(check => check.kind === 'answer') ? 'answer' : 'state';
  return { checks, verdict };
}
