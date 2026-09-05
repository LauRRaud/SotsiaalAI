import { fork } from 'node:child_process';
import { fail, id } from './contracts.js';

export function parsePdf(bytes, config) {
  return new Promise((resolve, reject) => {
    const worker = fork(new URL('./pdf-worker.js', import.meta.url), [], {
      serialization: 'advanced', execArgv: ['--max-old-space-size=256'],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
    });
    let result, settled = false, inputSent = false;
    const timer = setTimeout(() => { worker.kill(); finish('parser_timeout'); }, config.timeoutMs);
    function finish(code, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code) reject(Object.assign(new Error(code), { code })); else resolve(value);
    }
    worker.on('message', value => {
      if (value.type === 'ready' && !inputSent) {
        inputSent = true;
        worker.send({ bytes: new Uint8Array(bytes), config }, error => { if (error) finish('parser_worker_failed'); });
      } else if (value.type === 'parsed') { result = value; }
    });
    worker.once('error', () => finish('parser_worker_failed'));
    worker.once('close', code => finish(code !== 0 || !result ? 'parser_worker_failed' : result.error, result));
  });
}

export function structure(parsed, scope, config) {
  const pages = parsed.pages.map(page => {
    const rows = [];
    for (const item of page.items.filter(i => i.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 2);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    let raw = '';
    const lines = rows.map(row => {
      const items = row.items.sort((a, b) => a.x - b.x);
      const text = items.map(i => i.text).join(' ');
      const start = raw.length;
      raw += `${text}\n`;
      return { text, start, end: raw.length - 1, y: row.y, x: items[0].x,
        height: Math.max(...items.map(i => i.height)), item_indices: items.map(i => i.item_index),
        bbox: [items[0].x, row.y, Math.max(...items.map(i => i.x + i.width)), row.y + Math.max(...items.map(i => i.height))] };
    });
    return { ...page, raw_text: raw, lines };
  });
  const key = line => line.text.replace(/\b\d+\s*\/\s*\d+\b/g, '#/#');
  const marginal = (line, page) => line.y > page.view[3] * (1 - config.marginFraction) || line.y < page.view[3] * config.marginFraction;
  const counts = new Map();
  for (const page of pages) for (const k of new Set(page.lines.filter(l => marginal(l, page)).map(key))) counts.set(k, (counts.get(k) || 0) + 1);
  const spans = [], removed = [];
  for (const page of pages) {
    for (const line of page.lines) {
      const base = { ...scope, id: id('span', scope.document_version_id, page.pdf_page, line.start, line.end),
        pdf_page: page.pdf_page, parser_page_index: page.parser_page_index, start: line.start, end: line.end,
        bbox: line.bbox, item_indices: line.item_indices, source_text: line.text, height: line.height, y: line.y };
      if (marginal(line, page) && counts.get(key(line)) >= Math.max(2, Math.ceil(pages.length * 0.6))) {
        removed.push({ ...base, reason: 'repeated_margin' });
      } else {
        spans.push({ ...base, retrieval_text: line.text.replace(/\s+/gu, ' ').trim(), transformation: 'whitespace_only' });
      }
    }
  }
  if (!spans.some(s => /\p{L}/u.test(s.source_text))) fail('needs_ocr');
  const blank = pages.filter(page => !spans.some(s => s.pdf_page === page.pdf_page && /\p{L}/u.test(s.source_text)));
  if (blank.length) fail('partial_text_needs_review');
  const sizes = new Map();
  spans.forEach(s => sizes.set(Math.round(s.height), (sizes.get(Math.round(s.height)) || 0) + s.source_text.length));
  const body = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  const sections = [{ ...scope, id: id('section', scope.document_version_id, 'root'), title: null, parent_id: null, span_ids: [] }];
  const blocks = [];
  let current = sections[0], previousHeading = null;
  let block, previousSpan;
  for (const span of spans) {
    const heading = span.height >= body * config.headingRatio;
    const kind = heading ? 'heading' : span.height >= body * 1.3 ? 'quote' : /^\s*(?:[•●▪]|\d+[.)])\s/u.test(span.source_text) ? 'list_item' : 'paragraph';
    if (!block || block.kind !== kind || previousSpan.pdf_page !== span.pdf_page || Math.abs(previousSpan.y - span.y) > Math.max(span.height, previousSpan.height) * 1.9 || kind === 'list_item') {
      block = { ...scope, id: id('block', span.id), kind, span_ids: [] };
      blocks.push(block);
    }
    block.span_ids.push(span.id);
    span.block_id = block.id;
    previousSpan = span;
    if (heading) {
      if (previousHeading && previousHeading.pdf_page === span.pdf_page && Math.abs(previousHeading.y - span.y) < span.height * 1.6) {
        current.title += ` ${span.retrieval_text}`;
        current.span_ids.push(span.id);
      } else {
        current = { ...scope, id: id('section', span.id), title: span.retrieval_text, parent_id: sections[0].id, span_ids: [span.id] };
        sections.push(current);
      }
      previousHeading = span;
    } else { previousHeading = null; }
    span.parent_section_id = current.id;
  }
  return { pages, spans, sections, blocks, removed };
}
