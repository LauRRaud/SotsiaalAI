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

  for (const line of lines) {
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
        list = { type, items: [] };
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
