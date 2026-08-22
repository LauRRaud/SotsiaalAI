const PAGE_TOKEN_RE = /^(\d+)\s*[-–—]\s*(\d+)$/u;
const SINGLE_PAGE_RE = /^\d+$/u;
const MAX_EXPANDED_RANGE = 10000;

function pageTokens(value) {
  if (Array.isArray(value)) return value.flatMap(pageTokens);
  if (typeof value !== "string" && typeof value !== "number") return [];
  return String(value)
    .replace(/^\s*lk\s+/iu, "")
    .split(/[;,]/u)
    .map(token => token.trim())
    .filter(Boolean);
}

export function uniqueSortedPageNumbers(value) {
  const pages = [];
  for (const token of pageTokens(value)) {
    const range = token.match(PAGE_TOKEN_RE);
    if (range) {
      const first = Number(range[1]);
      const second = Number(range[2]);
      const start = Math.min(first, second);
      const end = Math.max(first, second);
      if (start < 1 || end - start > MAX_EXPANDED_RANGE) continue;
      for (let page = start; page <= end; page += 1) pages.push(page);
      continue;
    }
    if (!SINGLE_PAGE_RE.test(token)) continue;
    const page = Number(token);
    if (Number.isSafeInteger(page) && page > 0) pages.push(page);
  }
  return [...new Set(pages)].sort((left, right) => left - right);
}

export function normalizePageReferences(value) {
  const sorted = uniqueSortedPageNumbers(value);
  if (!sorted.length) return "";

  const ranges = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const page = sorted[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = previous = page;
  }
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges.join(", ");
}
