import { fork } from 'node:child_process';
import { fail, id } from './contracts.js';
import { orderPdfItems } from './pdf-layout.js';
import { endsSentence, hyphenatedPairs, joinLine, referenceEntryLike, referenceListTitle, splitReferenceLists } from './chunking.js';
import { sourceUnit, textRanges } from './source-locations.js';

export function parsePdf(bytes, config, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = fork(options.workerPath || new URL('./pdf-worker.js', import.meta.url), [], {
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

// Lines that are never headings: a bullet anywhere in the line, a figure or table caption, a
// table-of-contents line with dot leaders, and a bibliographic entry ("Trost, J. (1999). …",
// "Turu-Uuringute AS (2016). …").
const LEADERS = /(?:\.\s?){4,}|…{2,}/u;
const NOT_HEADING = [/(?:^|\s)[•●▪□■◦](?:\s|$)/u, /^(?:joonis|tabel|figure|table|skeem|diagramm|graafik)\s*\d/iu, LEADERS,
  /^\p{Lu}[\p{L}'’-]+,\s(?:\p{Lu}\.\s?)+.*\((?:19|20)\d{2}[a-z]?\)|^\p{Lu}[^()]{1,80}\s\((?:19|20)\d{2}[a-z]?\)[.,]\s/u];
const DROP_CAP = /^\p{L}\s\p{Ll}/u, PAGE_RUN_IN = /^\d{1,3}\s+\p{Ll}/u;

export function structure(parsed, scope, config) {
  if (!Array.isArray(parsed?.pages) || parsed.pages.length > config.maxPages) fail('invalid_parser_output');
  let totalItems = 0;
  const pages = parsed.pages.map(page => {
    if (!Array.isArray(page.items) || page.items.length > config.maxPdfItemsPerPage) fail('item_limit');
    totalItems += page.items.length;
    if (totalItems > config.maxPdfItems) fail('item_limit');
    const rows = [];
    const orderedInput = page.items.filter(item => typeof item.text === 'string' && item.text.trim()
      && [item.x, item.y, item.width, item.height].every(Number.isFinite)).map(item => ({ ...item,
        nul_replacements: item.text.split('\u0000').length - 1, text: item.text.replaceAll('\u0000', '\uFFFD'),
      }));
    // Overprinted text (a shadow or simulated bold drawn twice at almost the same place) keeps one copy.
    const drawn = new Map();
    const unique = orderedInput.filter(item => {
      const near = Math.max(1.5, (item.height || 0) * 0.2), copies = drawn.get(item.text) || [];
      if (copies.some(other => Math.abs(other.x - item.x) <= near && Math.abs(other.y - item.y) <= near)) return false;
      drawn.set(item.text, [...copies, item]);
      return true;
    });
    const layout = orderPdfItems(unique, page.view), ordered = layout.items;
    for (const item of ordered) {
      let row = rows.at(-1);
      if (row && (row.line_index !== item.line_index || row.reading_lane !== item.reading_lane)) row = null;
      if (!row) { row = { y: item.line_y, line_index: item.line_index, reading_lane: item.reading_lane, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    // pdf.js starts a new item at a font change or a repositioning and writes the spaces it infers
    // itself, inside an item or as a whitespace item before it (space_before). Items that touch at
    // the same size are one word ("P|raktika", "luua|."): under 0.1 em, or 0.2 em before closing
    // punctuation. Smaller raised marks (footnote numbers) stay apart.
    const joint = (a, b) => {
      if (/\s$/u.test(a.text) || /^\s/u.test(b.text)) return '';
      if (b.space_before) return ' ';
      const size = Math.max(Math.min(a.height, b.height), 1);
      if (Math.abs(a.height - b.height) > size * 0.25) return ' ';
      return b.x - (a.x + a.width) < size * (/^[.,;:!?)\]”»]/u.test(b.text) ? 0.2 : 0.1) ? '' : ' ';
    };
    let raw = '';
    const lines = rows.map(row => {
      const items = row.items.sort((a, b) => a.x - b.x);
      const text = items.map((item, i) => (i ? joint(items[i - 1], item) : '') + item.text).join('');
      const start = raw.length;
      raw += `${text}\n`;
      const height = items.reduce((maximum, item) => Math.max(maximum, item.height), 0);
      const right = items.reduce((maximum, item) => Math.max(maximum, item.x + item.width), items[0].x);
      // The box covers every item, raised marks included: bottom is the lowest item, top the highest.
      const bottom = items.reduce((minimum, item) => Math.min(minimum, item.y), row.y);
      const top = items.reduce((maximum, item) => Math.max(maximum, item.y + item.height), bottom + height);
      // A line set in a single font keeps it; subheadings are whole lines in a non-body font.
      const fonts = new Set(items.map(item => item.font_name ?? null));
      const font = fonts.size === 1 ? [...fonts][0] : null;
      return { text, start, end: raw.length - 1, y: row.y, reading_lane: row.reading_lane, x: items[0].x, rotation: items[0].rotation || 0,
        height, font, in_box: items.some(item => item.in_box), item_indices: items.map(i => i.item_index), bbox: [items[0].x, bottom, right, top],
        nul_replacements: items.reduce((sum, item) => sum + item.nul_replacements, 0),
        glyph_recoveries: items.reduce((sum, item) => sum + (item.glyph_recoveries || 0), 0) };
    });
    return { parser_page_index: page.parser_page_index, pdf_page: page.pdf_page, view: page.view, raw_text: raw, lines, columns: layout.columns, text_boxes: layout.boxes || 0,
      nul_replacements: ordered.reduce((sum, item) => sum + item.nul_replacements, 0),
      glyph_recoveries: ordered.reduce((sum, item) => sum + (item.glyph_recoveries || 0), 0) };
  });
  // Running heads and footers repeat with changing page numbers, issue labels and letter spacing
  // ("S O T S I A A L T Ö Ö 1/2017"): compare them without the numbers at either end, spaces or
  // punctuation. Numbers inside the line stay, so "Toetus on 100 eurot" never matches "200 eurot".
  const key = line => line.text.toLowerCase().replace(/^[\d\s/.,:\-–]+|[\d\s/.,:\-–]+$/gu, '').replace(/[\s\p{P}]+/gu, '');
  const lineSizes = new Map();
  for (const page of pages) for (const line of page.lines) lineSizes.set(Math.round(line.height), (lineSizes.get(Math.round(line.height)) || 0) + line.text.length);
  const textSize = [...lineSizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  // Page marks, never larger than the text: a page number or issue label ("1 / 2 0 1 7"), an
  // upper-case running head with a separate number ("16 SOTSIAALTÖÖ KORRALDUS", not "COVID-19"),
  // or letter-spaced decoration.
  const pageMark = line => {
    if (line.height > textSize * 1.05) return false;
    const compact = line.text.replace(/\s+/gu, ''), tokens = line.text.trim().split(/\s+/u);
    return /^[\d/.\-–]{1,12}$/u.test(compact) && /\d/u.test(compact)
      || /\d/u.test(line.text) && /^\s*(?:\d{1,4}\s+)?\p{Lu}[\p{Lu}\s\-–]{2,60}?(?:\s+\d{1,4})?\s*$/u.test(line.text)
      || tokens.length >= 5 && tokens.filter(token => [...token].length === 1).length >= tokens.length * 0.7;
  };
  const marginal = (line, page) => line.y > page.view[3] * (1 - config.marginFraction) || line.y < page.view[3] * config.marginFraction;
  const counts = new Map();
  for (const page of pages) for (const k of new Set(page.lines.filter(l => marginal(l, page)).map(key))) counts.set(k, (counts.get(k) || 0) + 1);
  const repeated = (line, page) => marginal(line, page) && key(line) && counts.get(key(line)) >= Math.max(2, Math.ceil(pages.length * 0.6));
  // A running head set just below the margin zone ("Hindamisvahendi käsiraamat" in a display font)
  // is told from a heading by its place: the same line within 2 pt of the same height on most pages
  // (at least three), within twice the zone. A heading repeated once or at other heights stays; so
  // does a page's only line, and only one such line goes at each edge.
  const near = (line, page) => line.y > page.view[3] * (1 - 2 * config.marginFraction) || line.y < page.view[3] * 2 * config.marginFraction;
  const placed = new Map();
  for (const page of pages) for (const line of page.lines) if (near(line, page) && key(line)) placed.set(key(line), [...placed.get(key(line)) || [], { page, y: line.y }]);
  const inPlace = (line, page) => near(line, page) && key(line) && new Set((placed.get(key(line)) || []).filter(other => Math.abs(other.y - line.y) <= 2)
    .map(other => other.page)).size >= Math.max(3, Math.ceil(pages.length * 0.6));
  // Only the outermost lines go: a repeated or page-mark line counts when nothing but other such
  // lines sits between it and the page edge, so body text in the margin zone stays.
  const edgeMarks = new Map();
  for (const page of pages) {
    const upright = page.lines.filter(line => Math.abs(line.rotation) <= 5).sort((a, b) => b.y - a.y);
    for (const walk of [upright, [...upright].reverse()]) {
      let head = upright.length > 1;
      for (const line of walk) {
        const reason = marginal(line, page) && repeated(line, page) ? 'repeated_margin' : marginal(line, page) && pageMark(line) ? 'page_mark'
          : head && inPlace(line, page) ? 'repeated_running_head' : null;
        if (!reason) break;
        if (reason === 'repeated_running_head') head = false;
        edgeMarks.set(line, reason);
      }
    }
  }
  // Rotated text at a side edge (an archive stamp): right at the edge, or repeated on the pages.
  const side = (line, page, fraction) => line.x < page.view[0] + (page.view[2] - page.view[0]) * fraction
    || line.x > page.view[2] - (page.view[2] - page.view[0]) * fraction;
  const rotatedCounts = new Map();
  for (const page of pages) for (const k of new Set(page.lines.filter(l => Math.abs(l.rotation) > 5 && side(l, page, config.marginFraction)).map(key))) {
    rotatedCounts.set(k, (rotatedCounts.get(k) || 0) + 1);
  }
  const rotatedMargin = (line, page) => Math.abs(line.rotation) > 5 && (side(line, page, 0.045)
    || side(line, page, config.marginFraction) && rotatedCounts.get(key(line)) >= Math.max(2, Math.ceil(pages.length * 0.6)));
  const spans = [], removed = [], fontOf = new Map(), boxed = new Set();
  for (const page of pages) {
    for (const line of page.lines) {
      const base = { ...scope, id: id('span', scope.document_version_id, page.pdf_page, line.start, line.end),
        pdf_page: page.pdf_page, parser_page_index: page.parser_page_index, start: line.start, end: line.end,
        bbox: line.bbox, item_indices: line.item_indices, source_text: line.text, height: line.height, y: line.y, rotation: line.rotation,
        reading_lane: line.reading_lane, source_unit_index: page.parser_page_index };
      const reason = rotatedMargin(line, page) ? 'rotated_margin' : edgeMarks.get(line);
      if (reason) {
        removed.push({ ...base, reason });
      } else {
        for (const range of textRanges(line.text, config.chunkMaxChars)) {
          const source_text = line.text.slice(range.start, range.end);
          if (!source_text.trim()) continue;
          spans.push({ ...base, id: id('span', scope.document_version_id, page.pdf_page, line.start + range.start, line.start + range.end),
            start: line.start + range.start, end: line.start + range.end, source_text, retrieval_text: source_text.replace(/\s+/gu, ' ').trim(),
            transformation: line.nul_replacements ? 'pdf_nul_to_replacement_character_then_whitespace'
              : line.glyph_recoveries ? 'pdf_glyph_char_code_recovered_then_whitespace' : 'whitespace_only' });
          fontOf.set(spans.at(-1), line.font);
          if (line.in_box) boxed.add(spans.at(-1));
        }
      }
    }
  }
  if (!spans.some(s => /\p{L}/u.test(s.source_text))) fail('needs_ocr');
  // Pages without any text: covers (the first or last two pages, at most three of them) or at most
  // a tenth of the document are kept and reported by page; more may be unread scanned text and
  // stop the document for review. A page whose only text was running heads or page numbers (a
  // photo page) is kept and reported as well.
  const textless = pages.filter(page => !page.lines.some(line => /\p{L}/u.test(line.text))).map(page => page.pdf_page);
  const cover = number => number <= 2 || number > pages.length - 2;
  if (textless.length && !(textless.length <= 3 && textless.every(cover) || textless.length <= pages.length * 0.1)) fail('partial_text_needs_review');
  const marginOnly = pages.filter(page => !spans.some(s => s.pdf_page === page.pdf_page && /\p{L}/u.test(s.source_text))).map(page => page.pdf_page);
  const sizes = new Map();
  spans.forEach(s => sizes.set(Math.round(s.height), (sizes.get(Math.round(s.height)) || 0) + s.source_text.length));
  const body = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  const fonts = new Map();
  spans.forEach(s => fontOf.get(s) != null && fonts.set(fontOf.get(s), (fonts.get(fontOf.get(s)) || 0) + s.source_text.length));
  const bodyFont = [...fonts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const sameLane = (a, b) => a && b && a.pdf_page === b.pdf_page && a.reading_lane === b.reading_lane;
  // Pull quotes repeat a sentence of the article in a display font. A run of two or more lines in
  // one non-body font below heading size, ending a sentence with at least 60 letters, is removed
  // only when the same letters stay in body text: a copy in another display font (a second quote,
  // a table) does not count, and table labels, which end no sentence, are never candidates.
  const letters = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const bodyLetters = letters(spans.filter(span => fontOf.get(span) === bodyFont || fontOf.get(span) == null).map(span => span.source_text).join(''));
  const repeats = new Set();
  for (let i = 0; i < spans.length; i++) {
    const font = fontOf.get(spans[i]);
    if (font == null || font === bodyFont || bodyFont == null || spans[i].height >= body * config.headingRatio) continue;
    let j = i + 1;
    while (j < spans.length && j - i < 12 && fontOf.get(spans[j]) === font && sameLane(spans[i], spans[j])
      && spans[j].height < body * config.headingRatio && spans[j - 1].y - spans[j].y <= spans[j].height * 1.8) j++;
    const run = spans.slice(i, j), quote = letters(run.map(span => span.source_text).join(''));
    if (run.length >= 2 && quote.length >= 60 && /[.!?…]["'”»’)]*\s*$/u.test(run.at(-1).source_text) && bodyLetters.includes(quote)) {
      run.forEach(span => repeats.add(span));
    }
    i = j - 1;
  }
  for (let i = spans.length - 1; i >= 0; i--) if (repeats.has(spans[i])) removed.push({ ...spans.splice(i, 1)[0], reason: 'repeated_pull_quote' });
  // Footnotes: a run of smaller lines in the bottom 40% of a page that starts with a note mark
  // ("1 Vaimse …", "* …") and ends its page part, where the sentence before it runs on in lower case
  // after it. The run moves to where that sentence ends, never past a heading, so the sentence
  // reads through ("Abi | notes | saamata" becomes "Abi saamata | notes").
  const views = new Map(pages.map(page => [page.pdf_page, page.view]));
  const small = span => span.height <= body * 0.9;
  const low = span => span.y - views.get(span.pdf_page)[1] < (views.get(span.pdf_page)[3] - views.get(span.pdf_page)[1]) * 0.4;
  for (let i = 1; i < spans.length; i++) {
    const first = spans[i];
    if (!small(first) || !low(first) || !/^\s*(?:\d{1,3}|[*†‡])\s+\S/u.test(first.source_text) || small(spans[i - 1]) || endsSentence(spans[i - 1])) continue;
    let j = i + 1;
    while (j < spans.length && spans[j].pdf_page === first.pdf_page && small(spans[j]) && low(spans[j])) j++;
    if (j >= spans.length || sameLane(spans[j - 1], spans[j]) || small(spans[j]) || !/^\p{Ll}/u.test(spans[j].retrieval_text)) continue;
    let k = j;
    while (k < spans.length && k - j < 60 && !endsSentence(spans[k]) && spans[k].height < body * config.headingRatio) k++;
    if (k >= spans.length || k - j >= 60 || spans[k].height >= body * config.headingRatio) continue;
    const run = spans.splice(i, j - i);
    spans.splice(k - run.length + 1, 0, ...run);
    i = k;
  }
  // Subheadings set in body size or somewhat larger (up to the large-heading size, so no size falls
  // between the two rules): one to three whole lines in another font, with space above, no closing
  // sentence punctuation, and at least 150 characters of body text right below in the same lane (an
  // author's name over a two-line affiliation is not a subheading).
  const subheadings = new Set();
  for (let i = 0; i < spans.length; i++) {
    const font = fontOf.get(spans[i]), first = spans[i];
    if (font == null || font === bodyFont || bodyFont == null || !/^[\p{Lu}\d]/u.test(first.source_text.trim())) continue;
    let j = i;
    while (j < spans.length && j - i < 4 && fontOf.get(spans[j]) === font && sameLane(first, spans[j]) && spans[j].height >= body * 0.95
      && spans[j].height < body * config.headingRatio && (j === i || spans[j - 1].y - spans[j].y <= spans[j].height * 1.6)) j++;
    const run = spans.slice(i, j), previous = spans[i - 1], next = spans[j];
    if (!run.length || run.length > 3 || run.reduce((sum, span) => sum + span.source_text.length, 0) > 150) continue;
    if (/[.,;:]\s*$/u.test(run.at(-1).source_text) || !sameLane(run.at(-1), next) || fontOf.get(next) !== bodyFont) continue;
    if (sameLane(previous, first) && previous.y - first.y < Math.max(previous.height, first.height) * 1.7) continue;
    let following = 0;
    for (let k = j; k < spans.length && following < 150 && (fontOf.get(spans[k]) === bodyFont || fontOf.get(spans[k]) == null); k++) {
      following += spans[k].source_text.length;
    }
    if (following < 150) continue;
    run.forEach(span => subheadings.add(span));
    i = j - 1;
  }
  // Without distinguishing fonts (an OCR text layer), a subheading is geometric: one to three short
  // lines (under 45% of a typical line, or 60% below a gap of 2.5 lines) after a finished paragraph
  // and a clear gap, starting with a capital and ending without punctuation, with at least 150
  // characters of text after it. A line that starts in lower case and stays under 70% of a typical
  // line continues the heading ("Väärtuste, ootuste ja / normide mitmesuunaline / mõju praktikas");
  // the text after it starts a sentence.
  if (fonts.size <= 1) {
    // Lines of a box read cell by cell are short by design and do not set the typical length.
    const lengths = spans.filter(span => !boxed.has(span)).map(span => span.source_text.trim().length).sort((a, b) => a - b);
    const typical = lengths[Math.floor(lengths.length * 0.75)] || 0;
    const short = (span, share = 0.45) => span.source_text.trim().length < typical * share;
    const continued = span => /^\p{Ll}/u.test(span.source_text.trim()) && span.source_text.trim().length < typical * 0.7;
    for (let i = 1; i < spans.length; i++) {
      const first = spans[i], previous = spans[i - 1], lead = Math.max(previous.height, first.height), gap = previous.y - first.y;
      if (!short(first, gap >= lead * 2.5 ? 0.6 : 0.45) || !/^\p{Lu}/u.test(first.source_text.trim()) || !sameLane(previous, first) || !endsSentence(previous)
        || gap < lead * 1.7 || previous.height >= body * config.headingRatio) continue;
      let j = i + 1;
      while (j < spans.length && j - i < 3 && sameLane(first, spans[j]) && (short(spans[j]) || continued(spans[j]))
        && !/[.;!?]\s*$/u.test(spans[j - 1].source_text)
        && spans[j - 1].y - spans[j].y <= Math.max(spans[j].height, spans[j - 1].height) * 2) j++;
      const run = spans.slice(i, j), next = spans[j];
      if (/[.,;:!?]\s*$/u.test(run.at(-1).source_text) || !sameLane(run.at(-1), next) || short(next)
        || /^\p{Ll}/u.test(next.source_text.trim())) continue;
      let following = 0;
      for (let k = j; k < spans.length && following < 150 && sameLane(next, spans[k]); k++) following += spans[k].source_text.length;
      if (following < 150) continue;
      run.forEach(span => subheadings.add(span));
      i = j - 1;
    }
  }
  // Large text is a heading only in short runs (a title of up to four lines). A longer run is the
  // body text of a page part set in a larger size, such as a leaflet panel.
  const large = new Set();
  for (let i = 0; i < spans.length;) {
    if (spans[i].height < body * config.headingRatio) { i++; continue; }
    let j = i + 1;
    while (j < spans.length && spans[j].height >= body * config.headingRatio && spans[j].pdf_page === spans[i].pdf_page
      && Math.abs(spans[j - 1].y - spans[j].y) <= Math.max(spans[j].height, spans[j - 1].height) * 2.2) j++;
    const run = spans.slice(i, j);
    if (run.length <= 4 && run.reduce((sum, span) => sum + span.source_text.length, 0) <= 250) run.forEach(span => large.add(span));
    i = j;
  }
  // A candidate line is not a heading when it is a list item (a bullet anywhere in the line: a table
  // row merged with a bullet column), a figure or table caption, a table-of-contents line with dot
  // leaders, a bibliographic entry, a drop cap before a sentence, a line ending in a broken word with
  // no heading line after it, a page number run into a sentence, or prose that runs on into the next
  // body line (it starts in lower case). Prose signals: a line-break hyphen or comma at the end, a
  // finished sentence (after a lower-case letter, so "6 . Vähenenud" stays numbering) followed by
  // more words, or two commas. Checked from the end, so a line knows whether the next one is a heading.
  const candidate = span => large.has(span) || subheadings.has(span), rejected = new Set();
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (!candidate(span)) continue;
    const text = span.source_text.trim(), next = spans[i + 1];
    const nextIsHeading = next && candidate(next) && !rejected.has(next);
    const sentence = /(?<=\p{Ll})[.!?]\s+\p{Lu}?\p{Ll}+\s+\p{Ll}+/u.test(text), broken = /\p{Ll}-$/u.test(text);
    const prose = broken || /,$/u.test(text) || sentence || (text.match(/,\s/gu) || []).length >= 2;
    const runsOn = prose && next && sameLane(span, next) && !nextIsHeading && /^\p{Ll}/u.test(next.source_text.trim()) && !/:\s*$/u.test(text);
    if (NOT_HEADING.some(pattern => pattern.test(text)) || large.has(span) && DROP_CAP.test(text) && prose || broken && !nextIsHeading
      || PAGE_RUN_IN.test(text) && sentence || runsOn) rejected.add(span);
  }
  for (const span of rejected) { large.delete(span); subheadings.delete(span); }
  const pairs = hyphenatedPairs(spans);
  const sections = [{ ...scope, id: id('section', scope.document_version_id, 'root'), title: null, parent_id: null, span_ids: [] }];
  const blocks = [];
  let current = sections[0], previousHeading = null;
  let block, previousSpan;
  for (const [index, span] of spans.entries()) {
    // A reference list heading is a heading at any size ("Viidatud allikad" is often set small),
    // but not its table-of-contents line: with dot leaders, or followed within four lines by a bare
    // page number and no entry.
    const following = spans.slice(index + 1, index + 5);
    const contents = following.some(next => /^\d{1,4}$/u.test(next.retrieval_text)) && !following.some(next => referenceEntryLike(next.retrieval_text));
    const heading = large.has(span) || subheadings.has(span)
      || referenceListTitle(span.retrieval_text) && !LEADERS.test(span.source_text) && !contents;
    // Numbered items take a short number and a capital ("1. Hindamine"); Estonian ordinal dates
    // ("1. jaanuarist", "2016. aastal") are running text.
    const kind = heading ? 'heading' : span.height >= body * 1.3 ? 'quote'
      : /^\s*(?:[•●▪]\s|\d{1,2}\)\s|\d{1,2}\.\s+\p{Lu})/u.test(span.source_text) ? 'list_item' : 'paragraph';
    if (!block || block.kind !== kind || previousSpan.pdf_page !== span.pdf_page || previousSpan.reading_lane !== span.reading_lane
      || Math.abs(previousSpan.y - span.y) > Math.max(span.height, previousSpan.height) * 1.9
      || kind === 'paragraph' && span.bbox[0] - previousSpan.bbox[0] > span.height * 0.7 || kind === 'list_item') {
      block = { ...scope, id: id('block', span.id), kind, span_ids: [] };
      blocks.push(block);
    }
    block.span_ids.push(span.id);
    span.block_id = block.id;
    previousSpan = span;
    if (heading) {
      // Heading lines right below one another form one title, also where the layout put the last
      // short line into the column band below; hyphenated title words are rejoined.
      if (previousHeading && previousHeading.pdf_page === span.pdf_page
        && Math.abs(previousHeading.y - span.y) < Math.max(span.height, previousHeading.height) * 2.2
        && span.bbox[0] < previousHeading.bbox[2] && previousHeading.bbox[0] < span.bbox[2]) {
        current.title = joinLine(current.title, span.retrieval_text, pairs);
        current.span_ids.push(span.id);
      } else {
        current = { ...scope, id: id('section', span.id), title: span.retrieval_text, parent_id: sections[0].id, span_ids: [span.id] };
        sections.push(current);
      }
      previousHeading = span;
    } else { previousHeading = null; }
    span.parent_section_id = current.id;
  }
  // The text after a reference list starts with its own title when its first lines are set apart
  // like one (the next article or chapter): display size, or another font at body size or larger;
  // up to four lines in that font and size, 150 characters, a capital or number first and no
  // closing punctuation. The authors and affiliation below it stay text.
  const titleRun = rest => {
    const first = rest[0], font = fontOf.get(first);
    if (!/^[\p{Lu}\d]/u.test(first.source_text.trim()) || !(first.height >= body * 1.3 || font != null && font !== bodyFont && first.height >= body * 0.95)) return [];
    let j = 1;
    while (j < rest.length && j < 4 && fontOf.get(rest[j]) === font && sameLane(first, rest[j]) && Math.abs(rest[j].height - first.height) <= first.height * 0.15
      && rest[j - 1].y - rest[j].y <= rest[j].height * 2.2) j++;
    const run = rest.slice(0, j);
    return run.reduce((sum, span) => sum + span.source_text.length, 0) > 150 || /[.,;:]\s*$/u.test(run.at(-1).source_text)
      || run.some(span => NOT_HEADING.some(pattern => pattern.test(span.source_text.trim()))) ? [] : run;
  };
  const splits = splitReferenceLists({ sections, spans, blocks, titleRun });
  return { pages, source_units: pages.map((page, index) => sourceUnit(page.raw_text, { kind: 'pdf', pdf_page: page.pdf_page }, index, scope.document_version_id)), spans, sections, blocks, removed, warnings: [
    ...pages.some(page => page.text_boxes) ? [{ code: 'pdf_text_box_read_by_cell', detail: `Pages ${pages.filter(page => page.text_boxes).map(page => page.pdf_page).join(', ')} hold a box of side-by-side text columns inside single-column text; its cells were read one by one, which keeps each cell whole but not the links across a row.` }] : [],
    ...pages.some(page => page.columns > 1) ? [{ code: 'pdf_column_order_detected', detail: 'Persistent gutter used to order two columns within vertical bands; complex tables and irregular layouts still require review.' }] : [],
    ...textless.length ? [{ code: 'pdf_pages_without_text_layer', detail: `Pages ${textless.join(', ')} have no text layer (a cover, blank page or image); their content is not extracted.` }] : [],
    ...marginOnly.length ? [{ code: 'pdf_pages_without_body_text', detail: `Pages ${marginOnly.join(', ')} hold only running heads or page numbers, for example photo pages.` }] : []], nulReplacements: pages.reduce((sum, page) => sum + page.nul_replacements, 0),
    glyphRecoveries: pages.reduce((sum, page) => sum + page.glyph_recoveries, 0), referenceSplits: splits };
}
