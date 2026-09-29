import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, hash } from '../contracts.js';
import { inspectXmlMetadata } from '../text-source.js';

// A Riigi Teataja act carries its annexes as base64 files inside the XML (oigusakt/lisaViide/.../fail), which the
// act's own text parser leaves out. This adapter reads one annex table into a derived source document: each table
// row is one item, written with the table's own column labels, and the document names the exact XML and annex bytes
// it came from (ADR-050). The ingest adapter checks those bytes again (registered-source.js).
export const RT_ANNEX_EXTRACTOR = 'rag-v2/rt-annex-table-1';
// ADR-053: an annex that is text, not a table (a municipality's benefit rates, an application form, an assessment
// instrument), read page by page.
export const RT_ANNEX_TEXT_EXTRACTOR = 'rag-v2/rt-annex-text-1';

const ATTRIBUTE = /([A-Za-z]+)="([^"]*)"/gu;
/** The annex files of an RT XML act: name, format, element id and decoded bytes. */
export function rtAnnexFiles(xml) {
  const text = typeof xml === 'string' ? xml : new TextDecoder('utf-8', { fatal: true }).decode(xml);
  const files = [];
  for (const match of text.matchAll(/<fail\b([^>]*)>([A-Za-z0-9+/=\s]*)<\/fail>/gu)) {
    const attributes = Object.fromEntries([...match[1].matchAll(ATTRIBUTE)].map(([, key, value]) => [key, value]));
    if (!attributes.failNimi) continue;
    const bytes = Buffer.from(match[2].replace(/\s+/gu, ''), 'base64');
    files.push({ file_name: attributes.failNimi, format: attributes.failVorming || null, element_id: attributes.id || null, bytes, sha256: hash(bytes) });
  }
  return files;
}

// The table formats this adapter reads. A format is recognised by its header labels (letters and digits only, so
// line breaks, hyphens and spacing inside a label do not matter); any other header stops the extraction.
export const ANNEX_TABLES = Object.freeze({
  abivahendite_loetelu: Object.freeze({
    title: 'Abivahendite loetelu',
    columns: Object.freeze([
      'Abivahendi ISO-kood ehk abivahendit täpsustav kood', 'Abivahendite rühma ja abivahendi nimetus',
      'Abivahendi täpsustus või abivahendi grupi kitsendus', 'Abivahendi kasutusaeg', 'Tehingu liik: Müük (M) / Üür (Ü)',
      'Koguseline piirlimiit aastate või kuude arvestuses', 'Individuaalne abivahend (I)',
      'Abivahend, mis on otseselt seotud hooldusteenuse osutamise või teenuse osutamiseks kasutatava hoonega (H)',
      'Piirmäär (õigustatud isikult ülevõetava tasu maksmise kohustuse piirmäär ehk % piirhinnast)', 'Piirhind (üür / kuu)',
      'Piirhind (müük)', 'Ühik',
      'Abistav kirjeldus, millise funktsioonipiirangu või terviseprobleemi korral abivahend sobib (sh soodustingimuste rakendamine)',
      'Eelduskood (SKA soodustingimustel teostatud tehing, mis peab olema eelnevalt tehtud märgitud abivahendi saamiseks)',
      'Välistav kood (SKA soodustingimustel teostatud tehing, mille tõttu ei võimaldata märgitud abivahendit)',
      'Hoolduse minimaalne sagedus üüritava abivahendi puhul', 'Abivahendi vajaduse tuvastaja',
      'Abivahendi müümiseks või üürimiseks sobiva kvalifikatsiooni ja vajaliku ettevalmistusega spetsialist, kes on võrdsustatud abivahendi spetsialisti kutset omava isikuga',
    ]),
    // A class code can be printed with a full stop ("06."); the code itself is without it.
    code: /^\d{2}(?:\.\d{2}){0,3}\.?$/u,
  }),
});
const letters = text => text.normalize('NFC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, '');
// The source misspells "olema" as "oleme" in one header of both versions; the label keeps the act's meaning.
const sameLabel = (found, expected) => letters(found) === letters(expected) || letters(found.replace(/\boleme\b/u, 'olema')) === letters(expected);

/** Items on one line joined as they are set: touching items (a word split in the PDF) without a space. */
function lineText(items) {
  let text = '', end = null;
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    text += end !== null && item.x - end > 0.8 ? ` ${item.s}` : item.s;
    end = item.x + item.w;
  }
  return text.replace(/\s+/gu, ' ').trim();
}
/** A cell's lines top to bottom: a line ending with a hyphen continues without a space; a bullet starts a new line. */
function cellText(items) {
  const lines = [];
  for (const item of [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const line = lines.at(-1);
    if (line && line.page === item.page && Math.abs(line.y - item.y) < 1) line.items.push(item);
    else lines.push({ page: item.page, y: item.y, items: [item] });
  }
  let text = '';
  for (const line of lines.map(entry => lineText(entry.items)).filter(Boolean)) {
    text += !text ? line : /^[•·▪-]\s/u.test(line) ? `\n${line}` : /\p{L}-$/u.test(text) ? line : ` ${line}`;
  }
  return text;
}

/** One annex table from its PDF bytes. pdfjs is loaded on use; nothing in the PDF is executed. */
export async function annexTable(pdfBytes, format) {
  const schema = ANNEX_TABLES[format];
  if (!schema) fail('unsupported_annex_table');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.filter(item => item.str.trim()).map(item => ({ page: n, x: item.transform[4], y: item.transform[5], w: item.width, s: item.str.trim() })));
  }
  await doc.destroy();
  // The header sits on the first page, from the first column's label down to the first row code; the lines above it
  // name the act and the annex. The header does not repeat on later pages.
  const first = pages[0] || [];
  const top = first.filter(item => item.x < 60 && /^Abivahendi\b/u.test(item.s)).sort((a, b) => b.y - a.y)[0];
  const firstRow = first.filter(item => item.x < 60 && schema.code.test(item.s)).sort((a, b) => b.y - a.y)[0];
  if (!top || !firstRow || firstRow.y >= top.y) fail('annex_table_header_not_found');
  const header = first.filter(item => item.y <= top.y + 0.5 && item.y > firstRow.y + 0.5);
  // Columns are the runs of header text separated by empty space (the labels are centred, several lines each).
  const runs = [];
  for (const [start, end] of header.map(item => [item.x, item.x + item.w]).sort((a, b) => a[0] - b[0])) {
    const last = runs.at(-1);
    if (last && start <= last[1] + 1.5) last[1] = Math.max(last[1], end); else runs.push([start, end]);
  }
  const labels = runs.map(([start, end]) => cellText(header.filter(item => item.x >= start - 0.1 && item.x < end)));
  if (labels.length !== schema.columns.length || labels.some((label, i) => !sameLabel(label, schema.columns[i]))) fail('annex_table_header_changed');
  // A cell item belongs to the column whose header run it starts in: a class name can run on over the next column.
  // Text starting between runs goes by its centre to the nearest run: the narrow number columns are centred, so their
  // text can start left of the header ("taotluse alusel" under "Piirhind (müük)").
  const column = item => {
    const start = runs.findIndex(([from, to]) => item.x >= from - 0.1 && item.x <= to);
    if (start >= 0) return start;
    const centre = item.x + item.w / 2;
    let best = 0, distance = Infinity;
    runs.forEach(([start, end], i) => { const d = centre < start ? start - centre : centre > end ? centre - end : 0; if (d < distance) { best = i; distance = d; } });
    return best;
  };
  const intro = cellText(first.filter(item => item.y > top.y + 0.5));
  // Rows: every item from the first code on, in reading order; a code in the first column starts a row, and text
  // before the next code (also on the next page) belongs to the row above.
  const body = pages.flatMap((items, index) => (index ? items : items.filter(item => item.y <= firstRow.y + 0.5)))
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  // Items of one printed line can sit a fraction apart (a code 0.2 below its row's name, while lines are about 3.9 apart), so lines are grouped first.
  const lines = [];
  for (const item of body) {
    const line = lines.at(-1);
    if (line && line.page === item.page && Math.abs(line.y - item.y) < 0.6) line.items.push(item);
    else lines.push({ page: item.page, y: item.y, items: [item] });
  }
  const rows = [];
  for (const line of lines) {
    const codes = line.items.filter(item => column(item) === 0 && schema.code.test(item.s));
    if (codes.length > 1) fail('annex_table_two_codes_on_one_line');
    if (codes.length) rows.push({ code: codes[0].s.replace(/\.$/u, ''), page: line.page, items: [] });
    if (!rows.length) fail('annex_table_text_before_first_row');
    rows.at(-1).items.push(...line.items.filter(item => !codes.includes(item)));
  }
  // A code can repeat: a group heading and its own row ("09.30 Uriini absorbeerivad abivahendid" twice). A repeat
  // gets its occurrence in its id; the first occurrence names the group.
  const seen = new Map();
  return { format, title: schema.title, intro, columns: schema.columns, pages: pages.length,
    rows: rows.map(row => ({ id: seen.set(row.code, (seen.get(row.code) || 0) + 1).get(row.code) > 1 ? `${row.code}-${seen.get(row.code)}` : row.code,
      code: row.code, page: row.page,
      cells: schema.columns.map((_, i) => (i ? cellText(row.items.filter(item => column(item) === i)) : row.code)) })) };
}

/** The derived source document: an introduction item, then one item per row with its group path and labelled cells. */
export function annexDocument(table, { title }) {
  const byCode = new Map();
  for (const row of table.rows) if (!byCode.has(row.code)) byCode.set(row.code, row);
  const nameOf = row => `${row.code} ${row.cells[1]}`.trim();
  const items = [{ id: 'lisa', title, text: [table.intro, `Veerud: ${table.columns.join('; ')}.`].filter(Boolean).join('\n\n') }];
  for (const row of table.rows) {
    const parts = row.code.split('.');
    const groups = parts.slice(1).map((_, i) => byCode.get(parts.slice(0, i + 1).join('.'))).filter(Boolean).map(nameOf);
    const cells = row.cells.slice(2).map((value, i) => [table.columns[i + 2], value]).filter(([, value]) => value);
    items.push({ id: row.id, title: nameOf(row),
      // The title (code and name) is the item's heading; the text starts with the group path.
      text: [...(groups.length ? [`Rühm: ${groups.join(' > ')}`] : []), ...cells.map(([label, value]) => `${label}: ${value}`),
        `(${table.title}, lisa lk ${row.page})`].join('\n') });
  }
  return { title, extractor: RT_ANNEX_EXTRACTOR, table: table.format, items };
}

/** A text annex's pages, each as lines. A line is put together from its text items by position: a space only where the
 *  items have a gap, so a number the PDF splits into two items ("6" and "00 eurot") stays one word. */
export async function annexText(pdfBytes) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const items = (await (await doc.getPage(n)).getTextContent()).items.filter(item => item.str)
        .map(item => ({ x: item.transform[4], y: item.transform[5], w: item.width, s: item.str, size: Math.abs(item.transform[0]) || 10 }));
      const lines = [];
      for (const item of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
        let line = lines.find(entry => Math.abs(entry.y - item.y) <= item.size * 0.3);
        if (!line) lines.push(line = { y: item.y, items: [] });
        line.items.push(item);
      }
      const text = lines.sort((a, b) => b.y - a.y).map(line => {
        let out = '', end = null;
        for (const item of line.items.sort((a, b) => a.x - b.x)) {
          if (end !== null && item.x - end > item.size * 0.2 && !/\s$/u.test(out) && !/^\s/u.test(item.s)) out += ' ';
          out += item.s; end = item.x + item.w;
        }
        return out.replace(/\s+/gu, ' ').trim();
      }).filter(Boolean).join('\n');
      if (text) pages.push({ page: n, text });
    }
  } finally { await doc.destroy(); }
  if (!pages.length) fail('rt_annex_text_empty');
  return pages;
}

/** The derived source of a text annex: one item per page, titled with the annex's own heading. */
export function annexTextDocument(pages, { title }) {
  return { title, extractor: RT_ANNEX_TEXT_EXTRACTOR, table: 'text',
    items: pages.map(({ page, text }) => ({ id: `lk-${page}`, title: pages.length > 1 ? `${title}, lk ${page}` : title, text })) };
}
// A form's blanks ("SÜNNITOETUSE ___ OSA") are not part of its heading.
const folded = text => text.normalize('NFC').replace(/_+/gu, ' ').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('et');

/** The derived source and metadata for one annex, as text ready to write. A text annex (format 'text') takes its
 *  heading from the person who read it; the heading must be the annex's own words. */
export async function derivedAnnex({ root, xmlPath, fileName, table: format, out, heading = null }) {
  const xml = await fs.readFile(path.join(root, xmlPath));
  const act = inspectXmlMetadata(xml).metadata;
  const file = rtAnnexFiles(xml).find(entry => entry.file_name === fileName);
  if (!file || file.format !== 'pdf') fail('rt_annex_file_not_found');
  if (format === 'text') return derivedTextAnnex({ xml, xmlPath, act, file, out, heading });
  const table = await annexTable(file.bytes, format);
  // The version phrase the annex prints under its title ("sotsiaalministri 24.09.2026 määruse nr 37 sõnastuses").
  const wording = table.intro.match(/\(([^()]*sõnastuses)\)/u)?.[1];
  const title = `${table.title}: määruse „${act.title}“ lisa${wording ? ` (${wording})` : ''}`;
  const source = annexDocument(table, { title });
  const metadata = { document_id: `riigiteataja:${act.act_reference}:lisa:${format}`, title, source_type: 'legal_act', language: 'et',
    authority: act.authority, valid_from: act.valid_from, ...(act.valid_to ? { valid_to: act.valid_to } : {}), publication_date: act.publication_date,
    jurisdiction_level: 'national', country: 'EE', source_url: `https://www.riigiteataja.ee/akt/${act.act_reference}`,
    source_path: `${out}.json`, source_format: 'json',
    rt_annex: { xml_path: xmlPath, xml_sha256: hash(xml), act_reference: act.act_reference, file_name: file.file_name, pdf_sha256: file.sha256,
      table: format, extractor: RT_ANNEX_EXTRACTOR, rows: table.rows.length, pages: table.pages } };
  return { source: `${JSON.stringify(source, null, 2)}\n`, metadata: `${JSON.stringify(metadata, null, 2)}\n`, rows: table.rows.length };
}

// A text annex keeps its act's validity; its jurisdiction is the act's, set on ingest from the registered XML (ADR-053).
async function derivedTextAnnex({ xml, xmlPath, act, file, out, heading }) {
  if (typeof heading !== 'string' || !heading.trim() || heading.length > 200) fail('rt_annex_heading_required');
  const pages = await annexText(file.bytes);
  if (!folded(pages.map(page => page.text).join('\n')).includes(folded(heading))) fail('rt_annex_heading_not_in_text');
  const title = `${heading.trim()}: ${act.authority} määruse „${act.title}“ lisa`;
  const slug = file.file_name.replace(/\.pdf$/iu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
  const source = annexTextDocument(pages, { title });
  const metadata = { document_id: `riigiteataja:${act.act_reference}:lisa:${slug}`, title, source_type: 'legal_act', language: 'et',
    authority: act.authority, valid_from: act.valid_from, ...(act.valid_to ? { valid_to: act.valid_to } : {}), publication_date: act.publication_date,
    source_url: `https://www.riigiteataja.ee/akt/${act.act_reference}`, source_path: `${out}.json`, source_format: 'json',
    rt_annex: { xml_path: xmlPath, xml_sha256: hash(xml), act_reference: act.act_reference, file_name: file.file_name, pdf_sha256: file.sha256,
      table: 'text', extractor: RT_ANNEX_TEXT_EXTRACTOR, heading: heading.trim(), pages: pages.length } };
  return { source: `${JSON.stringify(source, null, 2)}\n`, metadata: `${JSON.stringify(metadata, null, 2)}\n`, rows: pages.length };
}
