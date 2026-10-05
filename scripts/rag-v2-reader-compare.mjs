#!/usr/bin/env node
// ADR-062: what the current reader makes of every indexed Riigi Teataja act, against the version stored for it.
// A reader change that only adds data beside the text must leave the text alone. For each act of the manifest the
// stored original.xml is read again with the stored version's ID, and its source units (without the new amendments),
// spans, chunks (source text, retrieval text, source locations, embedding input hash) and the document fields read from
// the XML (title, issuer, reference, validity with its open end, publication day, act type: the source card and the
// validity filters) are compared with the stored bundle's. An embedding input the stored version already has is not
// bought again. The amendment notes the reader keeps are counted, with the acts that have a note without a place or
// without its day, or their own day before the publication their adoption names.
// The re-ingest reads the registry, not the store: the registry must name the act's file once, with the stored bytes.
// Its metadata for that entry (registeredSource) is what the ingest plan freezes: the title, issuer and municipality
// that head each chunk's retrieval text, the regions, and the hash in the version ID. That hash must be the stored
// version's (reason `metadata`), so the new version's ID differs from the stored one by the reader's label alone.
//   node scripts/rag-v2-reader-compare.mjs --store tmp/rag-v2-corpus-store-v25 [--manifest docs/rag-v2/legal-acts-in-index.json] [--registry Andmebaasi]
// Reads the store and the registry and writes nothing; model calls 0, embedding calls 0. Prints JSON; exit 1 when an
// act's text, units, chunks, fields or metadata differ, an embedding input is new or a registry file is not the stored one.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG, hash, id, stable } from '../lib/rag-v2/contracts.js';
import { loadVersion, readJson } from '../lib/rag-v2/catalog.js';
import { makeChunks } from '../lib/rag-v2/chunking.js';
import { metadataValue } from '../lib/rag-v2/metadata-values.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';

try {
  const { values } = parseArgs({ options: { store: { type: 'string' }, manifest: { type: 'string', default: 'docs/rag-v2/legal-acts-in-index.json' },
    registry: { type: 'string', default: 'Andmebaasi' } } });
  if (!values.store) throw Object.assign(new Error('usage'), { code: 'reader_compare_usage' });
  const manifest = await readJson(values.manifest), dir = path.resolve(values.store, id('tenant', manifest.tenant));
  const config = { ...DEFAULT_CONFIG }, stored = {}, different = [], unresolved = [], early = [], actEarly = [];
  // The registry's own entries, selected by path as the ingest plan selects them (rag-v2-ingest-batch.mjs, mode plan).
  const listed = await readJson(path.join(values.registry, 'REGISTER.json')).then(registry => (Array.isArray(registry?.entries) ? registry.entries : []), () => []);
  const count = { acts: manifest.acts.length, identical_acts: 0, stored_chunks: 0, embedding_inputs_already_stored: 0, embedding_inputs_new: 0,
    registry_xml_differs_from_stored: 0 };
  const notes = { unit_notes: 0, with_applies_from: 0, with_own_words: 0, repeals: 0, position_unresolved: 0, structure_notes: 0, history_entries: 0,
    acts_with_version_change: 0, acts_with_entry_into_force: 0, acts_with_adoption_note: 0, acts_without_act_in_force_from: 0 };
  for (const act of manifest.acts) {
    const bundle = await loadVersion(dir, act.version_id), xml = await fs.readFile(path.join(dir, 'versions', act.version_id, 'original.xml'));
    const entries = listed.filter(entry => entry?.path === act.source_path), entry = entries.length === 1 && entries[0].role === 'source' ? entries[0] : null;
    const same = entry?.sha256 === hash(xml) && await fs.readFile(path.join(values.registry, act.source_path)).then(bytes => hash(bytes) === hash(xml), () => false);
    if (!same) count.registry_xml_differs_from_stored++;
    const label = bundle.version.processing_config.normalization;
    stored[label] = (stored[label] || 0) + 1;
    // The stored version's ID keeps every derived ID comparable. The metadata is the registry's when its file is the stored
    // one; otherwise the stored bundle's, and the run fails on the file.
    const scope = { tenant_id: bundle.tenant_id, document_version_id: bundle.version.id }, fields = bundle.document.fields;
    // The registry may name the sections of the act that are this source, how they are cut and their search aids
    // (ADR-076, ADR-082, ADR-087): the act is read with that selection, as the ingest reads it. Read whole, the State
    // Budget Act (4 MB, registered as its § 2) passes the text limit.
    const registered = same ? await registeredSource(values.registry, entry) : null;
    const { parsed, structured } = parseTextSource(xml, 'xml', registered?.source_selector ? { source_selector: registered.source_selector } : {}, scope, config);
    const metadata = registered
      ?? { title: parsed.source_metadata.title ?? fields.title.value, authority: parsed.source_metadata.authority ?? fields.authority?.value, municipality_name: fields.municipality_name?.value };
    const chunks = makeChunks({ ...structured, metadata: { title: metadata.title, retrieval_context: metadata.municipality_name || metadata.authority || null },
      versionId: bundle.version.id, scope, config });
    const text = list => stable(list.map(chunk => [chunk.source_text, chunk.retrieval_text, chunk.source_locations, chunk.embedding_input_hash, chunk.span_ids]));
    const units = structured.source_units.map(({ amendments: _amendments, ...unit }) => unit);
    // The fields the act's XML gives, as normalize sets them: the value, where it was read, and the source's own form of a zoned date.
    // A validity with a start and no end is an open end (what the validity filter reads as in force), proven by the start's element.
    const open = parsed.source_metadata.valid_from && !parsed.source_metadata.valid_to ? [['valid_to.open_end', true, parsed.metadata_paths.valid_from, null]] : [];
    const read = [...Object.entries(parsed.source_metadata).map(([key, raw]) => [key, metadataValue(key, raw), parsed.metadata_paths[key], metadataValue(key, raw) === raw ? null : raw]), ...open];
    const kept = [...Object.entries(fields).filter(([key, field]) => key !== 'legal_text' && field.provenance[0]?.kind === parsed.metadata_basis)
      .map(([key, field]) => [key, field.value, field.provenance[0].path, field.provenance[0].raw ?? null]),
    ...(fields.valid_to?.open_end === undefined ? [] : [['valid_to.open_end', fields.valid_to.open_end,
      fields.valid_to.provenance.find(source => source.kind === parsed.metadata_basis && source.basis === 'validity_without_end')?.path ?? null, null]])];
    const sorted = list => stable(list.sort(([a], [b]) => a.localeCompare(b)));
    const reasons = [...(stable(units) === stable(bundle.source_units.map(({ amendments: _amendments, ...unit }) => unit)) ? [] : ['source_units']),
      ...(stable(structured.spans) === stable(bundle.spans) ? [] : ['spans']), ...(text(chunks) === text(bundle.chunks) ? [] : ['chunks']),
      ...(sorted(read) === sorted(kept) ? [] : ['fields']),
      // The plan's metadata_json is this metadata in canonical form, and its hash is part of the version ID.
      ...(!same || hash(stable(metadata)) === bundle.version.metadata_hash ? [] : ['metadata'])];
    const known = new Set(bundle.chunks.map(chunk => chunk.embedding_input_hash)), reused = chunks.filter(chunk => known.has(chunk.embedding_input_hash)).length;
    count.stored_chunks += bundle.chunks.length; count.embedding_inputs_already_stored += reused; count.embedding_inputs_new += chunks.length - reused;
    if (reasons.length) different.push({ act: act.globaal_id, stored: label, reasons, chunks: `${bundle.chunks.length}->${chunks.length}` }); else count.identical_acts++;
    const unitNotes = structured.source_units.flatMap(unit => unit.amendments || []), legal = parsed.legal_text, lost = unitNotes.filter(note => note.offset === null).length;
    notes.unit_notes += unitNotes.length; notes.with_applies_from += unitNotes.filter(note => note.applies_from).length;
    notes.with_own_words += unitNotes.filter(note => note.note).length; notes.repeals += unitNotes.filter(note => note.repeal).length;
    notes.position_unresolved += lost; if (lost) unresolved.push(act.globaal_id);
    if (structured.warnings.some(warning => warning.code === 'amendment_note_in_force_before_publication')) early.push(act.globaal_id);
    if (structured.warnings.some(warning => warning.code === 'act_in_force_before_publication')) actEarly.push(act.globaal_id);
    notes.structure_notes += legal.structure.length; notes.history_entries += legal.history.length;
    notes.acts_with_version_change += legal.version_change ? 1 : 0; notes.acts_with_entry_into_force += legal.entry_into_force.length ? 1 : 0;
    notes.acts_with_adoption_note += legal.adoption_note ? 1 : 0; notes.acts_without_act_in_force_from += legal.act_in_force_from ? 0 : 1;
  }
  console.log(JSON.stringify({ reader: config.normalization, stored_normalizations: stored, ...count, different, notes, position_unresolved_acts: unresolved,
    in_force_before_publication_acts: early, act_in_force_before_publication_acts: actEarly }, null, 1));
  if (different.length || count.embedding_inputs_new || count.registry_xml_differs_from_stored) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/u.test(error.code) ? error.code : 'reader_compare_failed' }));
  process.exitCode = 1;
}
