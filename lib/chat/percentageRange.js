// One bounded percentage interval is one fact, never two interchangeable
// scalar percentages. Keep offsets in the original text for claim binding.
export function percentageRanges(value = "") {
  const text = String(value || "");
  return Array.from(text.matchAll(/(?<![\p{L}\d.,–—−-])(?<lower>\d{1,3}(?:[.,]\d+)?)\s*%?\s*(?:[-–—−]|kuni|to|до)\s*(?<upper>\d{1,3}(?:[.,]\d+)?)\s*%(?![\p{L}\d])/giu))
    .flatMap(match => {
      const normalizeQualifier = part => part.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().replace(/[*_]/gu, "");
      const prefix = normalizeQualifier(text.slice(Math.max(0, match.index - 64), match.index));
      const suffix = normalizeQualifier(text.slice(match.index + match[0].length, match.index + match[0].length + 64));
      if (/(?:[~≈<>≤≥]|\d\s*%?\s*(?:[-–—−]|kuni|to|до))\s*$/u.test(prefix) ||
        /^\s*(?:[-–—−]|kuni|to|до)\s*\d/u.test(suffix) ||
        /(?:^|\s)(?:umbes|ligikaudu|ligi|keskmiselt|peaaegu|vahemalt|kuni|ule|alla|enam\s+kui|rohkem\s+kui|vahem\s+kui|approximately|about|around|nearly|over|under|at\s+least|at\s+most|около|примерно|более|менее)\s*$/u.test(prefix) ||
        /^\s*[,([]?\s*(?:(?:voi|ja|or|and|или|и)\s+(?:rohkem|vahem|enam|ule|alla|more|less|above|below|больше|меньше|более|менее)|ligikaudu|umbes|approximately|about|around|около|примерно)(?!\p{L})/u.test(suffix)) return [];
      const lower = match.groups.lower.replace(",", ".");
      const upper = match.groups.upper.replace(",", ".");
      if (!(Number(lower) >= 0 && Number(lower) < Number(upper) && Number(upper) <= 100)) return [];
      return [{
        value: lower, endValue: upper,
        start: match.index, end: match.index + match[0].length,
        lowerIndex: match.index,
        upperIndex: match.index + match[0].lastIndexOf(match.groups.upper)
      }];
    });
}
