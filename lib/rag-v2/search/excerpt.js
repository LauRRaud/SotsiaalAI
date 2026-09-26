import { fail } from '../contracts.js';
import { chunkSourceLocations } from '../source-locations.js';

/** An ordered subset of one chunk's spans with its text and locations, built like the chunk's own.
 * A record catalogue cites such an excerpt; canonical checks rebuild it with this same function. */
export function chunkExcerpt(bundle, chunk, spanIds, spans = new Map(bundle.spans.map(span => [span.id, span]))) {
  if (!Array.isArray(spanIds) || !spanIds.length || new Set(spanIds).size !== spanIds.length) fail('invalid_chunk_excerpt');
  let at = 0;
  for (const spanId of spanIds) {
    at = chunk.span_ids.indexOf(spanId, at);
    if (at < 0 || !spans.has(spanId)) fail('invalid_chunk_excerpt');
    at++;
  }
  return { span_ids: [...spanIds], source_text: spanIds.map(spanId => spans.get(spanId).source_text).join('\n'),
    ...(bundle.source_units === undefined ? {} : { source_locations: chunkSourceLocations(bundle, { span_ids: spanIds }, spans) }) };
}
