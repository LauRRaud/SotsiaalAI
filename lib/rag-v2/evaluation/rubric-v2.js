// Offline evaluation only. This module has no retrieval, provider or database dependency.
import { fail, hash, stable } from '../contracts.js';
import { tokenCount } from '../search/embedding.js';

export const digest = value => hash(stable(value));
const requiredString = value => typeof value === 'string' && value.trim().length > 0;
const humanRoles = ['owner', 'human_reviewer'];
const kinds = ['full', 'partial', 'background', 'contradiction'];
const states = ['full', 'partial', 'absent', 'needs_review'];

export function verifyInputs(results, questions, snapshot, groups) {
  const { provenance, ...payload } = results;
  if (!provenance || digest(payload) !== provenance.result_payload_sha256) fail('v1_payload_mismatch');
  if (digest(questions) !== results.questions_sha256 || digest(groups) !== results.anchor_groups_sha256) fail('v1_evaluation_mismatch');
  if (provenance.corpus.tenant !== snapshot.tenant || provenance.corpus.snapshot_sha256 !== snapshot.snapshot_hash
    || provenance.corpus.source_generation_id !== snapshot.source_generation || provenance.corpus.document_count !== snapshot.bundles.length) fail('v1_corpus_mismatch');
  const methods = ['lexical', 'vector', 'hybrid', 'hybrid_structure'], keys = new Set();
  if (results.rows.length !== questions.cases.length * methods.length) fail('v1_rows_incomplete');
  const byVersion = new Map(snapshot.bundles.map(b => [b.version.id, b]));
  for (const row of results.rows) {
    const question = questions.cases.find(q => q.id === row.question_id), key = `${row.question_id}/${row.method}`;
    if (!question || question.family !== row.family || question.language !== row.language || !methods.includes(row.method) || keys.has(key)) fail('v1_row_mismatch');
    keys.add(key);
    const packet = row.packet;
    if (packet.state === 'error' || packet.tenant !== snapshot.tenant || packet.generation_id !== provenance.corpus.search_generation_id
      || digest(packet.corpus?.documents) !== digest(snapshot.documents)) fail('v1_packet_scope_mismatch');
    for (const entry of packet.evidence) {
      const bundle = byVersion.get(entry.document_version_id), chunk = bundle?.chunks.find(c => c.id === entry.chunk_id);
      if (!chunk || entry.document_id !== bundle.document.id || entry.source_text !== chunk.source_text
        || digest(entry.span_ids) !== digest(chunk.span_ids) || digest(entry.pdf_pages) !== digest(chunk.pdf_pages)) fail('v1_source_mismatch');
      for (const field of ['title', 'authors', 'publication_date']) {
        if (digest(entry.bibliography[field]) !== digest(bundle.document.fields[field].value)) fail('v1_bibliography_mismatch');
      }
    }
    const context = packet.model_context;
    if ((context?.evidence.length ?? 0) !== packet.evidence.length) fail('v1_context_mismatch');
    for (const [i, entry] of packet.evidence.entries()) {
      const shown = context.evidence[i], source = context.sources[shown.source];
      if (shown.text !== entry.source_text || digest(shown.pdf_pages) !== digest(entry.pdf_pages)
        || !source || digest(source.authors) !== digest(entry.bibliography.authors) || source.title !== entry.bibliography.title) fail('v1_context_mismatch');
    }
    if (tokenCount(context === null ? '' : JSON.stringify(context)) !== row.measurements.model_context_tokens) fail('v1_token_mismatch');
  }
  return { payload_sha256: provenance.result_payload_sha256, questions_sha256: results.questions_sha256,
    anchors_sha256: results.anchor_groups_sha256, corpus_sha256: snapshot.snapshot_hash,
    rows: results.rows.length, evidence_entries: results.rows.reduce((n, row) => n + row.packet.evidence.length, 0) };
}

export function resolveAtom(locator, sources, snapshot) {
  const pdfHash = sources[locator.source], bundles = snapshot.bundles.filter(b => b.version.pdf_hash === pdfHash);
  if (bundles.length !== 1) fail('rubric_source_missing');
  const b = bundles[0], base = { pdf_sha256: pdfHash, document_id: b.document.id, version_id: b.version.id,
    title: b.document.fields.title.value };
  if (locator.kind === 'metadata') {
    if (locator.field !== 'authors' || !Array.isArray(locator.value) || !locator.value.length
      || digest(b.document.fields.authors.value) !== digest(locator.value)) fail('rubric_metadata_mismatch');
    return { ...base, kind: 'metadata', field: locator.field, value: locator.value, provenance: b.document.fields.authors.provenance };
  }
  if (!Number.isInteger(locator.page) || !requiredString(locator.start)) fail('invalid_rubric_locator');
  const onPage = b.spans.filter(s => s.pdf_page === locator.page);
  const starts = onPage.filter(s => s.source_text.includes(locator.start));
  if (starts.length !== 1) fail('rubric_locator_not_unique');
  const first = onPage.indexOf(starts[0]);
  const ends = locator.end ? onPage.slice(first).filter(s => s.source_text.includes(locator.end)) : starts;
  if (ends.length !== 1) fail('rubric_locator_end_not_unique');
  const spans = onPage.slice(first, onPage.indexOf(ends[0]) + 1);
  return { ...base, kind: 'spans', pdf_page: locator.page,
    spans: spans.map(s => ({ id: s.id, start: s.start, end: s.end, source_text: s.source_text })),
    text: spans.map(s => s.source_text).join('\n'), locator_purpose: 'location_only_not_semantic_judgment' };
}

export function prepareRubric(spec, snapshot, bindings) {
  if (spec.schema_version !== 'rag-v2/semantic-rubric-proposal-2' || spec.proposed_by?.role !== 'assistant') fail('invalid_rubric_spec');
  const families = Object.fromEntries(Object.entries(spec.families).map(([familyId, family]) => {
    if (!requiredString(family.scope) || !family.requirements?.length) fail('invalid_rubric_family');
    const seen = new Set();
    const requirements = family.requirements.map(req => {
      if (!requiredString(req.id) || seen.has(req.id) || !requiredString(req.meaning) || typeof req.mandatory !== 'boolean'
        || !requiredString(req.scope) || !Array.isArray(req.evidence_sets)) fail('invalid_rubric_requirement');
      seen.add(req.id);
      const setIds = new Set();
      return { ...req, evidence_sets: req.evidence_sets.map(set => {
        if (!requiredString(set.id) || setIds.has(set.id) || !kinds.includes(set.support) || !requiredString(set.rationale)
          || !set.all?.length) fail('invalid_rubric_set');
        setIds.add(set.id);
        return { ...set, review_state: 'proposed', proposed_by: spec.proposed_by, reviewed_by: null,
          all: set.all.map(atom => resolveAtom(atom, spec.sources, snapshot)) };
      }) };
    });
    return [familyId, { ...family, review_state: 'proposed', reviewed_by: null, requirements }];
  }));
  return { schema_version: 'rag-v2/semantic-rubric-2', version: spec.version, retrospective: true,
    proposed_by: spec.proposed_by, bindings, sources: spec.sources, families };
}

export function verifyRubric(rubric, snapshot, bindings) {
  if (rubric.schema_version !== 'rag-v2/semantic-rubric-2' || digest(rubric.bindings) !== digest(bindings)) fail('rubric_binding_mismatch');
  for (const family of Object.values(rubric.families)) {
    if (!family.requirements.length || !family.requirements.some(r => r.mandatory)) fail('rubric_requirements_missing');
    if (new Set(family.requirements.map(r => r.id)).size !== family.requirements.length) fail('duplicate_requirement');
    for (const req of family.requirements) {
      if (typeof req.mandatory !== 'boolean' || !requiredString(req.meaning) || !requiredString(req.scope)) fail('invalid_rubric_requirement');
      if (new Set(req.evidence_sets.map(s => s.id)).size !== req.evidence_sets.length) fail('duplicate_evidence_set');
      for (const set of req.evidence_sets) {
        if (!kinds.includes(set.support) || !set.all.length || !requiredString(set.rationale)) fail('invalid_rubric_set');
        for (const atom of set.all) {
          const b = snapshot.bundles.find(b => b.document.id === atom.document_id && b.version.id === atom.version_id && b.version.pdf_hash === atom.pdf_sha256);
          if (!b) fail('rubric_source_mismatch');
          if (atom.kind === 'metadata') {
            if (atom.field !== 'authors' || digest(atom.value) !== digest(b.document.fields.authors.value)
              || digest(atom.provenance) !== digest(b.document.fields.authors.provenance)) fail('rubric_metadata_mismatch');
          } else {
            if (atom.kind !== 'spans' || !atom.spans.length || atom.text !== atom.spans.map(s => s.source_text).join('\n')) fail('invalid_rubric_atom');
            for (const span of atom.spans) {
              const canonical = b.spans.find(s => s.id === span.id);
              if (!canonical || canonical.pdf_page !== atom.pdf_page || canonical.source_text !== span.source_text
                || canonical.start !== span.start || canonical.end !== span.end) fail('rubric_span_mismatch');
            }
          }
        }
      }
    }
  }
}

export function hasAtom(entries, atom) {
  const scoped = entries.filter(e => e.document_id === atom.document_id && e.document_version_id === atom.version_id);
  if (atom.kind === 'metadata') return scoped.some(e => digest(e.bibliography?.[atom.field]) === digest(atom.value));
  return atom.spans.every(s => scoped.some(e => e.pdf_pages.includes(atom.pdf_page) && e.span_ids.includes(s.id) && e.source_text.includes(s.source_text)));
}

export function canonicalContext(entries, snapshot) {
  const values = entries.map(e => {
    const bundle = snapshot.bundles.find(b => b.version.id === e.document_version_id && b.document.id === e.document_id);
    if (!bundle) fail('context_source_missing');
    return { document_id: e.document_id, version_id: e.document_version_id, pdf_sha256: bundle.version.pdf_hash,
      chunk_id: e.chunk_id, pdf_pages: e.pdf_pages, span_ids: e.span_ids, text: e.source_text,
      bibliography: e.bibliography, source_metadata: e.source_metadata, limitations: e.limitations };
  });
  // Reviewer sees canonical source order, never the retrieval rank. Machine results retain original order.
  return [...new Map(values.map(v => [digest(v), v])).values()].sort((a, b) => stable(a).localeCompare(stable(b)));
}
export function contextId(family, context) { return `context_${digest([family, context])}`; }
export const definitionKey = family => `definition:${family}`;
export const mappingKey = (family, req, set) => `mapping:${family}:${req}:${set}`;

function receipt(value) {
  if (!value || value.state === 'pending') return false;
  if (!['approved', 'rejected'].includes(value.state) || !humanRoles.includes(value.reviewed_by?.role)
    || !requiredString(value.reviewed_by?.name) || !requiredString(value.basis) || !requiredString(value.reason)
    || !Number.isFinite(Date.parse(value.reviewed_at))) fail('invalid_human_review_receipt');
  return value.state === 'approved';
}
export function decisionTargets(rubric) {
  const targets = {};
  for (const [familyId, family] of Object.entries(rubric.families)) {
    targets[definitionKey(familyId)] = { type: 'definition', content_sha256: digest(family) };
    targets[`corpus:${familyId}`] = { type: 'corpus', family: familyId,
      content_sha256: digest([rubric.bindings.corpus_snapshot_sha256, family]) };
    for (const req of family.requirements) for (const set of req.evidence_sets) {
      targets[mappingKey(familyId, req.id, set.id)] = { type: 'mapping', content_sha256: digest(set) };
    }
  }
  return targets;
}

export function makeReviewPacket(results, questions, snapshot, rubric) {
  const contexts = new Map(), targets = decisionTargets(rubric);
  for (const row of results.rows) {
    const context = canonicalContext(row.packet.evidence, snapshot), key = contextId(row.family, context);
    if (!rubric.families[row.family]) fail('rubric_family_missing');
    if (!contexts.has(key)) {
      const item = { id: key, family: row.family,
        questions: questions.cases.filter(q => q.family === row.family).map(q => ({ language: q.language, text: q.query })), context };
      contexts.set(key, item); targets[key] = { type: 'context', content_sha256: digest(item), family: row.family };
    }
  }
  const decisions = Object.fromEntries(Object.entries(targets).map(([key, target]) => [key, { ...target,
    state: 'pending', reviewed_by: null, reviewed_at: null, reason: '', basis: '',
    ...(target.type === 'corpus' ? { availability: Object.fromEntries(rubric.families[target.family].requirements.map(r => [r.id, 'needs_review'])) } : {}),
    ...(target.type === 'context' ? { exhaustive: false, contradiction: 'needs_review', no_other_support_for: [] } : {}) }]));
  const bindings = { rubric_sha256: digest(rubric), ...rubric.bindings };
  return { packet: { schema_version: 'rag-v2/blind-review-2', retrospective: true, bindings,
    notice: 'Varasemaid tulemusi on nähtud. Siin on meetod, järjekoht ja skoor peidetud; see ei ole uus puutumatu kontroll.',
    rubric, contexts: [...contexts.values()].sort((a, b) => a.id.localeCompare(b.id)) },
  decisions: { schema_version: 'rag-v2/review-decisions-2', bindings, decisions }, targets };
}

export function validateDecisions(review, rubric, targets) {
  if (review.schema_version !== 'rag-v2/review-decisions-2'
    || digest(review.bindings) !== digest({ rubric_sha256: digest(rubric), ...rubric.bindings })) fail('review_binding_mismatch');
  if (Object.keys(review.decisions).length !== Object.keys(targets).length) fail('review_targets_mismatch');
  for (const [key, decision] of Object.entries(review.decisions)) {
    const target = targets[key];
    if (!target || target.content_sha256 !== decision.content_sha256 || target.type !== decision.type) fail('review_content_mismatch');
    receipt(decision);
    if (target.type === 'corpus' && decision.state === 'approved') {
      const reqs = rubric.families[target.family].requirements;
      if (!decision.availability || Object.keys(decision.availability).length !== reqs.length
        || reqs.some(req => !states.includes(decision.availability[req.id]))) fail('invalid_corpus_review');
      for (const req of reqs) {
        const accepted = req.evidence_sets.filter(s => receipt(review.decisions[mappingKey(target.family, req.id, s.id)]));
        if (decision.availability[req.id] === 'full' && !accepted.some(s => s.support === 'full')) fail('unsupported_corpus_full');
        if (decision.availability[req.id] === 'absent' && accepted.some(s => ['full', 'partial'].includes(s.support))) fail('conflicting_corpus_review');
      }
    }
    if (target.type === 'context' && decision.state === 'approved') {
      const ids = rubric.families[target.family].requirements.map(r => r.id);
      if (decision.exhaustive !== true || !['none', 'present', 'needs_review'].includes(decision.contradiction)
        || !Array.isArray(decision.no_other_support_for) || decision.no_other_support_for.some(id => !ids.includes(id))) fail('invalid_context_review');
    }
  }
}

export function assessContext(familyId, entries, key, rubric, review) {
  const family = rubric.families[familyId], definitionApproved = receipt(review.decisions[definitionKey(familyId)]);
  const cr = review.decisions[key], contextReviewed = receipt(cr) && cr.exhaustive === true;
  const contradiction = contextReviewed ? cr.contradiction : 'needs_review';
  const requirements = family.requirements.map(req => {
    const sets = req.evidence_sets.map(set => {
      const decision = review.decisions[mappingKey(familyId, req.id, set.id)];
      return { id: set.id, support: set.support, present: set.all.every(atom => hasAtom(entries, atom)),
        approved: receipt(decision), pending: !decision || decision.state === 'pending' };
    });
    const confirmed = sets.filter(s => s.approved && s.present);
    const proposed = sets.filter(s => s.pending && s.present);
    const best = list => list.some(s => s.support === 'full') ? 'full' : list.some(s => s.support === 'partial') ? 'partial'
      : list.some(s => s.support === 'background') ? 'background_only' : 'no_mapped_support';
    const contradictionPresent = confirmed.some(s => s.support === 'contradiction');
    const level = best(confirmed);
    const exhaustiveMissing = contextReviewed && cr.no_other_support_for.includes(req.id);
    const unresolved = !definitionApproved || !contextReviewed || contradiction === 'needs_review'
      || proposed.length > 0 || (level !== 'full' && !exhaustiveMissing);
    return { id: req.id, meaning: req.meaning, mandatory: req.mandatory, sets,
      confirmed_support: level, proposed_support: best(proposed), contradiction: contradictionPresent,
      status: unresolved ? 'needs_review' : level === 'full' || level === 'partial' ? level : 'absent' };
  });
  const mandatory = requirements.filter(r => r.mandatory), hasConflict = contradiction === 'present' || requirements.some(r => r.contradiction);
  const status = mandatory.some(r => r.status === 'needs_review') || hasConflict ? 'needs_review'
    : mandatory.every(r => r.status === 'full') ? 'full'
      : mandatory.some(r => ['full', 'partial'].includes(r.status)) ? 'partial' : 'absent';
  return { status, contradiction: hasConflict ? 'present' : contradiction, requirements, definition_approved: definitionApproved,
    context_reviewed: contextReviewed };
}

export function regrade(results, questions, snapshot, rubric, review) {
  const { targets } = makeReviewPacket(results, questions, snapshot, rubric);
  validateDecisions(review, rubric, targets);
  const rows = results.rows.map(row => {
    const key = contextId(row.family, canonicalContext(row.packet.evidence, snapshot));
    const v2 = assessContext(row.family, row.packet.evidence, key, rubric, review);
    const family = rubric.families[row.family];
    const corpus = family.requirements.map(req => {
      const choices = req.evidence_sets.filter(set => receipt(review.decisions[mappingKey(row.family, req.id, set.id)]));
      const corpusReview = review.decisions[`corpus:${row.family}`];
      return { id: req.id, mandatory: req.mandatory,
        support: v2.definition_approved && receipt(corpusReview) ? corpusReview.availability[req.id] : 'needs_review',
        confirmed_mappings: choices.map(s => ({ id: s.id, support: s.support })),
      proposal: req.corpus_note };
    });
    let difference = 'unchanged';
    if (v2.status === 'needs_review') difference = 'unresolved_review';
    else if (v2.status === 'full' && row.all_required_in_final_context !== true) difference = 'approved_alternative_support';
    else if (row.all_required_in_final_context === true && v2.status !== 'full') difference = 'v1_coverage_not_whole_question';
    else if (v2.status === 'partial' && row.observed_support === 'absent') difference = 'partial_previously_labelled_absent';
    return { question_id: row.question_id, method: row.method, family: row.family, split: row.split, language: row.language,
      review_context_id: key, v1: structuredClone(row), v1_sha256: digest(row),
      preserved_context_sha256: digest(row.packet.model_context), preserved_tokens: row.measurements.model_context_tokens,
      v2: { ...v2, corpus_requirements: corpus }, difference };
  });
  const counts = Object.fromEntries(states.map(state => [state, rows.filter(r => r.v2.status === state).length]));
  return { schema_version: 'rag-v2/retrospective-regrade-2', retrospective: true,
    notice: 'Otsingut ei muudetud; erinevus tuleneb hindamisrubriigi või kinnitatud vastenduste muutusest.',
    bindings: { rubric_sha256: digest(rubric), decisions_sha256: digest(review), ...rubric.bindings },
    summary: { rows: rows.length, ...counts, quality_percentage: null,
      unresolved_in_denominator: counts.needs_review, final: counts.needs_review === 0 }, rows };
}
