// The coverage map of the RAG corpus (docs/audits/rag-v2-coverage-map-2026-10-08.md): pure counting rules, no I/O.
// A grid (scripts/lib/rag-v2-coverage-grid.json) names life situations and work themes (rows) and kinds of help
// (columns), each by Estonian key terms. A passage counts for a row when its text holds one of the row's terms, and
// for a cell when one of the column's terms stands near that term (the grid's `near`, in characters). Counting is by
// content, not by titles; the state of a cell is derived from the kinds of the sources that hold it.
//
// Term syntax (matched on lowercased text):
//   "dements"            the term starts a word ("dementsus", "dementsusega"); nothing is required after it
//   "töötu$"             the word also ends there
//   "*vägival"           anywhere inside a word ("lähisuhtevägivald")
//   "abivajava laps"     words in a row, any white space between them
//   "väärkohtlemi+eaka"  every part must be in the same passage (the place is the first part's)
//   "re:\\d+ eurot"      a regular expression as written

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const EDGE = '[\\p{L}\\p{N}]', PLACES = 24, BLANK_LINE = String.fromCharCode(10, 10);

function partSource(part) {
  if (part.startsWith('re:')) return part.slice(3);
  let text = part.trim(), inside = false, end = false;
  if (text.startsWith('*')) { inside = true; text = text.slice(1); }
  if (text.endsWith('$')) { end = true; text = text.slice(0, -1); }
  if (!text.trim()) throw Error(`an empty term: "${part}"`);
  return `${inside ? '' : `(?<!${EDGE})`}${text.trim().split(/\s+/u).map(escape).join('\\s+')}${end ? `(?!${EDGE})` : ''}`;
}

/** A matcher for a list of terms: `test` tells whether any term is in the text, `places` where (the first few). */
export function termMatcher(terms) {
  if (!Array.isArray(terms) || !terms.length || terms.some(term => typeof term !== 'string' || !term.trim())) throw Error('terms must be a list of non-empty texts');
  const single = [], joint = [];
  for (const term of terms) {
    if (term.startsWith('re:') || !term.includes('+')) single.push(partSource(term));
    else joint.push(term.split('+').map(part => new RegExp(partSource(part), 'u')));
  }
  const source = single.map(item => `(?:${item})`).join('|'), any = single.length ? new RegExp(source, 'u') : null;
  const test = text => Boolean(any?.test(text)) || joint.some(parts => parts.every(part => part.test(text)));
  const places = text => {
    const found = [];
    if (any) for (const match of text.matchAll(new RegExp(source, 'gu'))) { found.push(match.index); if (found.length >= PLACES) break; }
    for (const parts of joint) if (parts.every(part => part.test(text))) found.push(text.search(parts[0]));
    return found;
  };
  return { test, places };
}

export const normalise = text => String(text ?? '').normalize('NFC').toLowerCase();

// What a document is, for the map. Contacts (a title is a person's name) and forms (given by link) are not counted.
const GROUPS = { web_page: 'official_page', official_guideline: 'guide', information_material: 'guide', organization_page: 'organisation', vendor_page: 'organisation',
  research_report: 'study', policy_analysis: 'study', file: 'journal', web: 'journal', kov_service_info: 'municipal_record', registry: 'registry' };
export const KINDS = Object.freeze(['official_page', 'guide', 'organisation', 'registry', 'municipal_record', 'municipal_act', 'law', 'study', 'journal']);
export const NOT_COUNTED = Object.freeze(['municipal_contact', 'official_contact', 'municipal_contact_directory', 'application_form', 'web_form', 'pdf_form', 'official_form']);
export function documentKind({ type, level }) {
  if (type === 'legal_act') return level === 'national' ? 'law' : 'municipal_act';
  return GROUPS[type] ?? null;
}
const ACTS = new Set(['law', 'municipal_act']), LOCAL = new Set(['municipal_record', 'municipal_act', 'registry']);

export function compileGrid(grid) {
  const ids = new Set();
  for (const item of [...grid.rows, ...grid.columns]) { if (!item.id || ids.has(item.id)) throw Error(`a missing or repeated id: ${item.id}`); ids.add(item.id); }
  for (const key of ['about_share', 'about_passages', 'about_body_share', 'about_body_passages', 'enough_documents', 'enough_municipalities', 'near']) if (!(grid.rules?.[key] > 0)) throw Error(`rules.${key} is missing`);
  return { rules: grid.rules, rows: grid.rows.map(row => ({ ...row, match: termMatcher(row.terms) })),
    columns: grid.columns.map(column => ({ ...column, match: column.terms?.length ? termMatcher(column.terms) : null })) };
}

/**
 * What one passage holds: the indexes of the rows whose terms it has, of those whose terms stand in its heading (the
 * indexed text is the title and heading path, a blank line and the body), and the cells: [row, column] where a term
 * of the column stands within `near` characters of a term of the row. A column without terms holds wherever the row
 * does.
 */
export function passageMarks(compiled, text) {
  const lower = normalise(text), rows = [], cells = [], headed = [], cut = lower.indexOf(BLANK_LINE), heading = cut < 0 ? lower : lower.slice(0, cut);
  let columnPlaces = null;
  for (const [index, row] of compiled.rows.entries()) {
    if (!row.match.test(lower)) continue;
    rows.push(index);
    if (row.match.test(heading)) headed.push(index);
    columnPlaces ||= compiled.columns.map(column => (column.match ? column.match.places(lower) : null));
    const places = row.match.places(lower);
    for (const [column, found] of columnPlaces.entries()) {
      if (found === null || found.some(at => places.some(place => Math.abs(at - place) <= compiled.rules.near))) cells.push([index, column]);
    }
  }
  return { rows, headed, cells };
}

/** A document's counter: the passages per row, and per row and column. */
export function documentTally(compiled) {
  return { passages: 0, rows: new Uint16Array(compiled.rows.length), headed: new Uint16Array(compiled.rows.length), cells: new Uint16Array(compiled.rows.length * compiled.columns.length) };
}
export function addPassage(compiled, tally, marks) {
  tally.passages++;
  for (const row of marks.rows) tally.rows[row]++;
  for (const row of marks.headed) tally.headed[row]++;
  for (const [row, column] of marks.cells) tally.cells[row * compiled.columns.length + column]++;
}

/**
 * A document is about a row when its own headings say so: the row's terms stand in the title or a section heading of
 * a third of its passages, or of three of them (the grid's rules). A longer document without such headings is about
 * the row when half of its passages hold the terms. A mention in the text of a short page or of a general handbook
 * does not make the document about the row.
 */
export function isAbout(rules, tally, row) {
  const headed = tally.headed[row];
  if (headed > 0 && (headed >= rules.about_passages || headed / tally.passages >= rules.about_share)) return true;
  return tally.passages >= rules.about_body_passages && tally.rows[row] / tally.passages >= rules.about_body_share;
}

/**
 * Whether a document counts for a cell. A legal text counts by its passages that hold both the row and the column
 * (one is enough; a column without terms may ask for more with `act_passages`): a general act regulates many things
 * and is about none of them. Anything else counts only when it is about the row.
 */
export function countsForCell(compiled, document, row, column) {
  const both = document.tally.cells[row * compiled.columns.length + column];
  if (!both) return false;
  if (ACTS.has(document.kind)) return both >= (compiled.columns[column].act_passages || 1);
  return isAbout(compiled.rules, document.tally, row);
}

/** The cells of the grid over the counted documents: documents per kind, municipalities, passages, and the state. */
export function tallyGrid(compiled, documents) {
  const width = compiled.columns.length;
  const rows = compiled.rows.map(row => ({ id: row.id, group: row.group, name: row.name, passages: Object.fromEntries(KINDS.map(kind => [kind, 0])), about: Object.fromEntries(KINDS.map(kind => [kind, 0])),
    cells: compiled.columns.map(column => ({ column: column.id, kinds: Object.fromEntries(KINDS.map(kind => [kind, 0])), passages: 0, municipalities: new Set() })) }));
  for (const document of documents) {
    for (const [index, row] of rows.entries()) {
      if (!document.tally.rows[index]) continue;
      row.passages[document.kind] += document.tally.rows[index];
      if (isAbout(compiled.rules, document.tally, index)) row.about[document.kind]++;
      for (let column = 0; column < width; column++) {
        if (!countsForCell(compiled, document, index, column)) continue;
        const cell = row.cells[column];
        cell.kinds[document.kind]++; cell.passages += document.tally.cells[index * width + column];
        if (LOCAL.has(document.kind) && document.municipality) cell.municipalities.add(document.municipality);
      }
    }
  }
  for (const row of rows) for (const [index, cell] of row.cells.entries()) {
    cell.municipalities = cell.municipalities.size;
    Object.assign(cell, cellState(compiled.rules, compiled.columns[index], cell, row.group));
  }
  return rows;
}

/**
 * The state of a cell. `plain` counts the documents of the kinds that are practical guidance for the row's group
 * (the column's `plain`: one list, or one per group); a column may also rest on the municipalities whose own records
 * or acts hold the cell (`local`). In order: enough, thin (one or two guidance documents, or under the municipality
 * bound), then what is left without guidance: only a legal text, only studies or articles, nothing.
 */
export function cellState(rules, column, cell, group) {
  const kinds = Array.isArray(column.plain) ? column.plain : column.plain?.[group] || [];
  const plain = kinds.reduce((sum, kind) => sum + (cell.kinds[kind] || 0), 0), local = column.local ? cell.municipalities : 0;
  const research = cell.kinds.study + cell.kinds.journal, acts = cell.kinds.law + (column.local ? 0 : cell.kinds.municipal_act);
  let state = 'none', basis = null;
  if (plain >= rules.enough_documents) [state, basis] = ['enough', 'guidance'];
  else if (local >= rules.enough_municipalities) [state, basis] = ['enough', 'municipalities'];
  else if (plain > 0) [state, basis] = ['thin', 'guidance'];
  else if (local > 0) [state, basis] = ['thin', 'municipalities'];
  else if (acts > 0) state = 'act_only';
  else if (research > 0) state = 'research_only';
  return { state, basis, plain, research, acts };
}

const SIGN = { enough: '●', thin: '◐', act_only: '§', research_only: '○', none: '–' };
/** A cell as the report shows it: the sign and the number the state rests on. */
export function cellText(cell) {
  if (cell.state === 'none') return SIGN.none;
  if (cell.state === 'act_only') return `${SIGN.act_only} ${cell.acts}`;
  if (cell.state === 'research_only') return `${SIGN.research_only} ${cell.research}`;
  return cell.basis === 'municipalities' ? `${SIGN[cell.state]} KOV ${cell.municipalities}` : `${SIGN[cell.state]} ${cell.plain}`;
}

/** Whether a publisher is one of the named ones (a part of the name, any letter case). */
export function publishedBy(names, publisher) {
  const lower = normalise(publisher);
  return Boolean(lower) && (names || []).some(name => lower.includes(normalise(name)));
}

/** The grid as a Markdown table; `extra` adds columns after the cells: [{ name, text(row) }]. */
export function markdownTable(compiled, rows, group, extra = []) {
  const head = ['Olukord', ...compiled.columns.map(column => column.name), ...extra.map(item => item.name)];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const row of rows.filter(item => item.group === group)) lines.push(`| ${[`${row.id} ${row.name}`, ...row.cells.map(cellText), ...extra.map(item => item.text(row))].join(' | ')} |`);
  return lines.join('\n');
}
