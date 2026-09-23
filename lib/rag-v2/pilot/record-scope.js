import { defaultEstnltkAnalyzer } from '../search/estnltk.js';
import { reject } from './contracts.js';
import { nonempty } from '../contracts.js';

const words = text => text.match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu) || [];
const terms = text => new Set(text.split(' ').filter(Boolean));

/** Names come from an adapter's canonical directory, never a list of hand-written
 * inflections. A mention selects evidence scope, not a verified residence fact. */
export async function resolveRecordScope(turns, directory, analyzer = defaultEstnltkAnalyzer(), previousState = null) {
  if (!Array.isArray(turns) || !turns.length || turns.length > 8 || !Array.isArray(directory) || directory.length > 300
    || directory.some(row => !nonempty(row.region) || row.region.length > 100 || !Array.isArray(row.names) || !row.names.length
      || row.names.some(name => !nonempty(name) || name.length > 200))) reject('invalid_record_scope');
  const tokens = [...new Set(directory.flatMap(row => row.names.flatMap(words)))];
  const tokenTerms = new Map();
  for (let offset = 0; offset < tokens.length; offset += 96) {
    const batch = tokens.slice(offset, offset + 96), analyzed = await analyzer.analyze(batch);
    batch.forEach((token, i) => tokenTerms.set(token, terms(analyzed[i])));
  }
  const names = directory.flatMap(row => row.names.map(name => ({ region: row.region, words: words(name) }))).filter(name => name.words.length);
  const previousIds = previousState?.sourceTurnIds || [];
  if (previousState && (!previousIds.length || previousIds.length >= turns.length
    || previousIds.some((id, i) => id !== turns[i]?.turnId))) reject('invalid_record_scope');
  // A validated state retires earlier mentions. Only newer user turns can select
  // a different area; do not rediscover a locality the user has since retracted.
  for (const turn of turns.slice(previousIds.length).reverse()) {
    const query = terms((await analyzer.analyze([turn.text]))[0]);
    const matched = names.filter(name => name.words.every(word => [...tokenTerms.get(word)].some(term => query.has(term))));
    // A full city/rural-municipality name wins over its ambiguous shared base name.
    const specific = matched.filter(name => !matched.some(other => other.words.length > name.words.length
      && name.words.every(word => other.words.some(another => [...tokenTerms.get(word)].some(term => tokenTerms.get(another).has(term))))));
    const regions = [...new Set(specific.map(name => name.region))];
    if (regions.length === 1) return { state: 'mentioned_region', region: regions[0], turn_id: turn.turnId,
      interpretation: 'source_scope_only_not_confirmed_residence' };
    if (regions.length > 1) return { state: 'ambiguous_region', region: null };
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
