// Graph-lite retrieval channel (track C2). Deterministic entity matching from
// the user question plus 1-hop traversal over RagRelation. Behind the
// RAG_GRAPH_CHANNEL_ENABLED flag (default off): the channel returns retrieval
// HINTS (entity names, related items, evidence document refs) that the
// orchestrator may use as extra query anchors — it never produces answer text
// and never bypasses source attribution.

import { normalizeEntityName } from "./graphSchema.js";

const ENTITY_CACHE_TTL_MS = Number(process.env.RAG_GRAPH_ENTITY_CACHE_TTL_MS || 5 * 60 * 1000);
const MATCHABLE_TYPES = Object.freeze(["SERVICE", "BENEFIT", "MUNICIPALITY", "ORGANIZATION"]);
const MAX_MATCHED_ENTITIES = 4;
const MAX_HINTS_PER_ENTITY = 8;

// Generic single tokens that must not match an entity on their own
// (e.g. the bare word "teenus" or a municipality word like "vald").
const WEAK_TOKENS = new Set(["teenus", "teenused", "toetus", "toetused", "vald", "linn", "valla", "linna", "keskus", "info"]);

let entityCache = { rows: null, loadedAt: 0 };

export function isGraphChannelEnabled(env = process.env) {
  return String(env.RAG_GRAPH_CHANNEL_ENABLED || "").trim() === "1";
}

export function _resetGraphEntityCacheForTests() {
  entityCache = { rows: null, loadedAt: 0 };
}

async function loadMatchableEntities(prisma) {
  const now = Date.now();
  if (entityCache.rows && now - entityCache.loadedAt < ENTITY_CACHE_TTL_MS) return entityCache.rows;
  const rows = await prisma.ragEntity.findMany({
    where: { type: { in: [...MATCHABLE_TYPES] }, reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] } },
    select: { id: true, type: true, name: true, normalizedName: true, externalKey: true }
  });
  entityCache = { rows, loadedAt: now };
  return rows;
}

// Municipality names are almost never spoken in full: people ask "kas Kuusalus
// on koduteenus?", not "Kuusalu vallas". Match the distinctive stem (name minus
// the trailing vald/linn word) with Estonian case-ending tolerance.
function municipalityStem(normalizedName = "") {
  const tokens = normalizedName.split(" ").filter(Boolean);
  if (tokens.length >= 2 && (tokens[tokens.length - 1] === "vald" || tokens[tokens.length - 1] === "linn")) {
    return tokens.slice(0, -1).join(" ");
  }
  return "";
}

function stemRegex(stem) {
  const lastSpace = stem.lastIndexOf(" ");
  const head = lastSpace === -1 ? "" : stem.slice(0, lastSpace + 1);
  const last = lastSpace === -1 ? stem : stem.slice(lastSpace + 1);
  // Short stems get a tighter suffix window to avoid prefix false positives
  // (e.g. stem "rae" must not match "raekoja").
  const suffix = last.length >= 4 ? "{0,4}" : "{0,2}";
  return new RegExp(`(^| )${head}${last}[a-z]${suffix}( |$)`);
}

export function matchEntitiesInText(question = "", entities = [], { limit = MAX_MATCHED_ENTITIES } = {}) {
  const normalizedQuestion = ` ${normalizeEntityName(question)} `;
  if (!normalizedQuestion.trim()) return [];
  const matches = [];
  for (const entity of entities) {
    const name = entity.normalizedName || "";
    if (!name || name.length < 4) continue;
    const tokens = name.split(" ").filter(Boolean);
    if (tokens.length === 1 && WEAK_TOKENS.has(tokens[0])) continue;
    let hit = false;
    if (normalizedQuestion.includes(` ${name} `)) hit = true;
    else if (tokens.length === 1 && tokens[0].length >= 6) {
      // Single distinctive word (e.g. "koduteenus"): allow Estonian inflected
      // forms by prefix match ("koduteenusel", "koduteenuse").
      hit = new RegExp(`(^| )${tokens[0]}[a-z]{0,4}( |$)`).test(normalizedQuestion);
    } else if (entity.type === "MUNICIPALITY") {
      // "Kuusalus", "Kuusalu valla", "Paides" — match the stem with inflection
      // tolerance. Several municipalities may share a stem; keep them all and
      // let downstream municipality scoping decide.
      const stem = municipalityStem(name);
      if (stem && stem.length >= 3) hit = stemRegex(stem).test(normalizedQuestion);
    }
    if (hit) matches.push(entity);
  }
  // Prefer longer (more specific) names. The cap is applied by the caller AFTER
  // municipality scoping (graphChannelLookup), so a question naming one
  // municipality but matching a service that exists in all 78 bundles is not
  // truncated to arbitrary municipalities before scoping runs.
  matches.sort((a, b) => (b.normalizedName?.length || 0) - (a.normalizedName?.length || 0));
  return Number.isFinite(limit) ? matches.slice(0, limit) : matches;
}

function municipalityIdFromKey(externalKey = "") {
  if (externalKey.startsWith("municipality:")) return externalKey.slice("municipality:".length);
  if (externalKey.startsWith("kov_item:")) {
    const rest = externalKey.slice("kov_item:".length);
    const sep = rest.indexOf(":");
    return sep === -1 ? "" : rest.slice(0, sep);
  }
  return "";
}

// Per-municipality item entities (kov_item:*) only make sense when we know
// WHICH municipality the user means — the same service name exists in all 78
// bundles and an alphabetical pick links the question to arbitrary
// municipalities. Scope items to municipalities named in the question or
// carried by the conversation; with no municipality context, drop them.
export function scopeMatchesToMunicipalities(matched = [], { contextMunicipalityIds = [] } = {}) {
  const ids = new Set(contextMunicipalityIds.filter(Boolean));
  for (const entity of matched) {
    if (entity.type === "MUNICIPALITY") {
      const id = municipalityIdFromKey(entity.externalKey || "");
      if (id) ids.add(id);
    }
  }
  return matched.filter(entity => {
    const key = entity.externalKey || "";
    if (!key.startsWith("kov_item:")) return true;
    if (ids.size === 0) return false;
    return ids.has(municipalityIdFromKey(key));
  });
}

// Resolves conversation municipality names ("Kuusalu vald") to graph
// municipality ids ("kuusalu_vald") via MUNICIPALITY entity normalized names.
export function resolveMunicipalityIds(municipalityNames = [], entities = []) {
  const wanted = new Set(
    (Array.isArray(municipalityNames) ? municipalityNames : [])
      .map(name => normalizeEntityName(name))
      .filter(Boolean)
  );
  if (wanted.size === 0) return [];
  const ids = [];
  for (const entity of entities) {
    if (entity.type !== "MUNICIPALITY") continue;
    if (!wanted.has(entity.normalizedName || "")) continue;
    const id = municipalityIdFromKey(entity.externalKey || "");
    if (id) ids.push(id);
  }
  return ids;
}

function hintFromRelation(relation, direction) {
  const other = direction === "out" ? relation.toEntity : relation.fromEntity;
  if (!other) return null;
  return {
    relation_type: relation.relationType,
    entity_type: other.type,
    name: other.name,
    external_key: other.externalKey,
    source_document_id: relation.sourceDocumentId || null,
    evidence_ref: relation.evidenceRef || null
  };
}

export async function graphChannelLookup({ question = "", prisma, municipalityNames = [] }) {
  if (!prisma) return { enabled: false, matched_entities: [], hints: [] };
  const entities = await loadMatchableEntities(prisma);
  const contextMunicipalityIds = resolveMunicipalityIds(municipalityNames, entities);
  // Match uncapped, scope to the relevant municipalities, THEN cap — otherwise a
  // same-name service across many municipalities would crowd out the right one.
  const scoped = scopeMatchesToMunicipalities(
    matchEntitiesInText(question, entities, { limit: Infinity }),
    { contextMunicipalityIds }
  );
  const matched = scoped.slice(0, MAX_MATCHED_ENTITIES);
  if (matched.length === 0) return { enabled: true, matched_entities: [], hints: [] };

  const ids = matched.map(entity => entity.id);
  const relations = await prisma.ragRelation.findMany({
    where: {
      OR: [{ fromEntityId: { in: ids } }, { toEntityId: { in: ids } }],
      reviewStatus: { in: ["AUTO_APPROVED", "APPROVED"] }
    },
    include: {
      fromEntity: { select: { id: true, type: true, name: true, externalKey: true } },
      toEntity: { select: { id: true, type: true, name: true, externalKey: true } }
    },
    take: 200
  });

  const hintsByEntity = new Map();
  for (const relation of relations) {
    for (const matchedEntity of matched) {
      let hint = null;
      if (relation.fromEntityId === matchedEntity.id) hint = hintFromRelation(relation, "out");
      else if (relation.toEntityId === matchedEntity.id) hint = hintFromRelation(relation, "in");
      if (!hint) continue;
      const list = hintsByEntity.get(matchedEntity.externalKey) || [];
      if (list.length < MAX_HINTS_PER_ENTITY && !list.some(existing => existing.external_key === hint.external_key && existing.relation_type === hint.relation_type)) {
        list.push(hint);
      }
      hintsByEntity.set(matchedEntity.externalKey, list);
    }
  }

  return {
    enabled: true,
    matched_entities: matched.map(entity => ({
      type: entity.type,
      name: entity.name,
      external_key: entity.externalKey
    })),
    hints: [...hintsByEntity.entries()].map(([externalKey, list]) => ({
      entity_external_key: externalKey,
      related: list
    }))
  };
}

// Default cap for how many graph-origin documents may enter the displayed
// sources (C2 graph quota). Tunable via env without redeploy.
export const GRAPH_CHANNEL_MAX_DISPLAYED = Math.max(
  0,
  Number(process.env.RAG_GRAPH_CHANNEL_MAX_SLOTS || 3) || 0
);

// Budget for the separate graph-channel search. The graph channel runs as its
// own pass (not mixed into the native queries) so native retrieval keeps its
// full per-query depth — graph never steals native slots. searchRagQueries
// splits topK across the graph queries, so scale the budget with their count
// but keep a modest ceiling (the supplement is quota-capped anyway).
export function graphChannelSearchTopK(queryCount, { perQueryDepth = 6, max = 18 } = {}) {
  const queries = Math.max(0, Number(queryCount) || 0);
  if (queries === 0) return 0;
  return Math.min(max, Math.max(perQueryDepth, perQueryDepth * queries));
}

// Identity key for a retrieved match, mirroring dedupeRagMatches so the graph
// supplement can tell which documents native retrieval already found.
export function ragMatchKey(match) {
  const md = (match && match.metadata) || {};
  return String(
    match?.id || md.chunk_id || md.chunkId || md.doc_id || md.docId || match?.text || ""
  ).slice(0, 220);
}

function graphMatchScore(match) {
  const candidates = [match?.hybrid_score, match?.hybridScore, match?.score, match?.rrf_score];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

// Graph quota (C2): from the separate graph-channel search keep only documents
// native retrieval did NOT already surface (native wins), tag them
// retrieval_channel=graph, and cap to the highest-scoring `maxSlots`. The graph
// channel therefore supplements the displayed sources by at most a few clearly
// marked slots and never displaces native candidates.
export function selectGraphChannelSupplement(nativeMatches = [], graphMatches = [], maxSlots = GRAPH_CHANNEL_MAX_DISPLAYED) {
  const cap = Math.max(0, Number(maxSlots) || 0);
  if (cap === 0) return [];
  const nativeKeys = new Set(
    (Array.isArray(nativeMatches) ? nativeMatches : []).map(ragMatchKey).filter(Boolean)
  );
  const seen = new Set();
  const candidates = [];
  for (const match of Array.isArray(graphMatches) ? graphMatches : []) {
    const key = ragMatchKey(match);
    if (!key || nativeKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    candidates.push(match);
  }
  candidates.sort((a, b) => graphMatchScore(b) - graphMatchScore(a));
  return candidates.slice(0, cap).map(match => ({
    ...match,
    graph_channel_origin: true,
    retrieval_channel_graph: true
  }));
}

// Converts graph hints into extra retrieval query strings the orchestrator can
// append (broad-first). Pure helper, easy to test.
export function graphHintsToQueryTexts(lookup = {}, { maxQueries = 3 } = {}) {
  const queries = [];
  for (const group of lookup.hints || []) {
    const matched = (lookup.matched_entities || []).find(entity => entity.external_key === group.entity_external_key);
    if (!matched) continue;
    const related = (group.related || [])
      .filter(hint => ["HAS_FORM", "HAS_CONTACT_POINT", "HAS_LEGAL_BASIS", "AVAILABLE_IN", "REGULATES"].includes(hint.relation_type))
      .slice(0, 3)
      .map(hint => hint.name)
      .filter(Boolean);
    if (related.length > 0) queries.push(`${matched.name} ${related.join(" ")}`);
    if (queries.length >= maxQueries) break;
  }
  return queries;
}
