import { hash, id, stable } from './contracts.js';
import { chunkSourceLocations } from './source-locations.js';

/** Whole blocks first; oversized blocks retain ordered, bounded source fragments. */
export function makeChunks({ spans, blocks, sections, source_units, metadata, versionId, scope, config }) {
  const spanMap = new Map(spans.map(span => [span.id, span])), sectionMap = new Map(sections.map(section => [section.id, section]));
  const chunks = [];
  let group = [], size = 0, recordKey = null;
  function flush() {
    if (!group.length) return;
    const section = sectionMap.get(group[0].parent_section_id);
    const sectionPath = [metadata.title, section.title].filter(Boolean);
    const sourceText = group.map(span => span.source_text).join('\n');
    const bodyText = group.map((span, i) => `${i ? (span.block_id === group[i - 1].block_id ? '\n' : '\n\n') : ''}${span.retrieval_text}`).join('');
    const prefix = `${sectionPath.join(' > ')}\n\n`, retrievalText = prefix + bodyText;
    const chunk = { ...scope, id: id('chunk', versionId, chunks.length), ordinal: chunks.length,
      record_key: recordKey, parent_section_id: section.id, section_path: sectionPath, span_ids: group.map(span => span.id),
      pdf_pages: [...new Set(group.map(span => span.pdf_page).filter(Number.isInteger))], source_text: sourceText, retrieval_text: retrievalText,
      retrieval_mapping: { prefix_length: prefix.length, body_span_ids: group.map(span => span.id), operation: 'join_normalized_lines_with_block_breaks' },
      embedding_input_hash: hash(stable([config.embeddingInputVersion, retrievalText])), index_version: config.embeddingInputVersion };
    chunk.source_locations = chunkSourceLocations({ spans, source_units }, chunk, spanMap);
    chunks.push(chunk); group = []; size = 0;
  }
  for (const block of blocks) {
    const members = block.span_ids.map(key => spanMap.get(key));
    if (!members.length) continue;
    const length = members.reduce((sum, span) => sum + span.source_text.length + 1, 0) - 1;
    if (group.length && (group[0].parent_section_id !== members[0].parent_section_id || recordKey !== (block.record_key ?? null)
      || size + length + 1 > config.chunkMaxChars)) flush();
    recordKey = block.record_key ?? null;
    for (const span of members) {
      if (group.length && (size + span.source_text.length + 1 > config.chunkMaxChars || group[0].parent_section_id !== span.parent_section_id)) flush();
      group.push(span); size += span.source_text.length + (group.length > 1 ? 1 : 0);
    }
  }
  flush();
  chunks.forEach((chunk, index) => {
    chunk.previous_id = chunks[index - 1]?.record_key === chunk.record_key ? chunks[index - 1].id : null;
    chunk.next_id = chunks[index + 1]?.record_key === chunk.record_key ? chunks[index + 1].id : null;
  });
  return chunks;
}
