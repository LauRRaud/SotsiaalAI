import { KNOWLEDGE_STATE } from '../knowledge.js';

const reverseTypes = new Set(['EXCEPTION_TO', 'DEFINES', 'QUALIFIES', 'SUPERSEDES']);
const contextualTypes = new Set(['REQUIRES', ...reverseTypes]);
const spansKey = (version, span) => `${version}/${span}`;

/** Traverse imported, source-anchored dependencies as retrieval hints, never as rules. */
export function expandDependencies({ bundles, units, selected, add, limits }) {
  const cards = new Map(), documents = new Map(), outgoing = new Map(), incoming = new Map(), bySpan = new Map();
  const bundleByDoc = new Map(bundles.map(bundle => [bundle.document.id, bundle]));
  const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const unit of units) {
    const bundle = bundleByDoc.get(unit.document_id), chunk = bundle.chunks.find(c => c.id === unit.chunk_id);
    for (const span of chunk.span_ids) push(bySpan, spansKey(unit.version_id, span), unit);
  }
  for (const bundle of bundles) {
    documents.set(bundle.document.id, bundle.version.id);
    for (const card of bundle.knowledge_cards || []) cards.set(card.id, { ...card, document_id: bundle.document.id });
    for (const edge of bundle.dependencies || []) {
      const owned = { ...edge, document_id: bundle.document.id };
      if (!contextualTypes.has(edge.type)) continue; // Topic/citation links are not mandatory context.
      push(outgoing, edge.from_card_id, owned);
      if (reverseTypes.has(edge.type)) for (const target of edge.targets) push(incoming, target.card_id, owned);
    }
  }
  const initialSpans = new Map();
  selected.forEach((entry, rank) => entry.span_ids.forEach(span => {
    const key = spansKey(entry.document_version_id, span);
    if (!initialSpans.has(key)) initialSpans.set(key, rank);
  }));
  const seedRank = card => Math.min(...card.span_ids.map(span => initialSpans.get(spansKey(card.document_version_id, span)) ?? Infinity));
  const seeds = [...cards.values()].filter(card => Number.isFinite(seedRank(card)))
    .sort((a, b) => seedRank(a) - seedRank(b) || a.id.localeCompare(b.id));
  const queue = seeds.slice(0, limits.dependencySteps).map(card => card.id), visited = new Set(), edges = new Map(), relevant = new Set(queue), unresolved = [];
  let steps = 0, additions = 0;
  if (seeds.length > queue.length) unresolved.push({ reason: 'dependency_seed_limit' });
  function includeSource(entity, edge) {
    const required = [...new Map(entity.span_ids.flatMap(span => bySpan.get(spansKey(entity.document_version_id, span)) || []).map(unit => [unit.id, unit])).values()];
    for (const unit of required) {
      if (selected.some(entry => entry.unit_id === unit.id)) continue;
      if (additions >= limits.dependencyAdditions) { unresolved.push({ card_id: entity.id, edge_id: edge?.id, reason: 'dependency_addition_limit' }); return; }
      if (add(unit, { type: 'semantic_dependency', card_id: entity.id, dependency_id: edge?.id ?? null,
        verification_state: KNOWLEDGE_STATE })) additions++;
      else unresolved.push({ card_id: entity.id, edge_id: edge?.id, reason: 'dependency_context_limit' });
    }
  }
  while (queue.length && steps < limits.dependencySteps) {
    const cardId = queue.shift();
    if (visited.has(cardId)) continue;
    visited.add(cardId); steps++;
    const card = cards.get(cardId);
    if (!card) continue;
    includeSource(card);
    for (const edge of [...new Map([...(outgoing.get(cardId) || []), ...(incoming.get(cardId) || [])].map(edge => [edge.id, edge])).values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const reverse = edge.from_card_id !== cardId;
      if (reverse && !edge.targets.some(target => target.card_id === cardId
        && target.document_id === card.document_id && target.document_version_id === card.document_version_id)) continue;
      // Count distinct edges too: a single source card cannot fan out without limit.
      if (!edges.has(edge.id)) {
        if (edges.size >= limits.dependencySteps) { unresolved.push({ card_id: cardId, reason: 'dependency_edge_limit' }); break; }
        edges.set(edge.id, edge); includeSource(edge, edge);
      }
      const next = reverse ? [{ card_id: edge.from_card_id, document_id: edge.document_id, document_version_id: edge.document_version_id }] : edge.targets;
      for (const target of next) {
        if (documents.get(target.document_id) !== target.document_version_id || !cards.has(target.card_id)) {
          unresolved.push({ edge_id: edge.id, card_id: cardId, reason: 'dependency_target_unavailable' }); continue;
        }
        relevant.add(target.card_id);
        includeSource(cards.get(target.card_id), edge);
        if (!visited.has(target.card_id) && !queue.includes(target.card_id)) queue.push(target.card_id);
      }
    }
  }
  if (queue.some(key => !visited.has(key))) unresolved.push({ reason: 'dependency_step_limit' });
  return { cards, edges: [...edges.values()], relevant, unresolved, steps, additions };
}

/** Regenerated after the live policy check; no unavailable document IDs reach the model. */
export function dependencyContext(plan, evidence, allowedDocuments) {
  const allowed = new Set(allowedDocuments), refSpans = evidence.map((entry, index) => ({ ref: `S${index + 1}`, version: entry.document_version_id, spans: new Set(entry.span_ids) }));
  const refsFor = entity => {
    const refs = refSpans.filter(ref => ref.version === entity.document_version_id && entity.span_ids.some(span => ref.spans.has(span)));
    const covered = new Set(refs.flatMap(ref => [...ref.spans]));
    return entity.span_ids.every(span => covered.has(span)) ? refs.map(ref => ref.ref) : [];
  };
  const claims = [], keys = new Map(), unresolved = [];
  for (const cardId of plan.relevant) {
    const card = plan.cards.get(cardId);
    if (!card || !allowed.has(card.document_id)) continue;
    const refs = refsFor(card);
    if (!refs.length) { unresolved.push({ reason: 'claim_source_context_missing' }); continue; }
    const key = `K${claims.length + 1}`; keys.set(card.id, key);
    claims.push({ key, kind: card.kind, statement: card.statement, scope: card.scope, refs,
      verification_state: card.verification_state,
      ...(card.subject === undefined ? {} : { subject: card.subject, predicate: card.predicate, object: card.object }) });
  }
  const relations = [];
  for (const edge of plan.edges) {
    if (!allowed.has(edge.document_id)) continue;
    const from = keys.get(edge.from_card_id), targets = edge.targets.map(target => {
      const card = plan.cards.get(target.card_id);
      return card?.document_id === target.document_id && card.document_version_id === target.document_version_id ? keys.get(target.card_id) : undefined;
    }), refs = refsFor(edge);
    if (!from || targets.some(target => !target) || !refs.length) {
      unresolved.push({ ...(from ? { from } : {}), type: edge.type, operator: edge.operator, reason: 'dependency_context_unavailable' }); continue;
    }
    relations.push({ type: edge.type, from, targets, operator: edge.operator, scope: edge.scope, refs,
      verification_state: edge.verification_state, applicability: 'unknown' });
  }
  for (const pending of plan.unresolved) {
    const card = plan.cards.get(pending.card_id), edge = plan.edges.find(edge => edge.id === pending.edge_id);
    if (card && !allowed.has(card.document_id) || edge && !allowed.has(edge.document_id)) continue;
    if (!card && !edge && !evidence.length) continue;
    unresolved.push({ ...(keys.has(pending.card_id) ? { from: keys.get(pending.card_id) } : {}), reason: pending.reason });
  }
  return { schema_version: 'rag-v2/dependency-context-1', known_context: unresolved.length ? 'incomplete' : 'included',
    corpus_completeness: 'not_assessed', verification_state: KNOWLEDGE_STATE,
    claims, relations, unresolved: [...new Map(unresolved.map(item => [JSON.stringify(item), item])).values()] };
}
