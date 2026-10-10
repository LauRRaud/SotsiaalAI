import { fail, stable } from '../contracts.js';
import { indexUnit, tokenCount } from './embedding.js';
import { auditPacketBytes, modelProjection, stripLegalDates, AUDIT_PACKET_BYTES } from './model-context.js';
import { sourceEntry } from './retrieval.js';

// A stored turn's model context, projected again from the bundles the index holds now (ADR-062). A corpus that only
// gained data beside its text, and a projection that only added the legal dates, must give the stored context back
// with nothing but those dates added: the same sources, excerpts, refs and reports. No search, no model call, no write.
const recordEvidence = entry => entry.selection?.reason === 'structured_record';
const place = locations => stable((locations || []).map(({ path, start, end }) => [path, start, end]));

/** A model context without the legal dates and its schema label: what the earlier serializer gave for the same evidence. */
export function withoutLegalDates(context) {
  if (!context) return context;
  const { schema_version: _label, ...rest } = stripLegalDates(context);
  return rest;
}

/** `bundles` maps a document to its bundle now; `embedding` is the generation's embedding config (the unit IDs read
 *  its input version). An entry is rebuilt from the same chunk of a stored version, or from the chunk with the same text
 *  at the same place of a version ingested again. A structured record's excerpt, and a source the index no longer
 *  holds, stay as stored. packet_bytes gives the audit packet's size as stored, as it would be stored now, and as the
 *  size limit counts it. */
export function replayContext(packet, bundles, embedding) {
  if (!packet || !Array.isArray(packet.evidence) || !(bundles instanceof Map)) fail('invalid_replay_input');
  const rebuilt = [];
  const evidence = packet.evidence.map((entry, index) => {
    const bundle = bundles.get(entry.document_id);
    if (recordEvidence(entry) || !bundle) { rebuilt.push(recordEvidence(entry) ? 'record_as_stored' : 'source_not_in_index'); return entry; }
    const same = bundle.version.id === entry.document_version_id;
    const chunk = bundle.chunks.find(item => (same ? item.id === entry.chunk_id
      : item.source_text === entry.source_text && place(item.source_locations) === place(entry.source_locations)));
    if (!chunk || chunk.source_text !== entry.source_text) throw Object.assign(new Error('replay_chunk_not_found'), { code: 'replay_chunk_not_found', ref: `S${index + 1}` });
    rebuilt.push(same ? 'same_version' : 'version_ingested_again');
    return { ...sourceEntry(indexUnit(chunk, bundle, embedding), bundle, entry.selection?.reason, null), ...(entry.selection ? { selection: entry.selection } : {}) };
  });
  const projection = modelProjection(evidence, packet), next = withoutLegalDates(projection.context), stored = withoutLegalDates(packet.model_context);
  const differences = [];
  for (const key of new Set([...Object.keys(next || {}), ...Object.keys(stored || {})])) {
    if (key === 'sources') { for (const source of new Set([...Object.keys(next?.sources || {}), ...Object.keys(stored?.sources || {})])) if (stable(next?.sources?.[source]) !== stable(stored?.sources?.[source])) differences.push(`sources.${source}`); }
    else if (key === 'evidence') { for (let at = 0; at < Math.max(next?.evidence?.length || 0, stored?.evidence?.length || 0); at++) if (stable(next?.evidence?.[at]) !== stable(stored?.evidence?.[at])) differences.push(`evidence.S${at + 1}`); }
    else if (stable(next?.[key]) !== stable(stored?.[key])) differences.push(key);
  }
  const context = projection.context, bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
  // The audit packet as the turn would store it now, against the pilot service's size limit (which reads it without the dates).
  const packetNow = { ...packet, evidence, model_context: context, reference_map: projection.references };
  // packet: the packet as the turn would hold it now (ADR-129: the provision check reads a stored answer against it).
  return { equal_without_legal_dates: stable(next) === stable(stored), differences, context, packet: packetNow,
    packet_bytes: { stored: bytes(packet), now: bytes(packetNow), counted: auditPacketBytes(packetNow), limit: AUDIT_PACKET_BYTES },
    tokens: { stored_context: tokenCount(packet.model_context ? JSON.stringify(packet.model_context) : ''), context: projection.measurements.model_context_tokens,
      without_legal_dates: projection.measurements.budget_context_tokens, legal_dates: projection.measurements.legal_dates ?? null,
      // ADR-123 and ADR-129: the provision labels against their cap, and the laws' abbreviations.
      ...(projection.measurements.legal_place ? { legal_place: projection.measurements.legal_place } : {}), ...(projection.measurements.act_abbreviations ? { act_abbreviations: projection.measurements.act_abbreviations } : {}) },
    sources: Object.fromEntries(Object.entries(context?.sources || {}).filter(([, card]) => card.act_dates || card.act_dates_omitted)
      .map(([key, card]) => [key, { title: card.title, valid_from: card.valid_from ?? null, ...(card.act_dates ? { act_dates: card.act_dates } : { act_dates_omitted: true }) }])),
    evidence: (context?.evidence || []).map((excerpt, at) => ({ ref: excerpt.ref, source: excerpt.source, read: rebuilt[at],
      // Which provisions of the act the evidence holds: the source paths of the excerpt (a section each in an XML act).
      places: (packet.evidence[at].source_locations || []).map(location => location.path),
      ...(excerpt.amendments ? { amendments: excerpt.amendments } : {}), ...(excerpt.amendments_omitted ? { amendments_omitted: true } : {}) })) };
}
