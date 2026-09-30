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
// ADR-054: the same nine ranked seeds and budget, plus room the semantic graph alone may use: four more sources in 3000
// tokens. With nine seeds in nine final places the chat's graph could add no source (29.09 pilot: 0 of 10 questions).
export const CHAT_GRAPH_PROFILE = 'hybrid-estnltk-chat-v2';
// ADR-057: the chat's v1 (its knowledge cards included) plus the act's own cross-references of the selected passages,
// four more sources in 3000 tokens that only a cross-reference may use. The graph experiment's arm D found the deciding
// condition in 7 of 9 hard questions against 3 without a graph and 5 with the cards; this profile measures the whole chat.
export const CHAT_REFERENCES_PROFILE = 'hybrid-estnltk-chat-v3';
// The graph experiment (Codex follow-up review 29.09, 7.7): the chat's knowledge lane with no graph at all, nine ranked
// seeds in 10000 tokens (A), and four arms that each get the same extra room, four more sources in 3000 tokens (13 and
// 13000 in all), for one kind of addition only: more ranked text (B), the knowledge cards and their dependencies (C), the
// act's own cross-references (D) or the structural neighbours in the section (E). For measurement, not for the chat.
export const GRAPH_EXPERIMENT_PROFILES = Object.freeze({ A: 'experiment-graph-a-base-v1', B: 'experiment-graph-b-text-v1',
  C: 'experiment-graph-c-cards-v1', D: 'experiment-graph-d-references-v1', E: 'experiment-graph-e-neighbours-v1' });
export const RETRIEVAL_PROFILE_IDS = Object.freeze([
  'hybrid-ranked-first-v1', 'hybrid-ranked-first-neighbors-v1', 'vector-ranked-first-v1',
  'hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1',
  'hybrid-source-dependencies-v1', 'vector-source-dependencies-v1',
  'hybrid-multilingual-dependencies-v1',
  DEFAULT_RETRIEVAL_PROFILE,
  'hybrid-estnltk-vector2-dependencies-v1',
  'hybrid-estnltk-fast-lexical-dependencies-v1', 'hybrid-estnltk-vector2-fast-lexical-dependencies-v1',
  CHAT_PROFILE, CHAT_GRAPH_PROFILE, CHAT_REFERENCES_PROFILE, ...Object.values(GRAPH_EXPERIMENT_PROFILES),
]);

function experimentProfile(id, arm) {
  const extra = arm !== 'A', text = arm === 'B';
  return {
    schema_version: 'rag-v2/retrieval-profile-1', id, selection_policy: RANKED_FIRST_POLICY,
    generation_requirements: { ranking: 'rrf-v1', rrf_constant: 60, lexical: ESTNLTK_LEXICAL },
    allow_lexical_fallback: false,
    query: {
      method: 'hybrid', graph: arm === 'E', ...(arm === 'C' ? { semanticGraph: true } : {}), ...(arm === 'D' ? { references: true } : {}),
      channelWeights: { lexical: 1, vector: 2 }, lexicalStopwords: QUERY_STOPWORDS_VERSION, lexicalRank: LEXICAL_RANK_PLAIN,
      includeDocumentLabels: false, contextMode: 'compact', finalLimit: extra ? 13 : 9,
      limits: { topK: text ? 13 : 9, perDocument: extra ? 13 : 9, candidates: 40, contextTokens: text ? 13000 : 10000,
        graphSteps: arm === 'E' ? 16 : 8, graphAdditions: arm === 'E' ? 4 : 2,
        ...(arm === 'C' ? { dependencySteps: 16, dependencyAdditions: 4, dependencyContextTokens: 3000 } : {}),
        ...(arm === 'D' ? { referenceAdditions: 4, expansionContextTokens: 3000 } : {}),
        ...(arm === 'E' ? { expansionContextTokens: 3000 } : {}) },
    },
  };
}

/** Explicit pilot budgets; the existing selector already adds seeds before neighbors. */
export function retrievalProfile(profileId = DEFAULT_RETRIEVAL_PROFILE) {
  if (!RETRIEVAL_PROFILE_IDS.includes(profileId)) fail('unknown_retrieval_profile');
  const arm = Object.keys(GRAPH_EXPERIMENT_PROFILES).find(key => GRAPH_EXPERIMENT_PROFILES[key] === profileId);
  if (arm) return experimentProfile(profileId, arm);
  // Separate space for indexed structural neighbors. Historical profiles keep
  // their exact budgets; expansion must never replace the fifth ranked source.
  const expanded = ['hybrid-ranked-first-neighbors-v2', 'vector-ranked-first-neighbors-v1'].includes(profileId);
  const multilingual = profileId === 'hybrid-multilingual-dependencies-v1';
  // Vector weight 2 (ADR-022): on free situation descriptions the lexical channel's stopword
  // matches outranked the vector's relevant hits; the article benchmark kept 17/18.
  // Fast lexical (Codex lexical audit, 26.09.2026): the versioned query stopwords and the plain rank,
  // which kept all 22 corpus questions under the SQL limit where the cover-density rank timed out on 18.
  const chat = [CHAT_PROFILE, CHAT_GRAPH_PROFILE, CHAT_REFERENCES_PROFILE].includes(profileId), chatGraph = profileId === CHAT_GRAPH_PROFILE;
  const chatReferences = profileId === CHAT_REFERENCES_PROFILE, roomy = chatGraph || chatReferences;
  const fastLexical = profileId.includes('-fast-lexical-') || chat;
  const vector2 = ['hybrid-estnltk-vector2-dependencies-v1', 'hybrid-estnltk-vector2-fast-lexical-dependencies-v1', CHAT_PROFILE, CHAT_GRAPH_PROFILE,
    CHAT_REFERENCES_PROFILE].includes(profileId);
  const estnltk = profileId === 'hybrid-estnltk-dependencies-v1' || vector2 || fastLexical;
  const dependencies = estnltk || multilingual || profileId.includes('-source-dependencies-');
  return {
    schema_version: 'rag-v2/retrieval-profile-1', id: profileId, selection_policy: RANKED_FIRST_POLICY,
    generation_requirements: { ranking: 'rrf-v1', rrf_constant: 60, lexical: estnltk ? ESTNLTK_LEXICAL : multilingual ? MORPHOLOGY_LEXICAL : LEGACY_LEXICAL },
    allow_lexical_fallback: false,
    query: {
      method: profileId.startsWith('vector-') ? 'vector' : 'hybrid',
      graph: expanded || profileId === 'hybrid-ranked-first-neighbors-v1',
      ...(dependencies ? { semanticGraph: true } : {}), ...(chatReferences ? { references: true } : {}),
      ...(vector2 ? { channelWeights: { lexical: 1, vector: 2 } } : {}),
      ...(fastLexical ? { lexicalStopwords: QUERY_STOPWORDS_VERSION, lexicalRank: LEXICAL_RANK_PLAIN } : {}),
      includeDocumentLabels: false, contextMode: 'compact', finalLimit: roomy ? 13 : dependencies ? 9 : expanded ? 7 : 5,
      limits: { topK: chat ? 9 : 5, perDocument: roomy ? 13 : dependencies ? 9 : expanded ? 7 : 5, candidates: 40, contextTokens: chat ? 10000 : 6000, graphSteps: 8, graphAdditions: 2,
        ...(dependencies ? { dependencySteps: 16, dependencyAdditions: 4 } : {}), ...(chatGraph ? { dependencyContextTokens: 3000 } : {}),
        ...(chatReferences ? { referenceAdditions: 4, expansionContextTokens: 3000 } : {}) },
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
