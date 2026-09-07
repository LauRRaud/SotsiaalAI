import { fail, stable } from '../contracts.js';
import { validateQuery } from './ranking.js';

export const RANKED_FIRST_POLICY = 'ranked-first-nondisplacing-v1';
export const DEFAULT_RETRIEVAL_PROFILE = 'hybrid-ranked-first-v1';
export const RETRIEVAL_PROFILE_IDS = Object.freeze([
  DEFAULT_RETRIEVAL_PROFILE, 'hybrid-ranked-first-neighbors-v1', 'vector-ranked-first-v1',
  'hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1',
]);

/** Explicit pilot budgets; the existing selector already adds seeds before neighbors. */
export function retrievalProfile(profileId = DEFAULT_RETRIEVAL_PROFILE) {
  if (!RETRIEVAL_PROFILE_IDS.includes(profileId)) fail('unknown_retrieval_profile');
  // Separate space for indexed structural neighbors. Historical profiles keep
  // their exact budgets; expansion must never replace the fifth ranked source.
  const expanded = ['hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1'].includes(profileId);
  return {
    schema_version: 'rag-v2/retrieval-profile-1', id: profileId, selection_policy: RANKED_FIRST_POLICY,
    generation_requirements: { ranking: 'rrf-v1', rrf_constant: 60, lexical: 'pg-simple-weighted-or-v1' },
    allow_lexical_fallback: false,
    query: {
      method: profileId.startsWith('vector-') ? 'vector' : 'hybrid',
      graph: expanded || profileId === 'hybrid-ranked-first-neighbors-v1',
      includeDocumentLabels: false, contextMode: 'compact', finalLimit: expanded ? 7 : 5,
      limits: { topK: 5, perDocument: expanded ? 7 : 5, candidates: 40, contextTokens: 6000, graphSteps: 8, graphAdditions: 2 },
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
