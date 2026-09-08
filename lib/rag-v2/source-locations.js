import { fail, id, stable } from './contracts.js';

export const SOURCE_FORMATS = Object.freeze({
  pdf: { mime: 'application/pdf', asset: 'original.pdf' },
  html: { mime: 'text/html', asset: 'original.html' },
  xml: { mime: 'application/xml', asset: 'original.xml' },
  json: { mime: 'application/json', asset: 'original.json' },
});

export function sourceFormat(metadata) {
  const extension = metadata.source_path?.split('.').at(-1)?.toLowerCase();
  const format = metadata.source_format ?? (extension === 'akt' ? 'xml' : extension);
  if (!Object.hasOwn(SOURCE_FORMATS, format)) fail('unsupported_source_format');
  return format;
}

export const sourceHash = bundle => bundle.version.source_hash ?? bundle.version.pdf_hash;
export const sourceAsset = bundle => SOURCE_FORMATS[bundle.version.source_format ?? 'pdf'].asset;
export const unitForSpan = (bundle, span) => bundle.source_units === undefined ? bundle.pages[span.parser_page_index] : bundle.source_units[span.source_unit_index];

export function sourceUnit(rawText, locator, index, versionId) {
  return { id: id('source_unit', versionId, index), index, raw_text: rawText, locator,
    offset_basis: 'source_unit_text_utf16' };
}

export function chunkSourceLocations(bundle, chunk, spans = new Map(bundle.spans.map(span => [span.id, span]))) {
  if (!bundle.source_units) return undefined;
  const ranges = [];
  for (const spanId of chunk.span_ids) {
    const span = spans.get(spanId), unit = unitForSpan(bundle, span);
    const range = ranges.at(-1);
    if (range?.source_unit_id === unit.id && span.start >= range.end && !unit.raw_text.slice(range.end, span.start).trim()) range.end = span.end;
    else ranges.push({ source_unit_id: unit.id, ...unit.locator, start: span.start, end: span.end,
      offset_basis: 'source_unit_text_utf16' });
  }
  return ranges;
}

export const locationFields = chunk => chunk.source_locations === undefined ? {} : { source_locations: chunk.source_locations };

export function validateSourceLocations(bundle) {
  if (!bundle.source_units) return;
  for (const span of bundle.spans) if (!Number.isSafeInteger(span.source_unit_index) || span.source_unit_index < 0
    || span.source_unit_index >= bundle.source_units.length
    || bundle.version.source_format === 'pdf' && span.source_unit_index !== span.parser_page_index) fail('invalid_source_unit_reference');
  const format = bundle.version.source_format;
  if (!SOURCE_FORMATS[format] || !/^[a-f0-9]{64}$/.test(bundle.version.source_hash)) fail('invalid_source_identity');
  if (format === 'pdf' ? bundle.version.pdf_hash !== bundle.version.source_hash : bundle.pages.length !== 0 || bundle.version.pdf_hash !== null) fail('invalid_source_pages');
  for (const [index, unit] of bundle.source_units.entries()) {
    if (unit.index !== index || unit.id !== id('source_unit', bundle.version.id, index)
      || unit.offset_basis !== 'source_unit_text_utf16' || typeof unit.raw_text !== 'string' || !unit.raw_text.isWellFormed()
      || unit.locator?.kind !== format) fail('invalid_source_unit');
    if (format === 'pdf' && (unit.locator.pdf_page !== index + 1 || bundle.pages[index]?.raw_text !== unit.raw_text)) fail('invalid_source_pages');
    if (format !== 'pdf' && typeof unit.locator.path !== 'string') fail('invalid_source_locator');
  }
  const spans = new Map(bundle.spans.map(span => [span.id, span]));
  for (const chunk of bundle.chunks) {
    if (stable(chunk.source_locations) !== stable(chunkSourceLocations(bundle, chunk, spans))) fail('source_location_mismatch');
  }
}

/** Split only at a source boundary; ranges always refer to the original UTF-16 text. */
export function textRanges(text, maxChars) {
  const ranges = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + maxChars);
    if (end < text.length) {
      const prefix = text.slice(start, end);
      const sentence = [...prefix.matchAll(/[.!?;](?:[”"')\]]*)\s+/gu)].at(-1);
      const boundary = sentence && sentence.index > maxChars * 0.4 ? sentence.index + sentence[0].length : prefix.lastIndexOf(' ');
      if (boundary > maxChars * 0.25) end = start + boundary;
      if (/[\uD800-\uDBFF]/u.test(text[end - 1]) && /[\uDC00-\uDFFF]/u.test(text[end])) end--;
    }
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}
