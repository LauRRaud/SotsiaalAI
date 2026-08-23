function isLikelyYearSentence(match) {
  const marker = String(match?.[1] || "");
  if (!/^(19|20)\d{2}$/.test(marker)) return false;
  const year = Number(marker);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return false;
  const rest = String(match?.[2] || "").trim();
  return /^(aastal|aasta|aastaks|aastani|aastast|paiku|ümbruses|jooksul|alguses|lõpus|sees|around|in|during)\b/i.test(rest);
}

export function parseAssistantMarkdownBlocks(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    const content = paragraph.join("\n").trim();
    if (content) {
      blocks.push({ type: "paragraph", text: content });
    }
    paragraph = [];
  };

  const flushList = () => {
    if (list?.items?.length) {
      blocks.push(list);
    }
    list = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const ordered = orderedMatch && !isLikelyYearSentence(orderedMatch) ? orderedMatch : null;
    const isIndentedContinuation = /^\s{2,}\S/.test(line);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "paragraph", text: heading[1].trim() });
      continue;
    }

    if (unordered || ordered) {
      flushParagraph();
      const type = ordered ? "ordered" : "unordered";
      if (!list || list.type !== type) {
        flushList();
        list = {
          type,
          items: [],
          ...(ordered ? { start: Math.max(1, Number(ordered[1]) || 1) } : {})
        };
      }
      list.items.push((ordered ? ordered[2] : unordered[1]).trim());
      continue;
    }

    if (isIndentedContinuation && list?.items?.length) {
      const lastIndex = list.items.length - 1;
      list.items[lastIndex] = `${list.items[lastIndex]}\n${line.trim()}`;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      if (list?.items?.length) {
        const nextMeaningfulLine = lines.slice(lineIndex + 1).find(candidate => candidate.trim());
        const nextUnordered = nextMeaningfulLine?.match(/^\s*[-*]\s+(.+)$/);
        const nextOrderedMatch = nextMeaningfulLine?.match(/^\s*(\d+)[.)]\s+(.+)$/);
        const nextOrdered = nextOrderedMatch && !isLikelyYearSentence(nextOrderedMatch)
          ? nextOrderedMatch
          : null;
        const nextListType = nextOrdered ? "ordered" : nextUnordered ? "unordered" : null;
        if (nextListType === list.type) continue;
      }
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
