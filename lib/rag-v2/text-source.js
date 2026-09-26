import { parseDocument } from 'htmlparser2';
import { fail, id } from './contracts.js';
import { sourceUnit, textRanges } from './source-locations.js';
import { structuredRecord } from './structured-record.js';
import { splitReferenceLists } from './chunking.js';

const localName = node => node.name?.split(':').at(-1) || '';
const children = node => node.children || [];
const elements = node => children(node).filter(child => ['tag', 'script', 'style'].includes(child.type));
const flat = node => [node, ...children(node).flatMap(flat)];
const clean = value => value.replaceAll('\u0000', '\uFFFD').replace(/[\t \r\n]+/gu, ' ').trim();
const TEXT_BLOCKS = new Set(['p', 'li', 'dt', 'dd', 'tr', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BREAKS = new Set([...TEXT_BLOCKS, 'br', 'loige', 'punkt', 'alampunkt', 'tavatekst', 'kuvatavNr', 'paragrahv', 'pealkiri', 'td', 'th']);

// Riigi Teataja titles are `pealkiri` or `*Pealkiri` (peatykkPealkiri, paragrahvPealkiri, ...).
const isTitle = node => /^(?:pealkiri|\w+Pealkiri)$/u.test(localName(node));
const isBreak = node => BREAKS.has(localName(node)) || isTitle(node);
function textContent(node, skip = () => false) {
  if (node.type === 'text') return node.data;
  if (skip(node) || node.attribs?.hidden !== undefined || node.attribs?.['aria-hidden'] === 'true') return '';
  if (['script', 'style', 'noscript', 'template', 'svg'].includes(localName(node))) return '';
  return children(node).map(child => `${isBreak(child) ? '\n' : ''}${textContent(child, skip)}${isBreak(child) ? '\n' : ''}`).join('');
}

function nodePath(node) {
  if (!node.name) return '';
  const siblings = elements(node.parent || {}).filter(sibling => sibling.name === node.name);
  return `${nodePath(node.parent || {})}/${node.name}[${siblings.indexOf(node) + 1}]`;
}

function markup(text, xml) {
  if (xml && /<!\s*(?:DOCTYPE|ENTITY)/iu.test(text)) fail('xml_external_entities_forbidden');
  const dom = parseDocument(text, { xmlMode: xml, withStartIndices: true, withEndIndices: true });
  let count = 0;
  function check(node, depth = 0) {
    if (++count > 100000 || depth > 128) fail('markup_structure_limit');
    if (xml && node.type === 'tag') {
      const segment = text.slice(node.startIndex, node.endIndex + 1);
      const opening = segment.match(/^<[^>]+>/u)?.[0];
      if (!opening || !opening.endsWith('/>') && segment.match(/<\/([^\s>]+)\s*>$/u)?.[1] !== node.name) fail('invalid_xml_structure');
    }
    children(node).forEach(child => check(child, depth + 1));
  }
  check(dom);
  if (xml && elements(dom).length !== 1) fail('invalid_xml_structure');
  return dom;
}

function htmlRecords(text) {
  const dom = markup(text, false), nodes = flat(dom), warnings = [];
  const candidates = nodes.filter(node => localName(node) === 'article');
  const roots = candidates.length ? candidates.filter(node => !candidates.some(parent => parent !== node && flat(parent).includes(node)))
    : nodes.filter(node => localName(node) === 'main');
  if (roots.length > 1) fail('html_content_region_ambiguous');
  const root = roots[0] || nodes.find(node => localName(node) === 'body') || dom;
  if (!roots.length) warnings.push({ code: 'html_content_region_fallback', detail: 'No article/main element; body text requires content-scope review.' });
  const records = [], headings = [];
  const excluded = node => ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'form'].includes(localName(node))
    || !roots.length && ['header', 'footer', 'aside'].includes(localName(node))
    || node.attribs?.hidden !== undefined || node.attribs?.['aria-hidden'] === 'true';
  function visit(node) {
    if (excluded(node)) return;
    const tag = localName(node), block = TEXT_BLOCKS.has(tag);
    const nested = elements(node).some(child => flat(child).some(descendant => TEXT_BLOCKS.has(localName(descendant))));
    if (block && (!nested || tag === 'tr')) {
      const value = textContent(node).replace(/\r/gu, '').replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim();
      if (!value) return;
      const heading = /^h[1-6]$/u.test(tag);
      if (heading) { headings.length = Number(tag[1]) - 1; headings.push(clean(value)); }
      records.push({ text: value, kind: heading ? 'heading' : tag === 'tr' ? 'table_row' : tag === 'li' ? 'list_item' : tag === 'blockquote' ? 'quote' : 'paragraph',
        headings: headings.filter(Boolean), locator: { kind: 'html', path: nodePath(node), ...(node.attribs?.id ? { element_id: node.attribs.id } : {}) },
        group: tag === 'tr' ? nodePath(node.parent) : 'article' });
      return;
    }
    for (const child of children(node)) {
      if (child.type === 'text' && child.data.trim()) {
        records.push({ text: clean(child.data), kind: 'paragraph', headings: headings.filter(Boolean),
          locator: { kind: 'html', path: `${nodePath(node)}/text()[${children(node).filter(n => n.type === 'text').indexOf(child) + 1}]` }, group: 'article' });
      } else if (child.name) visit(child);
    }
  }
  visit(root);
  if (flat(root).some(node => ['img', 'video', 'canvas'].includes(localName(node)))) warnings.push({ code: 'non_text_media_not_extracted' });
  return { records, warnings, metadata: {} };
}

function xmlRecords(text) {
  const dom = markup(text, true), root = elements(dom)[0];
  if (localName(root) !== 'oigusakt') fail('xml_adapter_required');
  const child = (node, name) => elements(node || {}).find(n => localName(n) === name);
  const value = (node, name) => { const selected = child(node, name); return selected ? clean(textContent(selected)) || null : null; };
  const meta = child(root, 'metaandmed'), validity = child(meta, 'kehtivus');
  const name = child(child(root, 'aktinimi'), 'nimi'), publication = child(meta, 'avaldamismarge');
  const metadataNodes = { title: child(name, 'pealkiri'), authority: child(meta, 'valjaandja'),
    act_reference: child(meta, 'globaalID') || child(publication, 'aktViide'),
    valid_from: child(validity, 'kehtivuseAlgus'), valid_to: child(validity, 'kehtivuseLopp'),
    publication_date: child(publication, 'avaldamineKuupaev'), act_type: child(meta, 'dokumentLiik') };
  const metadata = Object.fromEntries(Object.entries(metadataNodes).filter(([, node]) => node && clean(textContent(node)))
    .map(([key, node]) => [key, clean(textContent(node))]));
  const metadata_paths = Object.fromEntries(Object.entries(metadataNodes).filter(([, node]) => node).map(([key, node]) => [key, nodePath(node)]));
  const body = child(root, 'sisu');
  if (!body) fail('xml_act_body_missing');
  const records = [];
  // Technical numbers (paragrahvNr, loigeNr, ...) repeat the displayed ones (kuvatavNr: "§ 1.", "(1)").
  const technical = node => /Nr$/u.test(localName(node)) && localName(node) !== 'kuvatavNr';
  function visit(node, headings = []) {
    const tag = localName(node);
    const titleNode = elements(node).find(isTitle), title = titleNode ? clean(textContent(titleNode)) || null : null;
    // A part, chapter or division adds its displayed number and title ("1. peatükk Üldsätted").
    const label = tag === 'paragrahv' ? null : [value(node, 'kuvatavNr'), title].filter(Boolean).join(' ');
    const nextHeadings = label ? [...headings, label] : headings;
    if (tag === 'paragrahv') {
      const number = value(node, 'kuvatavNr') || value(node, 'paragrahvNr');
      const label = [number ? `§ ${number.replace(/^§\s*/u, '')}` : null, title].filter(Boolean).join(' ');
      records.push({ text: textContent(node, technical).replace(/\r/gu, '').replace(/[ \t]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim(),
        kind: 'legal_unit', headings: [...headings, label].filter(Boolean), group: nodePath(node),
        locator: { kind: 'xml', path: nodePath(node), ...(node.attribs?.id ? { element_id: node.attribs.id } : {}), act_reference: metadata.act_reference } });
      return;
    }
    if (['tavatekst', 'sisuTekst'].includes(tag)) {
      const content = clean(textContent(node));
      if (content) records.push({ text: content, kind: 'paragraph', headings: nextHeadings, group: nodePath(node), locator: { kind: 'xml', path: nodePath(node), act_reference: metadata.act_reference } });
      return;
    }
    elements(node).forEach(n => visit(n, nextHeadings));
  }
  visit(body);
  return { records, metadata: Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== null)), warnings: [], metadata_basis: 'riigi_teataja_xml', metadata_paths };
}

const POINTER_PART = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const NON_CONTENT = new Set(['id', 'canonical_item_id', 'source_id', 'document_id', 'docId', 'schemaVersion', 'metadata_schema_version', 'content_hash',
  'source_keys', 'sourceKeys', 'source_type', 'collection_id', 'itemType', 'item_type', 'municipality_id', 'municipality_name', 'county', 'country',
  'authority', 'language', 'audience', 'historical', 'source_status', 'checked_at', 'checkedAt', 'last_checked', 'retrieved_at', 'valid_from', 'valid_to',
  'url_canonical', 'officialUrl', 'metadata_status', 'metadata_notes', 'sections_present', 'evidence_allowed', 'lastMetadataUpgradeAt',
  'metadata_schema_version', 'organization_id', 'slug', 'resource_type', 'relatedForms', 'relatedContacts', 'relatedDocuments',
  'related_forms', 'related_contacts', 'related_documents', 'allowed_claim_types', 'disallowed_claim_types', 'status']);

function jsonRecords(text, metadata) {
  let root; try { root = JSON.parse(text); } catch { fail('invalid_source_json'); }
  const selected = metadata.source_selector?.json_pointer;
  let target = root;
  if (selected !== undefined) {
    if (typeof selected !== 'string' || selected !== '' && !selected.startsWith('/')) fail('invalid_source_selector');
    for (const part of selected === '' ? [] : selected.slice(1).split('/')) {
      const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
      if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) fail('source_selector_not_found');
      target = target[key];
    }
  }
  if (!target || typeof target !== 'object') fail('source_package_required');
  const records = [];
  function addRecord(object, pointer, fallback) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) fail('invalid_source_record');
    const title = object.title || object.name || fallback;
    for (const [key, value] of Object.entries(object)) {
      const linkField = metadata.record_mapping?.links?.some(link => link.field === key);
      const mappedField = Object.values(metadata.record_mapping?.fields || {}).some(keys => keys.includes(key));
      const bindingField = Object.values(metadata.record_mapping?.bindings || {}).some(keys => keys.includes(key));
      if (NON_CONTENT.has(key) && !linkField && !mappedField && !bindingField || value === null || value === '') continue;
      // One record is one section. Link targets and technical fields a mapping needs (a check
      // date, the official URL) stay citable source text but are anchors, not retrieval text.
      // An adapter verification identity (a binding) keeps its own section: structural-role.js
      // withholds any chunk with a binding location from evidence, so it must not share one.
      const anchor = linkField || NON_CONTENT.has(key) && !bindingField;
      if (bindingField) {
        const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        if (text?.trim()) records.push({ text, kind: 'paragraph', headings: [title, key].filter(Boolean), group: pointer || '/',
          locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}`, record_id: object.id || object.organization_id || null,
            source_keys: object.sourceKeys || object.source_keys || [] } });
        continue;
      }
      if (linkField && Array.isArray(value)) {
        for (const [index, target] of value.entries()) {
          if (typeof target !== 'string' || !target.trim()) fail('invalid_record_links');
          records.push({ text: target, kind: 'paragraph', headings: [title].filter(Boolean), group: pointer || '/', anchor,
            locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}/${index}`, record_id: object.id || null } });
        }
        continue;
      }
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      if (!text?.trim()) continue;
      records.push({ text, kind: key === 'title' || key === 'name' ? 'heading' : 'paragraph', headings: [title].filter(Boolean), group: pointer || '/', anchor,
        locator: { kind: 'json', path: `${pointer}/${POINTER_PART(key)}`, record_id: object.id || object.organization_id || null,
          source_keys: object.sourceKeys || object.source_keys || [] } });
    }
  }
  if (selected !== undefined) addRecord(target, selected, metadata.title);
  else if (Array.isArray(root.items)) {
    root.items.forEach((item, index) => addRecord(item, `/items/${index}`, metadata.title));
  } else if (root.organization_id) {
    const lists = new Set(['services', 'benefits', 'resources', 'contacts', 'documents']);
    addRecord(Object.fromEntries(Object.entries(root).filter(([key]) => !lists.has(key))), '', metadata.title);
    for (const key of lists) if (Array.isArray(root[key])) root[key].forEach((item, index) => addRecord(item, `/${key}/${index}`, metadata.title));
  } else fail('json_source_selector_required');
  if (metadata.record_mapping && selected === undefined) fail('structured_record_selector_required');
  return { records, metadata: {}, structured_record: structuredRecord(target, selected, metadata.record_mapping),
    warnings: [{ code: 'collected_package_text', detail: 'JSON values preserve collected content; they are not a fresh retrieval of the referenced web pages.' }] };
}

export function parseTextSource(bytes, format, metadata, scope, config) {
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, ''); } catch { fail('source_encoding_invalid'); }
  const result = format === 'html' ? htmlRecords(text) : format === 'xml' ? xmlRecords(text) : jsonRecords(text, metadata);
  if (!result.records.length) fail('source_text_empty');
  if (result.records.length > config.maxPdfItems || result.records.reduce((n, r) => n + r.text.length, 0) > config.maxTextChars) fail('text_limit');
  const source_units = [], spans = [], blocks = [], sections = [];
  const rootSection = { ...scope, id: id('section', scope.document_version_id, 'root'), title: null, parent_id: null, span_ids: [] };
  sections.push(rootSection);
  const sectionMap = new Map();
  for (const [index, record] of result.records.entries()) {
    const unit = sourceUnit(record.text.replaceAll('\u0000', '\uFFFD'), record.locator, index, scope.document_version_id);
    source_units.push(unit);
    const sectionKey = JSON.stringify([record.headings, record.group]);
    let section = sectionMap.get(sectionKey);
    if (!section) {
      section = { ...scope, id: id('section', scope.document_version_id, sectionKey), title: record.headings.join(' > ') || null,
        parent_id: rootSection.id, span_ids: [], record_key: record.group };
      sections.push(section); sectionMap.set(sectionKey, section);
    }
    const block = { ...scope, id: id('block', unit.id), kind: record.kind, span_ids: [], record_key: record.group };
    blocks.push(block);
    for (const range of textRanges(unit.raw_text, config.chunkMaxChars)) {
      const source_text = unit.raw_text.slice(range.start, range.end);
      if (!source_text.trim()) continue;
      const span = { ...scope, id: id('span', scope.document_version_id, index, range.start, range.end), ...range,
        source_unit_index: index, pdf_page: null, parser_page_index: null, bbox: [], item_indices: [],
        source_text, retrieval_text: source_text.replace(/\s+/gu, ' ').trim(), transformation: 'decoded_source_text',
        parent_section_id: section.id, block_id: block.id, height: record.kind === 'heading' ? 18 : 12, y: -index,
        ...record.anchor ? { anchor_only: true } : {} };
      spans.push(span); block.span_ids.push(span.id); section.span_ids.push(span.id);
    }
  }
  // Text after a reference list leaves the list's section (a heading element always starts one).
  const referenceSplits = splitReferenceLists({ sections, spans, blocks });
  return { parsed: { info: {}, source_format: format, source_metadata: result.metadata, metadata_basis: result.metadata_basis, metadata_paths: result.metadata_paths,
    ...(result.structured_record ? { structured_record: result.structured_record } : {}) },
    structured: { pages: [], source_units, spans, blocks, sections, removed: [], nulReplacements: 0, warnings: result.warnings, referenceSplits } };
}

export function inspectXmlMetadata(bytes) {
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('source_encoding_invalid'); }
  const { metadata, metadata_paths } = xmlRecords(text);
  return { metadata, metadata_paths };
}
