import process from 'node:process';

// Input is already bounded bytes. No URL, embedded JavaScript or annotation action is executed.
globalThis.fetch = () => { throw new Error('network_disabled'); };
process.channel.ref();
const send = value => new Promise((resolve, reject) => process.send(value, error => error ? reject(error) : resolve()));
const input = new Promise(resolve => process.once('message', resolve));
await send({ type: 'ready' });
const workerData = await input;
const compact = text => text.normalize('NFKC').replace(/\s+/gu, '');
// Inserts characters into text at offsets counted in its characters without spaces; a character
// goes right after the last counted one, before any space that follows.
function insertAt(text, inserts) {
  let out = '', count = 0, next = 0;
  while (next < inserts.length && inserts[next].offset === 0) out += inserts[next++].char;
  for (const ch of text) {
    out += ch;
    count += compact(ch).length;
    while (next < inserts.length && inserts[next].offset === count && compact(ch)) out += inserts[next++].char;
  }
  return out;
}
try {
  const { getDocument, OPS, AnnotationMode } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Two font faults are repaired from the operator list, which keeps every glyph's character code
  // in content order:
  // - a glyph mapped to U+FFFD although its code is plain ASCII (a journal set every full stop
  //   this way) takes its ASCII character, in a font whose other ASCII codes all map to
  //   themselves, when the page's U+FFFD count in the text content matches the glyphs found;
  // - a glyph mapped to spaces and one visible character (" ." for a full stop) loses that
  //   character in the text content: a bare space item stays, or nothing at a line end. Its
  //   position in the page's glyph text without spaces is kept, and when that text equals the
  //   text content without spaces, the character goes back at the same position.
  const glyphInfo = async page => {
    const list = await page.getOperatorList({ annotationMode: AnnotationMode.DISABLE });
    const fonts = new Map(), replaced = [], lost = [];
    let font = null, text = '';
    list.fnArray.forEach((fn, index) => {
      if (fn === OPS.setFont) font = list.argsArray[index][0];
      if (fn !== OPS.showText) return;
      const stats = fonts.get(font) || fonts.set(font, { agree: 0, disagree: 0 }).get(font);
      for (const glyph of list.argsArray[index][0]) {
        if (!glyph || typeof glyph !== 'object' || typeof glyph.unicode !== 'string') continue;
        if (/^\s+\S$/u.test(glyph.unicode)) { lost.push({ at: text.length, char: glyph.unicode.trim() }); continue; }
        text += compact(glyph.unicode);
        if (glyph.unicode === '\uFFFD') replaced.push({ font, code: glyph.originalCharCode });
        else if (glyph.originalCharCode >= 0x21 && glyph.originalCharCode <= 0x7e) {
          if (glyph.unicode === String.fromCharCode(glyph.originalCharCode)) stats.agree++; else stats.disagree++;
        }
      }
    });
    return { text, lost, replaced: replaced.map(({ font, code }) => {
      const stats = fonts.get(font);
      return code >= 0x21 && code <= 0x7e && stats.agree >= 20 && !stats.disagree ? String.fromCharCode(code) : null;
    }) };
  };
  const task = getDocument({ data: workerData.bytes, isEvalSupported: false, useSystemFonts: true,
    disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > workerData.config.maxPages) throw new Error('page_limit');
    const pages = [];
    let length = 0, itemCount = 0, lostSeen = false;
    for (let index = 0; index < pdf.numPages; index++) {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      if (content.items.length > workerData.config.maxPdfItemsPerPage) throw new Error('item_limit');
      itemCount += content.items.length;
      if (itemCount > workerData.config.maxPdfItems) throw new Error('item_limit');
      // A bare space item is not kept, but it is the word gap pdf.js found: OCR text layers write a
      // separate, nearly zero-width space between word boxes. The next item keeps it (space_before).
      // On a page where such items stand between most words, every item is a word box and boxes
      // that touch or overlap are still separate words.
      const strings = content.items.filter(item => typeof item.str === 'string');
      const bare = strings.filter(item => item.str.length > 0 && !item.str.trim());
      const visible = strings.filter(item => item.str.trim());
      const wordBoxes = visible.length >= 20 && bare.length >= visible.length * 0.5;
      const replacements = visible.reduce((sum, item) => sum + item.str.split('\uFFFD').length - 1, 0);
      // The operator list is read where a repair can apply: U+FFFD in the text, or bare space items
      // outside a word-box layer (a lost character leaves one mid-line); once a document has shown
      // lost characters, on every later page too.
      const info = replacements || !wordBoxes && (bare.length || lostSeen) ? await glyphInfo(page) : null;
      if (info?.lost.length) lostSeen = true;
      const replaced = info?.replaced.length === replacements ? info.replaced : [];
      const inserts = new Map();
      if (info?.lost.length && info.text === compact(visible.map(item => item.str).join(''))) {
        let start = 0, next = 0;
        for (const item of visible) {
          const size = compact(item.str).length, own = [];
          while (next < info.lost.length && info.lost[next].at <= start + size) {
            own.push({ offset: info.lost[next].at - start, char: info.lost[next].char });
            next++;
          }
          if (own.length) inserts.set(item, own);
          start += size;
        }
      }
      const kept = [];
      let spaceBefore = false, next = 0;
      for (const item of strings) {
        if (!item.str.trim()) { spaceBefore ||= item.str.length > 0; continue; }
        let glyph_recoveries = inserts.get(item)?.length || 0;
        const str = insertAt(replaced.length ? item.str.replace(/\uFFFD/gu, () => {
          const code = replaced[next++];
          if (code === null) return '\uFFFD';
          glyph_recoveries++;
          return code;
        }) : item.str, inserts.get(item) || []);
        kept.push({ ...item, str, spaceBefore: spaceBefore || wordBoxes, glyph_recoveries });
        spaceBefore = false;
      }
      const items = kept.map((item, i) => ({ text: item.str, item_index: i, x: item.transform[4], y: item.transform[5],
        width: item.width, height: item.height, font_size: Math.hypot(item.transform[2], item.transform[3]), font_name: item.fontName,
        rotation: Math.atan2(item.transform[1], item.transform[0]) * 180 / Math.PI, glyph_recoveries: item.glyph_recoveries,
        ...item.spaceBefore && i ? { space_before: true } : {} }));
      length += items.reduce((sum, item) => sum + item.text.length, 0);
      if (length > workerData.config.maxTextChars) throw new Error('text_limit');
      pages.push({ parser_page_index: index, pdf_page: index + 1, view: page.view, items });
      page.cleanup();
    }
    await send({ type: 'parsed', pages, info: (await pdf.getMetadata()).info });
  } finally { await pdf.destroy(); }
} catch (error) {
  const code = ['page_limit', 'text_limit', 'item_limit'].includes(error.message) ? error.message : 'pdf_parse_failed';
  await send({ type: 'parsed', error: code });
} finally {
  process.disconnect();
}
