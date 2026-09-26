// Word gaps in justified text stay below 1 em; column gutters measured in the Sotsiaaltöö
// journal sit at 1.3 em and wider, with almost nothing between 0.9 and 1.1 em.
const SEGMENT_GAP_EM = 1.0;
const MAX_COLUMNS = 3;

/** Merge each baseline's items into segments, detect persistent column gutters between
 *  segments, then read each vertical band column by column. Items first become segments so
 *  that aligned word gaps ("rivers") in justified text are never mistaken for a gutter. */
export function orderPdfItems(input, view) {
  // OCR text layers report word box heights (often the x-height); the font size is the text size.
  input = input.map(item => ({ ...item, height: Math.max(item.height || 0, item.font_size || 0) }));
  const heights = input.map(item => item.height).filter(value => value > 0).sort((a, b) => a - b);
  const height = heights[Math.floor(heights.length / 2)] || 12;
  // Lines by vertical centre, not exact y: OCR text layers place each word at its own box
  // bottom, so words with descenders sit ~2pt lower than their neighbours on the same line.
  const centre = item => item.y + (item.height > 0 ? item.height : height) / 2;
  const lines = [];
  for (const item of [...input].filter(item => Math.abs(item.rotation || 0) <= 5).sort((a, b) => centre(b) - centre(a))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.centre - centre(item)) <= height * 0.6) {
      line.members.push(item); line.centre = line.members.reduce((sum, member) => sum + centre(member), 0) / line.members.length;
    } else lines.push({ centre: centre(item), members: [item] });
  }
  const lineOf = new Map();
  lines.forEach((line, index) => {
    const y = Math.min(...line.members.map(member => member.y));
    for (const member of line.members) lineOf.set(member, { line_index: index, line_y: y });
  });
  const withLine = item => ({ ...item, ...(lineOf.get(item) || { line_index: -1, line_y: item.y }) });
  const byPosition = (a, b) => b.line_y - a.line_y || a.x - b.x;
  const rotated = input.filter(item => Math.abs(item.rotation || 0) > 5).map(withLine);
  const items = input.filter(item => Math.abs(item.rotation || 0) <= 5).map(withLine);
  const finish = (ordered, columns, detail = {}) => ({ items: [...ordered, ...rotated.sort(byPosition)
    .map((item, index) => ({ ...item, reading_lane: 1000000 + index }))], columns, ...detail });
  const single = () => finish(items.sort(byPosition).map(item => ({ ...item, reading_lane: 0 })), 1);
  // Without page columns, a box of side-by-side text columns may still sit in the text; its cells
  // get lanes of their own (their items are marked), the text after it continues in the next lane.
  const boxed = () => {
    const lanes = boxLanes(items, height);
    if (!lanes.boxes) return single();
    return finish(items.map(item => ({ ...item, reading_lane: lanes.of.get(item), ...lanes.inBox.has(item) ? { in_box: true } : {} })).sort((a, b) => a.reading_lane - b.reading_lane || byPosition(a, b)), 1,
      { boxes: lanes.boxes });
  };
  if (items.length < 8) return single();

  const segments = [];
  const byRow = new Map();
  for (const item of items) {
    // Row keys run top to bottom as negative line indexes, so "above" keeps meaning a larger key.
    const key = -item.line_index;
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(item);
  }
  for (const [key, members] of byRow) {
    members.sort((a, b) => a.x - b.x);
    let segment = null;
    for (const item of members) {
      const em = Math.max(item.height || height, segment?.height || 0, 1);
      if (segment && item.x - segment.right < em * SEGMENT_GAP_EM) {
        segment.items.push(item); segment.right = Math.max(segment.right, item.x + item.width); segment.height = Math.max(segment.height, item.height || 0);
      } else {
        segment = { row: key, y: item.line_y, x: item.x, right: item.x + item.width, height: item.height || 0, items: [item] };
        segments.push(segment);
      }
    }
  }
  // OCR word boxes vary in height (x-height vs ascenders); the median member is the text size.
  const typical = segment => { const h = segment.items.map(item => item.height || 0).sort((a, b) => a - b); return h[Math.floor(h.length / 2)]; };
  const body = segments.filter(segment => typical(segment) < height * 1.3);
  const left = Math.min(...segments.map(segment => segment.x)), right = Math.max(...segments.map(segment => segment.right));
  const width = right - left;

  // Gutter candidates: x positions that body segments rarely cross, with enough rows on both sides.
  const findGutters = (from, to) => {
    const inside = body.filter(segment => segment.right > from && segment.x < to);
    const insideRows = new Set(inside.map(segment => segment.row));
    const order = [...insideRows].sort((a, b) => b - a);
    const candidates = [];
    for (let x = from + (to - from) * 0.2; x <= from + (to - from) * 0.8; x += 2) {
      const before = new Set(), after = new Set(), across = new Set();
      for (const segment of inside) {
        if (segment.right <= x) before.add(segment.row);
        else if (segment.x >= x) after.add(segment.row);
        else across.add(segment.row);
      }
      // Count crossings only inside bands where both columns have text. Three or more spanning
      // rows (a lead, footnotes) end a band, so a footer with a label on each side is its own
      // band, while a river inside one column still crosses between the rows it splits.
      const bands = [];
      let band = null, rowsSince = 0, crossingSince = 0;
      for (const key of order) {
        const crossing = across.has(key) ? 1 : 0;
        if (before.has(key) && after.has(key)) {
          if (!band || crossingSince >= 3) bands.push(band = { both: 0, rows: 0, crossing: 0 });
          else { band.rows += rowsSince; band.crossing += crossingSince; }
          band.both++; band.rows++; band.crossing += crossing;
          rowsSince = crossingSince = 0;
        } else { rowsSince++; crossingSince += crossing; }
      }
      if (bands.some(b => b.both >= 4 && b.both >= insideRows.size * 0.2 && b.crossing <= b.rows * 0.12)) candidates.push(x);
    }
    const gaps = [];
    for (const x of candidates) {
      const previous = gaps.at(-1);
      if (previous && x - previous.end <= 2.1) previous.end = x; else gaps.push({ start: x, end: x });
    }
    return gaps.filter(gap => gap.end - gap.start >= Math.max(6, height * 0.6, width * 0.012))
      .map(gap => {
        // A real column starts its lines at one left edge. Take the first segment right of the
        // gap on each row: after a gutter they align; after a river of word gaps they scatter.
        const split = (gap.start + gap.end) / 2;
        const firstRight = new Map();
        for (const segment of inside) if (segment.x >= split && segment.x < to
          && (!firstRight.has(segment.row) || segment.x < firstRight.get(segment.row))) firstRight.set(segment.row, segment.x);
        const starts = [...firstRight.values()];
        const tolerance = Math.max(2, height * 0.3);
        const aligned = starts.length ? Math.max(...starts.map(x => starts.filter(other => Math.abs(other - x) <= tolerance).length)) : 0;
        return { split, aligned, score: starts.length ? aligned / starts.length : 0 };
      })
      .filter(candidate => candidate.aligned >= 4 && candidate.score >= 0.5)
      .sort((a, b) => b.score - a.score || Math.abs(a.split - (from + to) / 2) - Math.abs(b.split - (from + to) / 2))
      .map(candidate => candidate.split);
  };
  // A folded leaflet: on a landscape page whose text never crosses the folds at one and two
  // thirds of its width, with lines in at least two panels, the folds are the gutters.
  const pageWidth = view[2] - view[0], folds = [1, 2].map(k => view[0] + pageWidth * k / 3);
  const panelRows = [0, 1, 2].map(k => new Set(body.filter(segment => column3(segment) === k).map(segment => segment.row)).size);
  function column3(segment) { return folds.filter(fold => segment.x >= fold).length; }
  const folded = pageWidth > (view[3] - view[1]) * 1.2 && !segments.some(segment => folds.some(fold => segment.x < fold && segment.right > fold))
    && panelRows.filter(rows => rows >= 3).length >= 2;
  const gutters = folded ? [...folds] : [];
  if (!folded) {
    const first = findGutters(left, right)[0];
    if (first === undefined) return boxed();
    gutters.push(first);
    // A third column: look once more inside each side that is still wide enough.
    for (const [from, to] of [[left, first], [first, right]]) {
      if (gutters.length >= MAX_COLUMNS - 1 || to - from < width * 0.45) continue;
      const extra = findGutters(from, to)[0];
      if (extra !== undefined) gutters.push(extra);
    }
  }
  gutters.sort((a, b) => a - b);

  const crosses = segment => gutters.some(g => segment.x < g && segment.right > g);
  const column = segment => gutters.filter(g => segment.x >= g).length;
  const rowKeys = [...byRow.keys()].sort((a, b) => b - a);
  const spanning = new Set(segments.filter(crosses).map(segment => segment.row));
  // One or two rows only in the first column after spanning rows are the short last lines of
  // full-width text (a title, lead or footnote) and stay in its lane.
  for (let i = 0; i < rowKeys.length;) {
    if (spanning.has(rowKeys[i])) { i++; continue; }
    let j = i;
    while (j < rowKeys.length && !spanning.has(rowKeys[j])) j++;
    const run = rowKeys.slice(i, j);
    if (i > 0 && run.length <= 2
      && segments.every(segment => !run.includes(segment.row) || column(segment) === 0)) run.forEach(key => spanning.add(key));
    i = j;
  }
  // One or two first-column rows right above spanning rows head the full-width block below
  // ("Viidatud allikad" over a reference list) when they sit below the bottom of every other
  // column of their band, or are set well apart from the column text above them. A left column
  // that simply runs longer than the right one has no full-width block right below it.
  const rowY = new Map(segments.map(segment => [segment.row, segment.y]));
  const firstColumnOnly = key => !segments.some(segment => segment.row === key && column(segment) !== 0);
  for (let i = 1; i < rowKeys.length - 1; i++) {
    if (spanning.has(rowKeys[i]) || !spanning.has(rowKeys[i + 1]) || !firstColumnOnly(rowKeys[i])) continue;
    const heads = [rowKeys[i]];
    if (i > 1 && !spanning.has(rowKeys[i - 1]) && firstColumnOnly(rowKeys[i - 1]) && rowY.get(rowKeys[i - 1]) - rowY.get(rowKeys[i]) <= height * 1.6) heads.unshift(rowKeys[i - 1]);
    const top = rowY.get(heads[0]), below = rowY.get(rowKeys[i]) - rowY.get(rowKeys[i + 1]);
    if (below > height * 2.5) continue;
    let bandStart = rowKeys.indexOf(heads[0]);
    while (bandStart > 0 && !spanning.has(rowKeys[bandStart - 1])) bandStart--;
    const band = rowKeys.slice(bandStart, rowKeys.indexOf(heads[0]));
    const others = segments.filter(segment => band.includes(segment.row) && column(segment) !== 0);
    const belowColumns = others.length > 0 && others.every(segment => segment.y > top + height * 0.5);
    const above = [...band].reverse().find(key => !firstColumnOnly(key) || segments.some(segment => segment.row === key));
    const apart = above !== undefined && rowY.get(above) - top > Math.max(below * 2, height * 2.5);
    if (belowColumns || apart) heads.forEach(key => spanning.add(key));
  }
  // Column bands and runs of spanning rows alternate down the page; each band reads column by
  // column, each spanning run is one lane.
  const stride = gutters.length + 1;
  const bandOf = new Map();
  let band = 0, wasSpanning = false;
  for (const key of rowKeys) {
    if (wasSpanning && !spanning.has(key)) band++;
    bandOf.set(key, band);
    wasSpanning = spanning.has(key);
  }
  // A band whose first column is narrow beside wider ones is a table with row labels: it reads
  // row by row, each label cell followed by the cells beside it. A label cell starts after a
  // vertical gap in the first column; a cell beside it belongs to the last label that starts no
  // lower than it. Text columns of equal width keep reading column by column.
  const tableRow = new Map();
  if (stride >= 2) {
    for (let b = 0; b <= band; b++) {
      const inBand = segments.filter(segment => bandOf.get(segment.row) === b && !spanning.has(segment.row));
      const extent = Array.from({ length: stride }, (_, c) => {
        const members = inBand.filter(segment => column(segment) === c);
        return members.length ? Math.max(...members.map(s => s.right)) - Math.min(...members.map(s => s.x)) : 0;
      });
      if (!extent[0] || extent.slice(1).some(width => width < extent[0] * 1.6)) continue;
      const labels = inBand.filter(segment => column(segment) === 0).sort((a, b) => b.y - a.y);
      // Line pitch from every column: label cells are sparse, value cells hold the running lines.
      const steps = Array.from({ length: stride }, (_, c) => inBand.filter(segment => column(segment) === c).sort((a, b) => b.y - a.y))
        .flatMap(lines => lines.slice(1).map((segment, i) => lines[i].y - segment.y)).filter(step => step > 0).sort((a, b) => a - b);
      const pitch = steps[Math.floor(steps.length / 2)] || height * 1.2;
      const tops = labels.filter((segment, i) => !i || labels[i - 1].y - segment.y > pitch * 1.35).map(segment => segment.y);
      if (tops.length < 3) continue;
      for (const segment of inBand) {
        const index = tops.findLastIndex(top => top >= segment.y - height * 0.5);
        tableRow.set(segment, Math.max(0, index));
      }
    }
  }
  // Lanes number the reading order: band, then its columns (row by row in a table), then the
  // band's closing spanning run.
  const keyOf = segment => spanning.has(segment.row) ? [bandOf.get(segment.row), 1, 0, 0]
    : [bandOf.get(segment.row), 0, tableRow.get(segment) ?? 0, column(segment)];
  const keys = [...new Set(segments.map(segment => keyOf(segment).join(',')))]
    .map(key => key.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
  const laneOf = new Map(keys.map((key, index) => [key.join(','), index]));
  const lane = segment => laneOf.get(keyOf(segment).join(','));
  const ordered = segments.flatMap(segment => {
    const readingLane = lane(segment);
    return segment.items.map(item => ({ ...item, reading_lane: readingLane }));
  }).sort((a, b) => a.reading_lane - b.reading_lane || byPosition(a, b));
  return finish(ordered, stride, { gutters, page_width: view[2] - view[0] });
}

// A box of text columns inside single-column text (an information box with three service
// descriptions, a contact table with four regions): at least three consecutive lines that the same
// gaps split, each gap at least half an em wide and free in every line, two or more such gaps (or
// one of 1.5 em), each gap lined up (the cells beside it start, end or centre at one x) and wider
// than the word gaps inside the cells. Justified text can show a river of word gaps, but the words
// beside it do not line up and the river is no wider than the other gaps. The box reads cell by
// cell only where the lines of a column run on (a hyphen, comma or conjunction at the end, an "@"
// start below, or a lower-case start below a full line) in a third of the line pairs; a table of
// separate entries or with a column of numbers keeps reading row by row. Cells group between larger
// vertical gaps (the rows of a table or the parts of a box), each group column by column.
function boxLanes(items, height) {
  const minGap = Math.max(4, height * 0.5), tolerance = Math.max(1.5, height * 0.2);
  const byLine = new Map();
  for (const item of items) byLine.set(item.line_index, [...byLine.get(item.line_index) || [], item]);
  const rows = [...byLine.values()].map(row => row.sort((a, b) => a.x - b.x)).sort((a, b) => b[0].line_y - a[0].line_y);
  const free = row => {
    const gaps = [];
    let right = -Infinity;
    for (const item of row) { if (item.x - right >= minGap) gaps.push([right, item.x]); right = Math.max(right, item.x + item.width); }
    return [...gaps, [right, Infinity]];
  };
  const intersect = (a, b) => a.flatMap(([s1, e1]) => b.map(([s2, e2]) => [Math.max(s1, s2), Math.min(e1, e2)])).filter(([s, e]) => e - s >= minGap);
  const splits = (row, [s, e]) => row.some(item => item.x + item.width <= s) && row.some(item => item.x >= e);
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const lined = values => values.length >= 3 && values.filter(value => Math.abs(value - median(values)) <= tolerance).length >= values.length * 0.7;
  const of = new Map(), inBox = new Set();
  let lane = 0, boxes = 0;
  for (let i = 0; i < rows.length;) {
    let gaps = free(rows[i]).filter(gap => splits(rows[i], gap)), j = i + 1;
    // Every line of the box is split by the gaps, except a single line that sits in one column
    // (the last line of a quote beside the text) between two split lines.
    const bridged = new Set(), held = (gapSet, upTo) => rows.slice(i, upTo).every((row, k) => bridged.has(i + k) || gapSet.some(gap => splits(row, gap)));
    while (gaps.length && j < rows.length) {
      const next = intersect(gaps, free(rows[j]));
      if (held(next, j + 1)) { gaps = next; j++; continue; }
      const after = j + 1 < rows.length ? intersect(next, free(rows[j + 1])) : [];
      if (next.length !== gaps.length || bridged.has(j - 1) || !held(after, j) || !after.some(gap => splits(rows[j + 1], gap))) break;
      bridged.add(j); gaps = next; j++;
    }
    const box = rows.slice(i, j), gutters = gaps.filter(gap => box.filter(row => splits(row, gap)).length >= box.length / 2).sort((a, b) => a[0] - b[0]);
    // A column of list markers (bullets, dashes, item numbers) belongs to the text beside it: a
    // bulleted list is no box, and a label column of a box keeps its list.
    for (let g = 0; g < gutters.length;) {
      const from = g ? gutters[g - 1][1] : -Infinity, to = gutters[g][0];
      const marks = box.map(row => row.filter(item => item.x >= from && item.x + item.width <= to).map(item => item.text).join(' ').trim()).filter(Boolean);
      if (marks.length && marks.every(mark => /^(?:[•●▪◦·*o\-–—]|\d{1,2}[.)])$/u.test(mark))) gutters.splice(g, 1); else g++;
    }
    const edges = [-Infinity, ...gutters.flat(), Infinity], columns = gutters.length + 1;
    const cells = row => Array.from({ length: columns }, (_, c) => row.filter(item => item.x >= edges[c * 2] && item.x + item.width <= edges[c * 2 + 1]));
    const table = box.map(cells), side = (c, measure) => table.map(row => row[c]).filter(cell => cell.length).map(measure);
    const start = cell => cell[0].x, end = cell => Math.max(...cell.map(item => item.x + item.width)), centre = cell => (start(cell) + end(cell)) / 2;
    const aligned = gutters.every((_, g) => lined(side(g + 1, start)) || lined(side(g, end)) || lined(side(g, centre)) || lined(side(g + 1, centre)));
    // In every line a gap across a gutter is clearly wider (1.5 times) than any gap between the
    // items of one cell: text set word by word has wide justified word gaps, which can line up with
    // the gaps between a chart's axis labels above it.
    const distinct = table.every(row => {
      const inner = row.flatMap(cell => cell.slice(1).map((item, k) => item.x - (cell[k].x + cell[k].width)));
      const across = row.slice(1).flatMap((cell, c) => {
        const left = row.slice(0, c + 1).flat();
        return cell.length && left.length ? [cell[0].x - Math.max(...left.map(item => item.x + item.width))] : [];
      });
      return !across.length || Math.min(...across) >= Math.max(0, ...inner) * 1.5;
    });
    const shaped = box.length >= 3 && gutters.length && (gutters.length >= 2 || gutters[0][1] - gutters[0][0] >= height * 1.5) && aligned && distinct;
    // Groups of lines between larger vertical gaps; a column runs on inside a group.
    const steps = box.slice(1).map((row, k) => box[k][0].line_y - row[0].line_y), pitch = median(steps.length ? steps : [height]);
    const groups = [[0]];
    steps.forEach((step, k) => step > pitch * 1.35 ? groups.push([k + 1]) : groups.at(-1).push(k + 1));
    // A lower-case start continues only a line that fills its column (a wrapped line); short table
    // words ("tasuta", "jah") do not run on. A column's room reaches halfway into the gaps beside it.
    const text = cell => cell.map(item => item.text).join(' ').trim();
    const extent = [Math.min(...box.flat().map(item => item.x)), Math.max(...box.flat().map(item => item.x + item.width))];
    const middles = gutters.map(([s, e]) => (s + e) / 2), room = c => (c < gutters.length ? middles[c] : extent[1]) - (c ? middles[c - 1] : extent[0]);
    let pairs = 0, runs = 0;
    for (const group of groups) for (let c = 0; c < columns; c++) for (let k = 1; k < group.length; k++) {
      const upper = table[group[k - 1]][c], above = text(upper), below = text(table[group[k]][c]);
      if (!above || !below) continue;
      pairs++;
      if (/[-,‐]$|(?:^|\s)(?:ja|ning|või|ega|and|or)$/u.test(above) || /^@/u.test(below)
        || /^\p{Ll}/u.test(below) && end(upper) - start(upper) >= room(c) * 0.6) runs++;
    }
    // A column of numbers makes a data table, whose rows hold together only when read across.
    const numeric = Array.from({ length: columns }, (_, c) => table.map(row => text(row[c])).filter(Boolean))
      .some(values => values.length >= 3 && values.filter(value => /\d/u.test(value) && /^[\d\s.,%*+\-–−€$()/]+$/u.test(value)).length >= values.length * 0.6);
    if (!shaped || numeric || runs < Math.max(1, pairs / 3)) {
      for (const row of shaped ? box : [rows[i]]) for (const item of row) of.set(item, lane);
      i = shaped ? j : i + 1;
      continue;
    }
    lane++;
    for (const group of groups) for (let c = 0; c < columns; c++) {
      const members = group.flatMap(k => table[k][c]);
      if (!members.length) continue;
      for (const item of members) { of.set(item, lane); inBox.add(item); }
      lane++;
    }
    boxes++;
    i = j;
  }
  return { of, inBox, boxes };
}
