// A synthetic audit packet with the shape and the size of a large municipality's chat turn. The model is the largest
// packet stored on 06.10.2026 (Tallinn: 98 records and 6 knowledge passages, 543 578 bytes, of which the evidence
// entries 279 670, the reference map 172 614, the model context 51 010 and the record context 33 261): the same keys,
// about the same number of spans and source places per entry (most records have two of each, some five), ids of the
// same length. Every id, name and text is made up;
// no real contact, service or source is in it. The model context and the reference map are made by the real projection.
import { createHash } from 'node:crypto';
import { modelProjection } from '../../lib/rag-v2/search/model-context.js';

const id = (kind, seed) => `${kind}_${createHash('sha256').update(`${kind}/${seed}`).digest('hex')}`;
const provenance = field => [{ path: `/document/fields/${field}`, source: 'synthetic_package_manifest', sha256: createHash('sha256').update(field).digest('hex') }];
const KINDS = ['service', 'service', 'service', 'contact_directory', 'contact', 'service', 'form', 'service'];

function recordEntry(index, tenant) {
  const kind = KINDS[index % KINDS.length], document = id('document', `${tenant}/package/${kind}`), record = `record_${createHash('sha256').update(`${tenant}/${index}`).digest('hex').slice(0, 49)}`;
  const unit = id('unit', `${tenant}/record/${index}`), fields = index % 8 === 0 ? ['name', 'description', 'eligibility', 'application', 'contact'] : ['name', 'description'];
  return { unit_id: unit, chunk_id: id('chunk', `${tenant}/record/${index}`), span_ids: fields.map((_, at) => id('span', `${tenant}/record/${index}/${at}`)), pdf_pages: [],
    selection: { ranks: {}, reason: 'structured_record', rrf_score: null, rrf_contributions: {} }, document_id: document, evidence_id: id('evidence', `${tenant}/record/${index}`), limitations: [],
    search_aids: { role: 'not_source_quote', heading_prefix: `Näidislinn · ${kind} · kirje ${index + 1}`,
      legacy_description: { role: 'search_aid_only', value: `Otsinguabi kirjele ${index + 1}: kellele see on mõeldud, kuidas taotleda ja kuhu pöörduda.`, provenance: provenance('description'), review_state: 'not_verified' } },
    source_text: `Näidisteenus ${index + 1}. Teenust osutatakse inimesele, kes vajab igapäevases toimetulekus kõrvalabi. Taotlus esitatakse linnaosa valitsusele; otsus tehakse kümne tööpäeva jooksul.`,
    bibliography: { title: `Näidisteenus ${index + 1}`, authors: null, publication_date: null },
    source_metadata: { source_type: { value: kind === 'contact' ? 'municipal_contact' : 'municipal_service' }, source_checked_at: { value: `2026-10-05T11:29:${String(index % 60).padStart(2, '0')}.539Z` } },
    source_locations: fields.map((field, at) => ({ end: 40 * (at + 1), kind: 'json', path: `/items/${index}/${field}`, start: 40 * at, record_id: record,
      source_keys: [], offset_basis: 'source_unit_text_utf16', source_unit_id: id('source_unit', `${tenant}/record/${index}`) })),
    document_version_id: id('version', `${tenant}/package/${kind}`) };
}

function passageEntry(index, tenant) {
  const document = id('document', `${tenant}/report/${index % 3}`);
  const meta = (field, value) => ({ value, provenance: provenance(field), review_state: 'imported_not_verified' });
  return { unit_id: id('unit', `${tenant}/passage/${index}`), chunk_id: id('chunk', `${tenant}/passage/${index}`), span_ids: Array.from({ length: 33 }, (_, at) => id('span', `${tenant}/passage/${index}/${at}`)),
    pdf_pages: [index + 4, index + 5], selection: { ranks: { vector: index + 1, vector_2: index + 3 }, reason: 'ranked_seed', rrf_score: 0.03 - index / 1000, rrf_contributions: { vector: 0.016, vector_2: 0.014 } },
    document_id: document, evidence_id: id('evidence', `${tenant}/passage/${index}`),
    limitations: ['layout_columns_merged', 'glyph_repair_applied', 'title_checked_against_cover', 'description_not_verified', 'reference_list_outside_evidence', 'tables_as_text']
      .map(code => ({ code, detail: `Töötlusmärkus ${code}: allika kujundus ei mõjuta lõigu teksti, kuid tsiteerimisel tuleb lehekülg üle kontrollida.` })),
    search_aids: { role: 'not_source_quote', heading_prefix: `Näidisuuring ${index % 3 + 1} › Eakate toimetulek kodus › Kohaliku omavalitsuse teenused › ${index + 1}. alapeatükk`,
      legacy_description: { role: 'search_aid_only', value: 'Uuring kirjeldab, milliseid teenuseid kohalik omavalitsus eakale kodus osutab, kuidas abivajadust hinnatakse ja millal on põhjendatud ööpäevaringne hooldus. '.repeat(2).trim(), provenance: provenance('description'), review_state: 'not_verified' } },
    source_text: `Lõik ${index + 1}. ${'Eaka inimese toimetuleku toetamisel on esmane koduteenus, mida korraldab elukohajärgne omavalitsus abivajaduse hindamise põhjal. '.repeat(12)}`.trim(),
    bibliography: { title: `Näidisuuring ${index % 3 + 1}: eakate toimetulek ja kohalikud teenused`, authors: ['A. Autor', 'B. Autor', 'C. Autor'], page_range: `${index + 4}–${index + 5}`, publication_date: null, publication_year: 2024 },
    source_metadata: { country: meta('country', 'EE'), language: meta('language', 'et'), valid_to: meta('valid_to', null), authority: meta('authority', 'Näidisministeerium'), historical: meta('historical', false),
      valid_from: meta('valid_from', null), source_type: meta('source_type', 'research_report'), source_status: meta('source_status', 'active'), source_checked_at: meta('source_checked_at', '2026-06-11'),
      jurisdiction_level: meta('jurisdiction_level', 'NATIONAL') },
    source_locations: [0, 1].map(at => ({ end: 900 * (at + 1), kind: 'pdf', start: 900 * at, pdf_page: index + 4 + at, offset_basis: 'source_unit_text_utf16', source_unit_id: id('source_unit', `${tenant}/passage/${index}/${at}`) })),
    document_version_id: id('version', `${tenant}/report/${index % 3}`) };
}

/** `records` municipal records after `passages` knowledge passages; the defaults are Tallinn's counts of 06.10.2026. */
export function municipalPacket({ records = 98, passages = 6, tenant = 'm4-test', queryId = id('query', 'municipal-packet') } = {}) {
  const evidence = [...Array.from({ length: passages }, (_, index) => passageEntry(index, tenant)), ...Array.from({ length: records }, (_, index) => recordEntry(index, tenant))];
  const ref = index => `S${passages + index + 1}`;
  const record_context = { view: 'titles', scope: { state: 'person_mentioned_region', person: 'isa', region: 'naidislinn', interpretation: 'Küsitakse teise inimese elukoha kohta.' }, region: 'naidislinn',
    entries: Array.from({ length: records }, (_, index) => ({ key: `R${index + 1}`, kind: KINDS[index % KINDS.length] === 'contact_directory' ? 'contact' : KINDS[index % KINDS.length], detail: 'catalogue',
      fields: { name: { value: `Näidisteenus ${index + 1}`, refs: [ref(index)] }, role: { value: 'Näidisroll', refs: [ref(index)] }, unit: { value: 'Näidisosakond', refs: [ref(index)] },
        channel: { value: 'Taotlus linnaosa valitsuses', refs: [ref(index)] }, audience: { value: 'Eakas või puudega inimene', refs: [ref(index)] } },
      region: 'naidislinn', record_id: evidence[passages + index].source_locations[0].record_id })),
    version: 'rag-v2/record-catalogue-4', freshness: { contact: 'Kontaktid on kontrollitud 05.10.2026.', validity: 'Teenuste kirjeldused on kogutud omavalitsuse veebilehelt; kehtivust ei ole eraldi kinnitatud.', other_records: 'Muud kirjed: 05.10.2026.' },
    relations: Array.from({ length: Math.min(17, Math.floor(records / 5)) }, (_, at) => ({ to: `R${at * 5 + 3}`, from: `R${at * 5 + 1}`, refs: [ref(at * 5)], state: 'source_declared', relation: 'form' })),
    selection: 'question_relevance', completeness: 'complete_for_listed_records', listed_count: records, catalogue_count: records, catalogue_scope: 'municipality_and_its_districts', relevance_channels: ['vector'],
    relevant_summaries: 4, source_limitations: [{ code: 'collected_package_text', detail: 'Kirjete tekst on kogutud omavalitsuse veebilehelt ega ole omavalitsuse kinnitatud.' }], current_availability: 'not_established' };
  const scope = { tenant, query_id: queryId, generation_id: id('search_generation', tenant), record_context };
  const projection = modelProjection(evidence, scope, { measure: 'none' });
  return { tenant, query_id: queryId, generation_id: scope.generation_id, model_context: projection.context, reference_map: projection.references, evidence, record_context };
}
