import { normalizeSemanticText } from "./semanticTurnContract.js";

export const QUOTED_OBJECT_PATTERN = /[„“«"]([^„“”«»"\n]{1,120})[“”»"]/gu;
const WORDS = /[\p{Letter}\p{Number}]+(?:[-'][\p{Letter}\p{Number}]+)*/gu;
const MODES = new Set(["overview_synthesis", "thematic_synthesis", "professional_method_guidance"]);

export function joinQuotedInitial(value = "") {
  return value.replace(/^(\s*\p{Lu})\s+(?=\p{Ll}{4})/u, "$1");
}

export function attributionHeadingCandidates(reply = "") {
  const lines = String(reply).split(/\r?\n/u);
  return lines.flatMap((line, index) => {
    // A section label must introduce a separate content block. Short list
    // answers, sentence-shaped recommendations and numeric facts are not labels.
    const match = line.match(/^\s*(?:#{1,6}\s+|\d{1,3}[.)]\s+)(.+?)\s*$/u);
    if (!match || lines[index + 1]?.trim() !== "") return [];
    const content = match[1].replace(/\*\*|__/gu, "").trim();
    if (/[\d.!?;:]/u.test(content)) return [];
    const words = content.match(WORDS) || [];
    if (!words.length || words.length > 12) return [];
    const following = lines.slice(index + 2).find(value => value.trim());
    if (!following || /^\s*(?:#{1,6}\s|[-*•]\s|\d+[.)]\s)/u.test(following)) return [];
    return [{ line: line.trim(), text: content }];
  });
}

// This is an ephemeral comparison aid, not a rewrite of the answer, evidence,
// index, or query. One bounded call reuses the existing EstNLTK analyzer.
export async function prepareSourceAttributionLanguage(reply, sources, queryPlan, analyze) {
  const empty = { headings: [], lemmas: {} };
  if (![queryPlan?.mode, queryPlan?.question_planner?.mode].some(mode => MODES.has(mode))) return empty;
  const headings = attributionHeadingCandidates(reply);
  const quotes = value => Array.from(String(value).matchAll(QUOTED_OBJECT_PATTERN), match => joinQuotedInitial(match[1]));
  const phrases = [...new Set([
    ...quotes(reply),
    ...sources.flatMap(source => quotes(String(source.evidenceText || source.text || source.chunk || "")
      .replace(/^\s*\(\d+\)[^\r\n]*\r?\n/u, ""))),
    ...headings.map(item => item.text)
  ])];
  let input = "";
  let wordCount = 0;
  const included = [];
  for (const text of phrases) {
    const words = text.match(WORDS) || [];
    if (!words.length || wordCount + words.length > 120 || input.length + text.length > 6000) continue;
    const start = input.length;
    input += `${text}\n`;
    included.push({ text, start, end: input.length - 1, words });
    wordCount += words.length;
  }
  if (!input || typeof analyze !== "function") return empty;
  let result;
  try { result = await analyze(input, { timeoutMs: 2500 }); } catch { return empty; }
  if (result?.available !== true || !Array.isArray(result.tokens)) return empty;
  const lemmas = {};
  const nominalPhrases = new Set();
  for (const phrase of included) {
    const tokens = result.tokens.filter(token => token.start >= phrase.start && token.end <= phrase.end);
    // A truncated/invalid analysis may not silently classify the remainder.
    if (tokens.length !== phrase.words.length || tokens.some((token, index) =>
      normalizeSemanticText(token.surface) !== normalizeSemanticText(phrase.words[index]))) continue;
    for (const token of tokens) {
      const key = normalizeSemanticText(token.surface);
      lemmas[key] = [...new Set([...(lemmas[key] || []), ...(token.lemmas || []).map(normalizeSemanticText)])].filter(Boolean);
    }
    const nominalToken = token => token.part_of_speech?.length && (!token.part_of_speech.includes("V") ||
      // "Kaitse- ja riskitegurid": the hanging compound prefix is nominal,
      // even though Vabamorf also offers the imperative "kaitse" in isolation.
      (token.part_of_speech.includes("S") && /^-\s+(?:ja|ning|või)\s/iu.test(input.slice(token.end))));
    if (tokens.every(nominalToken) &&
      tokens.at(-1)?.part_of_speech?.includes("S")) nominalPhrases.add(phrase.text);
  }
  return { headings: headings.filter(item => nominalPhrases.has(item.text)).map(item => item.line), lemmas };
}
