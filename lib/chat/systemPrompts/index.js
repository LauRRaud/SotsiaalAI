import { buildSystemPromptEn, systemPromptEn } from "./en.js";
import { buildSystemPromptEt, systemPromptEt } from "./et.js";
import { buildSystemPromptRu, systemPromptRu } from "./ru.js";
import { renderExtraSystemInstruction } from "./common.js";

const SYSTEM_PROMPT_DEFINITIONS = {
  en: systemPromptEn,
  et: systemPromptEt,
  ru: systemPromptRu
};

const BUILDERS = {
  en: buildSystemPromptEn,
  et: buildSystemPromptEt,
  ru: buildSystemPromptRu
};

export function normalizeSystemPromptLang(lang = "et") {
  const value = String(lang || "").toLowerCase().split(/[-_]/)[0];
  return value === "en" || value === "ru" || value === "et" ? value : "et";
}

export function buildLocalizedSystemPrompt(args = {}) {
  const lang = normalizeSystemPromptLang(args.replyLang || args.lang || "et");
  return BUILDERS[lang](args);
}

export function buildLocalizedExtraSystemInstruction(key, args = {}) {
  const lang = normalizeSystemPromptLang(args.replyLang || args.lang || "et");
  return renderExtraSystemInstruction(SYSTEM_PROMPT_DEFINITIONS[lang], key, args);
}
