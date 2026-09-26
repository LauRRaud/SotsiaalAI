import { fail, stable } from '../contracts.js';
import { validateQuery } from './ranking.js';
import { ESTNLTK_LEXICAL, LEGACY_LEXICAL, MORPHOLOGY_LEXICAL } from './morphology.js';
import { QUERY_STOPWORDS_VERSION } from './query-stopwords.js';
import { LEXICAL_RANK_PLAIN } from './ranking.js';

export const RANKED_FIRST_POLICY = 'ranked-first-nondisplacing-v1';
export const DEFAULT_RETRIEVAL_PROFILE = 'hybrid-estnltk-dependencies-v1';
// The chat's knowledge lane at corpus scale (27.09.2026): the vector2 fast-lexical choices with nine
// ranked seeds in a 10000-token budget. Nine seeds put all anchors of 16/25 development questions in
// context against 12/25 with five; vector weight 1 and 100 candidates were measured and lost.
export const CHAT_PROFILE = 'hybrid-estnltk-chat-v1';
export const RETRIEVAL_PROFILE_IDS = Object.freeze([
  'hybrid-ranked-first-v1', 'hybrid-ranked-first-neighbors-v1', 'vector-ranked-first-v1',
  'hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1',
  'hybrid-source-dependencies-v1', 'vector-source-dependencies-v1',
  'hybrid-multilingual-dependencies-v1',
  DEFAULT_RETRIEVAL_PROFILE,
  'hybrid-estnltk-vector2-dependencies-v1',
  'hybrid-estnltk-fast-lexical-dependencies-v1', 'hybrid-estnltk-vector2-fast-lexical-dependencies-v1',
  CHAT_PROFILE,
]);

/** Explicit pilot budgets; the existing selector already adds seeds before neighbors. */
export function retrievalProfile(profileId = DEFAULT_RETRIEVAL_PROFILE) {
  if (!RETRIEVAL_PROFILE_IDS.includes(profileId)) fail('unknown_retrieval_profile');
  // Separate space for indexed structural neighbors. Historical profiles keep
  // their exact budgets; expansion must never replace the fifth ranked source.
  const expanded = ['hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1'].includes(profileId);
  const multilingual = profileId === 'hybrid-multilingual-dependencies-v1';
  // Vector weight 2 (ADR-022): on free situation descriptions the lexical channel's stopword
  // matches outranked the vector's relevant hits; the article benchmark kept 17/18.
  // Fast lexical (Codex lexical audit, 26.09.2026): the versioned query stopwords and the plain rank,
  // which kept all 22 corpus questions under the SQL limit where the cover-density rank timed out on 18.
  const chat = profileId === CHAT_PROFILE;
  const fastLexical = profileId.includes('-fast-lexical-') || chat;
  const vector2 = ['hybrid-estnltk-vector2-dependencies-v1', 'hybrid-estnltk-vector2-fast-lexical-dependencies-v1', CHAT_PROFILE].includes(profileId);
  const estnltk = profileId === 'hybrid-estnltk-dependencies-v1' || vector2 || fastLexical;
  const dependencies = estnltk || multilingual || profileId.includes('-source-dependencies-');
  return {
    schema_version: 'rag-v2/retrieval-profile-1', id: profileId, selection_policy: RANKED_FIRST_POLICY,
    generation_requirements: { ranking: 'rrf-v1', rrf_constant: 60, lexical: estnltk ? ESTNLTK_LEXICAL : multilingual ? MORPHOLOGY_LEXICAL : LEGACY_LEXICAL },
    allow_lexical_fallback: false,
    query: {
      method: profileId.startsWith('vector-') ? 'vector' : 'hybrid',
      graph: expanded || profileId === 'hybrid-ranked-first-neighbors-v1',
      ...(dependencies ? { semanticGraph: true } : {}),
      ...(vector2 ? { channelWeights: { lexical: 1, vector: 2 } } : {}),
      ...(fastLexical ? { lexicalStopwords: QUERY_STOPWORDS_VERSION, lexicalRank: LEXICAL_RANK_PLAIN } : {}),
      includeDocumentLabels: false, contextMode: 'compact', finalLimit: dependencies ? 9 : expanded ? 7 : 5,
      limits: { topK: chat ? 9 : 5, perDocument: dependencies ? 9 : expanded ? 7 : 5, candidates: 40, contextTokens: chat ? 10000 : 6000, graphSteps: 8, graphAdditions: 2,
        ...(dependencies ? { dependencySteps: 16, dependencyAdditions: 4 } : {}) },
    },
  };
}

/** Caller supplies the question/scope, never overrides this version's selection limits. */
export function queryForProfile(profile, input) {
  if (!profile || stable(profile) !== stable(retrievalProfile(profile.id))) fail('retrieval_profile_mismatch');
  if (!input || Object.keys(input).some(key => !['text', 'language', 'filters', 'generation_id'].includes(key))) fail('profile_query_override');
  return validateQuery({ ...profile.query, ...input, limits: { ...profile.query.limits } });
}

export function assertProfileGeneration(profile, generation) {
  const expected = retrievalProfile(profile.id);
  if (stable(profile) !== stable(expected)) fail('retrieval_profile_mismatch');
  for (const [key, value] of Object.entries(expected.generation_requirements)) {
    if (generation.config[key] !== value) fail('profile_generation_mismatch');
  }
}
