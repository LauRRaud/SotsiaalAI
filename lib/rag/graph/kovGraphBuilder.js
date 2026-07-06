// Deterministic graph-lite builder for KOV canonical bundles
// (KOV/<slug>/<slug>.json). No LLM involvement: entities and relations come
// only from structured fields, every relation carries an evidence reference
// to the bundle document and canonical item. Free-text fields (targetGroup,
// conditions) are deliberately NOT turned into entities in phase 1.

import {
  normalizeEntityName,
  validateGraphEntity,
  validateGraphRelation
} from "./graphSchema.js";

const ITEM_TYPE_TO_ENTITY_TYPE = Object.freeze({
  service: "SERVICE",
  benefit: "BENEFIT",
  form: "FORM",
  contact: "CONTACT_POINT"
});

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function municipalityKey(municipalityId) {
  return `municipality:${municipalityId}`;
}

function itemKey(municipalityId, item) {
  const canonical = item.canonical_item_id || item.canonicalItemId || item.id;
  return `kov_item:${municipalityId}:${canonical}`;
}

function makeEvidence(bundle, item = null) {
  const municipalityId = bundle.municipality_id || bundle.municipalityId || null;
  // Older canonical bundles carry no docId; fall back to a deterministic
  // reference to the canonical bundle file itself so evidence is never empty.
  const sourceDocumentId = bundle.docId || bundle.document_id
    || (municipalityId ? `kov_bundle:${municipalityId}` : null);
  return {
    source_document_id: sourceDocumentId,
    canonical_item_id: item ? item.canonical_item_id || item.canonicalItemId || item.id || null : null,
    chunk_id: null
  };
}

export function buildKovGraph(bundle = {}, options = {}) {
  const warnings = [];
  const entities = new Map();
  const relations = [];

  const municipalityId = bundle.municipality_id || bundle.municipalityId;
  const municipalityName = bundle.municipality_name || bundle.municipality || municipalityId;
  if (!hasValue(municipalityId)) {
    return { entities: [], relations: [], warnings: ["bundle has no municipality_id; skipped"] };
  }

  const addEntity = entity => {
    const validation = validateGraphEntity(entity);
    if (!validation.ok) {
      warnings.push(`entity rejected (${entity.externalKey || entity.name}): ${validation.errors.join("; ")}`);
      return null;
    }
    if (!entities.has(entity.externalKey)) entities.set(entity.externalKey, entity);
    return entities.get(entity.externalKey);
  };

  const municipality = addEntity({
    type: "MUNICIPALITY",
    name: municipalityName,
    normalizedName: normalizeEntityName(municipalityName),
    externalKey: municipalityKey(municipalityId),
    description: bundle.county ? `Omavalitsus, ${bundle.county}` : "Omavalitsus",
    confidence: 1,
    reviewStatus: "AUTO_APPROVED",
    evidence: makeEvidence(bundle)
  });

  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const itemByLocalId = new Map();
  for (const item of items) {
    if (hasValue(item.id)) itemByLocalId.set(String(item.id), item);
  }

  const entityKeyByLocalId = new Map();

  for (const item of items) {
    const itemType = String(item.itemType || item.item_type || "").toLowerCase();
    const entityType = ITEM_TYPE_TO_ENTITY_TYPE[itemType];
    if (!entityType) {
      if (!["resource"].includes(itemType)) {
        warnings.push(`item ${item.id}: unsupported itemType "${itemType}", skipped`);
      }
      continue;
    }
    const externalKey = itemKey(municipalityId, item);
    const entity = addEntity({
      type: entityType,
      name: item.title || item.id,
      normalizedName: normalizeEntityName(item.title || item.id),
      externalKey,
      description: hasValue(item.summary) ? String(item.summary).slice(0, 600) : null,
      aliases: [],
      roles: [],
      confidence: 1,
      reviewStatus: "AUTO_APPROVED",
      sourceUrl: item.officialUrl || item.url_canonical || null,
      evidence: makeEvidence(bundle, item)
    });
    if (entity) entityKeyByLocalId.set(String(item.id), externalKey);
  }

  const addRelation = relation => relations.push(relation);

  for (const item of items) {
    const fromKey = entityKeyByLocalId.get(String(item.id));
    if (!fromKey) continue;
    const itemType = String(item.itemType || item.item_type || "").toLowerCase();
    const evidence = makeEvidence(bundle, item);

    if (["service", "benefit"].includes(itemType) && municipality) {
      addRelation({
        fromKey,
        toKey: municipality.externalKey,
        relationType: "AVAILABLE_IN",
        confidence: 1,
        reviewStatus: "AUTO_APPROVED",
        extractor: "deterministic_kov_v1",
        evidence
      });
    }
    if (["form", "contact"].includes(itemType) && municipality) {
      addRelation({
        fromKey,
        toKey: municipality.externalKey,
        relationType: "BELONGS_TO",
        confidence: 1,
        reviewStatus: "AUTO_APPROVED",
        extractor: "deterministic_kov_v1",
        evidence
      });
    }

    const related = [
      ...(Array.isArray(item.relatedForms) ? item.relatedForms.map(id => ["HAS_FORM", id]) : []),
      ...(Array.isArray(item.relatedContacts) ? item.relatedContacts.map(id => ["HAS_CONTACT_POINT", id]) : [])
    ];
    for (const [relationType, localId] of related) {
      const toKey = entityKeyByLocalId.get(String(localId));
      if (!toKey) {
        warnings.push(`item ${item.id}: ${relationType} target "${localId}" not found in bundle items`);
        continue;
      }
      addRelation({
        fromKey,
        toKey,
        relationType,
        confidence: 1,
        reviewStatus: "AUTO_APPROVED",
        extractor: "deterministic_kov_v1",
        evidence
      });
    }
  }

  const entityTypeByKey = new Map([...entities.values()].map(entity => [entity.externalKey, entity.type]));
  const validRelations = [];
  for (const relation of relations) {
    const validation = validateGraphRelation(relation, entityTypeByKey);
    if (!validation.ok) {
      warnings.push(`relation rejected (${relation.fromKey} ${relation.relationType} ${relation.toKey}): ${validation.errors.join("; ")}`);
      continue;
    }
    validRelations.push(relation);
  }

  return {
    municipality_id: municipalityId,
    entities: [...entities.values()],
    relations: validRelations,
    warnings
  };
}

export function mergeGraphBuilds(builds = []) {
  const entities = new Map();
  const relations = [];
  const seenRelations = new Set();
  const warnings = [];

  for (const build of builds) {
    for (const entity of build.entities || []) {
      if (!entities.has(entity.externalKey)) entities.set(entity.externalKey, entity);
    }
    for (const relation of build.relations || []) {
      const key = `${relation.fromKey}|${relation.relationType}|${relation.toKey}|${relation.evidence?.source_document_id || ""}`;
      if (seenRelations.has(key)) continue;
      seenRelations.add(key);
      relations.push(relation);
    }
    warnings.push(...(build.warnings || []));
  }

  return {
    entities: [...entities.values()],
    relations,
    warnings,
    summary: {
      entity_count: entities.size,
      relation_count: relations.length,
      by_entity_type: [...entities.values()].reduce((acc, entity) => {
        acc[entity.type] = (acc[entity.type] || 0) + 1;
        return acc;
      }, {}),
      by_relation_type: relations.reduce((acc, relation) => {
        acc[relation.relationType] = (acc[relation.relationType] || 0) + 1;
        return acc;
      }, {}),
      warning_count: warnings.length
    }
  };
}
