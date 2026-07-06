import { readFile } from "node:fs/promises";
import path from "node:path";

const FRAMEWORK_DOCUMENT_PATHS = {
  et: path.join(process.cwd(), "docs", "legal", "sotsiaalai_raamleping_extracted.txt"),
  en: path.join(process.cwd(), "docs", "legal", "sotsiaalai_framework_en_extracted.txt"),
  ru: path.join(process.cwd(), "docs", "legal", "sotsiaalai_raamleping_ru_extracted.txt")
};
const FRAMEWORK_DOCUMENT_HTML_PATHS = {
  et: path.join(process.cwd(), "docs", "legal", "sotsiaalai_raamleping.html"),
  en: path.join(process.cwd(), "docs", "legal", "sotsiaalai_framework_en.html"),
  ru: path.join(process.cwd(), "docs", "legal", "sotsiaalai_raamleping_ru.html")
};

const TOP_LEVEL_HEADING_RE = /^\d+\.\s+/;
const SUB_HEADING_RE = /^\d+\.\d+\s+/;
const BULLET_RE = /^(?:\u2022|•)\s*/;
const CHECKBOX_RE = /(?:\u2610|☐)\s*/g;
const CHECKLIST_RE = /^(?:\u2610|☐)\s*/;

function normalizeLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isIgnoredStandaloneLabel(line) {
  const text = String(line || "").trim().toLowerCase();
  return text === "väli" || text === "sisu";
}

function isShortStandaloneHeading(line) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (text.length > 48) return false;
  if (/[.!?;:]$/.test(text)) return false;
  if (/^\d/.test(text)) return false;
  return /^[A-ZÕÄÖÜ]/.test(text);
}

function parseBlocks(lines) {
  const blocks = [];
  let activeList = null;

  const flushList = () => {
    if (!activeList?.items?.length) {
      activeList = null;
      return;
    }

    blocks.push({
      type: activeList.type,
      items: [...activeList.items]
    });
    activeList = null;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;
    if (isIgnoredStandaloneLabel(line)) continue;

    const checkboxMatches = Array.from(line.matchAll(CHECKBOX_RE));
    if (checkboxMatches.length >= 2) {
      flushList();
      const options = line
        .split(CHECKBOX_RE)
        .map((part) => part.trim())
        .filter(Boolean);

      blocks.push({
        type: "checkOptionsRow",
        options
      });
      continue;
    }

    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      const item = line.replace(BULLET_RE, "").trim();
      if (!activeList || activeList.type !== "bulletList") {
        flushList();
        activeList = { type: "bulletList", items: [] };
      }
      activeList.items.push(item);
      continue;
    }

    const checklistMatch = line.match(CHECKLIST_RE);
    if (checklistMatch) {
      const item = line.replace(CHECKLIST_RE, "").trim();
      if (!activeList || activeList.type !== "checkList") {
        flushList();
        activeList = { type: "checkList", items: [] };
      }
      activeList.items.push(item);
      continue;
    }

    flushList();

    if (TOP_LEVEL_HEADING_RE.test(line)) {
      blocks.push({ type: "heading", text: line });
      continue;
    }

    if (SUB_HEADING_RE.test(line)) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    if (isShortStandaloneHeading(line)) {
      blocks.push({ type: "label", text: line });
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  flushList();
  return blocks;
}

function getEmptyFrameworkDocument() {
  return {
    title: "Tööalase kasutuse raamistik",
    prefaceBlocks: [],
    documentBlocks: [],
    html: ""
  };
}

function convertFirstOrderedListToBullets(html) {
  const firstListStart = html.indexOf("<ol>");
  if (firstListStart < 0) return html;

  const firstListEnd = html.indexOf("</ol>", firstListStart);
  if (firstListEnd < 0) return html;

  return `${html.slice(0, firstListStart)}<ul>${html.slice(
    firstListStart + "<ol>".length,
    firstListEnd
  )}</ul>${html.slice(firstListEnd + "</ol>".length)}`;
}

function normalizeFrameworkHtml(rawHtml) {
  const html = String(rawHtml || "").replace(/<p><em>[\s\S]*?<\/em><\/p>/, "");

  return convertFirstOrderedListToBullets(html);
}

async function readOptionalHtml(locale, fallbackLocale = "et") {
  const preferredPath = FRAMEWORK_DOCUMENT_HTML_PATHS[locale];
  const fallbackPath = FRAMEWORK_DOCUMENT_HTML_PATHS[fallbackLocale] || FRAMEWORK_DOCUMENT_HTML_PATHS.et;

  try {
    return normalizeFrameworkHtml(await readFile(/*turbopackIgnore: true*/ preferredPath, "utf8"));
  } catch {
    if (preferredPath === fallbackPath) return "";
    try {
      return normalizeFrameworkHtml(await readFile(/*turbopackIgnore: true*/ fallbackPath, "utf8"));
    } catch {
      return "";
    }
  }
}

export async function loadFrameworkDocument(locale = "et") {
  const normalizedLocale = locale === "en" || locale === "ru" ? locale : "et";
  const preferredPath = FRAMEWORK_DOCUMENT_PATHS[normalizedLocale];
  const fallbackPath = FRAMEWORK_DOCUMENT_PATHS.et;

  try {
    let raw;

    try {
      raw = await readFile(/*turbopackIgnore: true*/ preferredPath, "utf8");
    } catch (error) {
      if (preferredPath === fallbackPath) throw error;
      raw = await readFile(/*turbopackIgnore: true*/ fallbackPath, "utf8");
    }

    const lines = normalizeLines(raw);

    if (!lines.length) {
      return getEmptyFrameworkDocument();
    }

    const title = lines[0];
    const firstSectionIndex = lines.findIndex((line) => TOP_LEVEL_HEADING_RE.test(line));
    const prefaceLines = firstSectionIndex > 0 ? lines.slice(1, firstSectionIndex) : lines.slice(1);
    const documentLines = firstSectionIndex > 0 ? lines.slice(firstSectionIndex) : [];

    return {
      title,
      prefaceBlocks: parseBlocks(prefaceLines),
      documentBlocks: parseBlocks(documentLines),
      html: await readOptionalHtml(normalizedLocale)
    };
  } catch (error) {
    console.error("[frameworkDocument] load failed", error);
    return getEmptyFrameworkDocument();
  }
}
