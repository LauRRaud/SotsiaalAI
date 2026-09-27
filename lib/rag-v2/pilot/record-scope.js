import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { reject } from './contracts.js';
import { nonempty } from '../contracts.js';

const words = text => text.match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu) || [];
const terms = text => new Set(text.split(' ').filter(Boolean));
const canonical = word => `vmet${word.normalize('NFC').toLowerCase()}`;

async function analyzedWords(text, analyzer) {
  const list = words(text), result = [];
  for (let offset = 0; offset < list.length; offset += 96) {
    const batch = list.slice(offset, offset + 96), analyzed = await analyzer.analyze(batch);
    batch.forEach((word, i) => result.push({ word, terms: terms(analyzed[i]) }));
  }
  return result;
}

/** Names come from an adapter's canonical directory, never a list of hand-written
 * inflections. A mention selects evidence scope, not a verified residence fact. */
export async function resolveRecordScope(turns, directory, analyzer = defaultEstnltkAnalyzer(), previousState = null) {
  if (!Array.isArray(turns) || !turns.length || turns.length > 8 || !Array.isArray(directory) || directory.length > 300
    || directory.some(row => !nonempty(row.region) || row.region.length > 100 || !Array.isArray(row.names) || !row.names.length
      || row.names.some(name => !nonempty(name) || name.length > 200))) reject('invalid_record_scope');
  const names = directory.flatMap(row => row.names.map(name => ({ region: row.region, words: words(name) }))).filter(name => name.words.length);
  const same = (a, b) => canonical(a) === canonical(b);
  const previousIds = previousState?.sourceTurnIds || [];
  if (previousState && (!previousIds.length || previousIds.length >= turns.length
    || previousIds.some((id, i) => id !== turns[i]?.turnId))) reject('invalid_record_scope');
  // A validated state retires earlier mentions. Only newer user turns can select
  // a different area; do not rediscover a locality the user has since retracted.
  for (const turn of turns.slice(previousIds.length).reverse()) {
    const userWords = await analyzedWords(turn.text, analyzer);
    // A name word is mentioned only when its own canonical form is among one user
    // word's surface/lemma terms. Other readings of the name ("Tapa" -> "tapma"),
    // shared compound parts ("Lääne-", "Pärnu" in "Põhja-Pärnumaa") and parts of a
    // hyphenated user place name ("Narva" in "Narva-Jõesuus") select no area.
    const mentioned = word => userWords.some(user => user.terms.has(canonical(word)) && word.includes('-') === user.word.includes('-'));
    const matched = names.filter(name => name.words.every(mentioned));
    // A full city/rural-municipality name wins over its ambiguous shared base name.
    const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
      && name.words.every(word => other.words.some(another => same(word, another)))));
    const regions = [...new Set(specific.map(name => name.region))];
    if (regions.length === 1) return { state: 'mentioned_region', region: regions[0], turn_id: turn.turnId,
      interpretation: 'source_scope_only_not_confirmed_residence' };
    // The candidates bound the knowledge lane's municipal texts (Tartu linn and Tartu vald, not a third one).
    if (regions.length > 1) return { state: 'ambiguous_region', region: null, candidates: regions.sort() };
    if (turn.mode === 'correction') return { state: 'region_required_after_correction', region: null };
  }
  if (previousState) {
    const region = previousState.value.region;
    if (region.id && directory.some(row => row.region === region.id)) return { state: 'dialogue_region', region: region.id,
      interpretation: 'source_scope_only_not_confirmed_residence' };
    return { state: region.status === 'ambiguous' ? 'ambiguous_region' : 'region_required', region: null };
  }
  return { state: 'region_required', region: null };
}

/** The knowledge lane's municipality (Codex review 27.09.2026). The conversation's own resolution comes first. When
 * the user's words name no municipality the resolver can read (another script: "в Нарва-Йыэсуу"), the search plan's
 * Estonian queries, which keep the places the user gave, are read the same way. A retracted place is never
 * rediscovered this way. A source scope only, never a residence fact. */
export async function knowledgeRegionScope(scope, planQueries, directory, analyzer = defaultEstnltkAnalyzer()) {
  if (scope.state !== 'region_required' || !Array.isArray(planQueries) || !planQueries.length) return scope;
  const planned = await resolveRecordScope(planQueries.slice(0, 8).map((text, index) => ({ turnId: `plan-${index + 1}`, text, mode: 'same' })),
    directory, analyzer);
  if (planned.region) return { state: 'search_plan_region', region: planned.region, interpretation: 'source_scope_only_not_confirmed_residence' };
  if (planned.state === 'ambiguous_region') return { state: 'search_plan_ambiguous_region', region: null, candidates: planned.candidates };
  return scope;
}
