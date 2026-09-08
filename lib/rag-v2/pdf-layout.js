/** Detect a persistent central gutter, then read each vertical band by column. */
export function orderPdfItems(input, view) {
  const byPosition = (a, b) => b.y - a.y || a.x - b.x;
  const rotated = input.filter(item => Math.abs(item.rotation || 0) > 5);
  const items = input.filter(item => Math.abs(item.rotation || 0) <= 5);
  const finish = (ordered, columns, detail = {}) => ({ items: [...ordered, ...rotated.sort(byPosition)
    .map((item, index) => ({ ...item, reading_lane: 1000000 + index }))], columns, ...detail });
  if (items.length < 8) return finish(items.sort(byPosition).map(item => ({ ...item, reading_lane: 0 })), 1);
  const heights = items.map(item => item.height).filter(value => value > 0).sort((a, b) => a - b);
  const height = heights[Math.floor(heights.length / 2)] || 12;
  const body = items.filter(item => item.height < height * 1.3);
  const row = item => Math.round(item.y / Math.max(2, height * 0.5));
  const rows = new Set(body.map(row));
  const left = Math.min(...items.map(item => item.x)), right = Math.max(...items.map(item => item.x + item.width));
  const width = right - left, start = left + width * 0.2, end = left + width * 0.8;
  const candidates = [];
  for (let x = start; x <= end; x += 2) {
    const before = new Set(), after = new Set(), across = new Set();
    for (const item of body) {
      if (item.x + item.width <= x) before.add(row(item));
      else if (item.x >= x) after.add(row(item));
      else across.add(row(item));
    }
    if (before.size >= 4 && after.size >= 4 && Math.min(before.size, after.size) >= rows.size * 0.2 && across.size <= rows.size * 0.12) candidates.push(x);
  }
  const gaps = [];
  for (const x of candidates) {
    const previous = gaps.at(-1);
    if (previous && x - previous.end <= 2.1) previous.end = x; else gaps.push({ start: x, end: x });
  }
  const gutter = gaps.filter(gap => gap.end - gap.start >= Math.max(6, height * 0.6, width * 0.012))
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  if (!gutter) return finish(items.sort(byPosition).map(item => ({ ...item, reading_lane: 0 })), 1);
  const split = (gutter.start + gutter.end) / 2;
  const crossing = items.filter(item => item.x < split && item.x + item.width > split).sort(byPosition);
  const separators = [...new Set(crossing.map(item => row(item)))].sort((a, b) => b - a);
  const lane = item => {
    const at = separators.indexOf(row(item));
    if (at >= 0) return at * 3 + 2;
    const band = separators.filter(y => y > row(item)).length;
    return band * 3 + (item.x >= split ? 1 : 0);
  };
  return finish(items.map(item => ({ ...item, reading_lane: lane(item) })).sort((a, b) => a.reading_lane - b.reading_lane || byPosition(a, b)),
    2, { gutter: split, page_width: view[2] - view[0] });
}
