import { DEFAULT_MODEL, OPENAI_MAX_OUTPUT_TOKENS } from "./settings.js";
import {
  buildLocalizedExtraSystemInstruction,
  buildLocalizedSystemPrompt,
  normalizeSystemPromptLang
} from "./systemPrompts/index.js";
import { serverT } from "../i18n/serverMessages.js";

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

const ROLE_MAX_OUTPUT_FALLBACK = {
  CLIENT: 900,
  SOCIAL_WORKER: 1200
};

const OPENAI_MAX_OUTPUT_TOKENS_CLIENT = (() => {
  const v = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS_CLIENT);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : ROLE_MAX_OUTPUT_FALLBACK.CLIENT;
})();

const OPENAI_MAX_OUTPUT_TOKENS_WORKER = (() => {
  const v = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS_WORKER);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : ROLE_MAX_OUTPUT_FALLBACK.SOCIAL_WORKER;
})();

function resolveMaxOutputTokens(effectiveRole, maxOutputTokens) {
  if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
    return Math.floor(maxOutputTokens);
  }

  return effectiveRole === "SOCIAL_WORKER"
    ? OPENAI_MAX_OUTPUT_TOKENS_WORKER
    : OPENAI_MAX_OUTPUT_TOKENS_CLIENT;
}

/* ------------------------------------------------------------------ */
/* Date context                                                        */
/* ------------------------------------------------------------------ */

function todayContext(lang = "et") {
  const fmt = () =>
    new Intl.DateTimeFormat("et-EE", {
      timeZone: "Europe/Tallinn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

  let formatted;
  try {
    formatted = fmt();
  } catch {
    try {
      const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Tallinn" }));
      const pad = n => String(n).padStart(2, "0");
      formatted = `${pad(tzNow.getDate())}.${pad(tzNow.getMonth() + 1)}.${tzNow.getFullYear()}`;
    } catch {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      formatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    }
  }

  const normalizedLang = normalizeSystemPromptLang(lang);
  if (normalizedLang === "ru") {
    return `Контекст даты: ${formatted} (Europe/Tallinn). Если пользователь путается во времени, используй точные даты.`;
  }
  if (normalizedLang === "en") {
    return `Date context: ${formatted} (Europe/Tallinn). Use exact dates if the user seems confused about time.`;
  }
  return `Kuupäeva kontekst: ${formatted} (Europe/Tallinn). Kui kasutaja näib ajas eksivat, kasuta täpseid kuupäevi.`;
}

/* ------------------------------------------------------------------ */
/* Language                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lightweight language hinting only.
 * The model itself is good at language understanding; this is just to keep
 * replyLang stable when the app needs a concrete value.
 */
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const ESTONIAN_HINT_RE =
  /[äöõüšž]|\b(aga|aitäh|aitah|ei|ja|kas|kuidas|kus|mida|miks|millal|mis|olen|oled|olete|palun|soovin|tahan|tere|vajan|vald|või|voi)\b/i;
const ENGLISH_HINT_RE =
  /\b(hello|hi|please|thanks|thank you|what|why|how|when|where|who|can you|could you|help)\b/i;

function detectLang(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;

  if (CYRILLIC_RE.test(raw)) return "ru";
  if (ESTONIAN_HINT_RE.test(raw)) return "et";
  if (ENGLISH_HINT_RE.test(raw)) return "en";

  return null;
}

function lastLanguageFromHistory(history = []) {
  if (!Array.isArray(history)) return null;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    const content =
      typeof item?.content === "string"
        ? item.content
        : typeof item?.text === "string"
          ? item.text
          : "";

    const detected = detectLang(content);
    if (detected) return detected;
  }

  return null;
}

function normalizeSupportedLang(value = "") {
  const lang = String(value || "").toLowerCase().split(/[-_]/)[0];
  return lang === "et" || lang === "ru" || lang === "en" ? lang : null;
}

export function pickReplyLang({ userMessage, uiLocale, history, lastReplyLang } = {}) {
  const ui = normalizeSupportedLang(uiLocale);
  if (ui) return ui;

  const last = normalizeSupportedLang(lastReplyLang);
  if (last) {
    return last;
  }

  const historyLang = lastLanguageFromHistory(history);
  if (historyLang) return historyLang;

  const detected = detectLang(userMessage || "");
  if (detected) return detected;

  return "et";
}

/* ------------------------------------------------------------------ */
/* UI locale strings                                                   */
/* ------------------------------------------------------------------ */

export function langStrings(lang = "et", role = "CLIENT") {
  const isWorker = role === "SOCIAL_WORKER";
  const noContextKey = isWorker
    ? "chat.fallback.no_context_worker"
    : "chat.fallback.no_context_client";

  if (lang === "ru") {
    return {
      greetingClient: "Здравствуйте! Чем могу помочь?",
      greetingWorker: "Здравствуйте! С какой темой могу помочь?",
      noContext: serverT(
        lang,
        noContextKey,
        undefined,
        isWorker
          ? "Я пока не нашёл точного ответа. Уточните, пожалуйста, муниципалитет, тип услуги или ситуации и срочность."
          : "Я пока не нашёл точного ответа. Опишите, пожалуйста, ситуацию чуть подробнее и укажите хотя бы город или волость. Личный код и PIN-коды не нужны."
      ),
      crisis: "Если есть непосредственная опасность — звони 112."
    };
  }

  if (lang === "en") {
    return {
      greetingClient: "Hello! How can I help?",
      greetingWorker: "Hello! What topic can I help with?",
      noContext: serverT(
        lang,
        noContextKey,
        undefined,
        isWorker
          ? "I could not find an exact answer right now. Please specify the municipality, the type of service or situation, and how urgent it is."
          : "I could not find an exact answer right now. Please describe your situation a bit more and include at least your municipality or city. Personal ID numbers and PIN codes are not needed."
      ),
      crisis: "If there is immediate danger, call 112."
    };
  }

  return {
    greetingClient: "Tere! Mis küsimusega saan aidata?",
    greetingWorker: "Tere! Mis teemaga saan aidata?",
    noContext: serverT(
      lang,
      noContextKey,
      undefined,
      isWorker
        ? "Ma ei leidnud praegu täpset vastust. Palun täpsusta omavalitsus, teenuse või olukorra tüüp ning kui kiire asjaga on tegu."
        : "Ma ei leidnud praegu täpset vastust. Kirjelda palun oma olukorda veidi täpsemalt ja lisa vähemalt vald või linn. Isikukoodi ega PIN-koode ei ole vaja."
    ),
    crisis: "Kui on otsene oht, helista kohe 112."
  };
}

function buildSystemPrompt({ effectiveRole, isCrisis = false, replyLang = "et" }) {
  const normalizedReplyLang = normalizeSystemPromptLang(replyLang || "et");
  return buildLocalizedSystemPrompt({
    effectiveRole,
    isCrisis,
    replyLang: normalizedReplyLang,
    dateContext: todayContext(normalizedReplyLang)
  });
}

/* ------------------------------------------------------------------ */
/* Context packing                                                     */
/* ------------------------------------------------------------------ */

function buildMaterialMessage({ context }) {
  return {
    role: "system",
    content: context
      ? `RAG_CONTEXT\n${context}`
      : "RAG_CONTEXT\nNo verified context provided. If a fact is missing, say so clearly."
  };
}

function hasNumberedRagBlock(context = "") {
  const text = String(context || "");
  if (/^USER DOCUMENT:/i.test(text)) {
    return /\n\n\(\d+\)\s+/m.test(text);
  }
  return /^\(\d+\)\s+/m.test(text);
}

function buildGroundingMessage({ grounding, context, replyLang = "et" } = {}) {
  if (grounding !== "weak" || !hasNumberedRagBlock(context)) return null;

  const normalizedReplyLang = normalizeSystemPromptLang(replyLang || "et");
  if (normalizedReplyLang === "en") {
    return {
      role: "system",
      content: [
        "RAG_GROUNDING: weak.",
        "The source context is partial or uneven.",
        "Do not present the answer as a complete overview of the whole field.",
        "Answer from the available information, but do not open with technical source- or search-status phrasing.",
        "Do not add years, policy changes, legal details, amounts, deadlines, or official requirements that RAG_CONTEXT does not support.",
        "If the user asks for the main changes, say these are the main items the current search could confirm."
      ].join(" ")
    };
  }

  if (normalizedReplyLang === "ru") {
    return {
      role: "system",
      content: [
        "RAG_GROUNDING: weak.",
        "Контекст источников неполный или неровный.",
        "Не представляй ответ как полный обзор всей области.",
        "Отвечай по имеющейся информации, но не начинай с технических фраз о статусе источников или поиска.",
        "Не добавляй годы, изменения политики, юридические детали, суммы, сроки или официальные требования, которых нет в RAG_CONTEXT.",
        "Если пользователь спрашивает о главных изменениях, уточни, что это главные пункты только в пределах видимых источников."
      ].join(" ")
    };
  }

  return {
    role: "system",
    content: [
      "RAG_GROUNDING: weak.",
      "Allikakontekst on osaline või ebaühtlane.",
      "Ära esita vastust täieliku ülevaatena kogu valdkonnast.",
      "Anna vastus olemasoleva info põhjal, kuid ära ava seda tehnilise allika- või otsingustaatuse fraasiga.",
      "Ära lisa aastaid, poliitikamuudatusi, õiguslikke detaile, summasid, tähtaegu ega ametlikke nõudeid, millele RAG_CONTEXT ei anna tuge.",
      "Kui kasutaja küsib peamisi muudatusi, ütle, et need on peamised punktid, millele praegune otsing leidis allikakinnituse."
    ].join(" ")
  };
}

function hasUserDocumentContext(context = "") {
  return /\bUSER DOCUMENT:/i.test(String(context || ""));
}

function documentAnalysisRule(context = "", replyLang = "et") {
  if (!hasUserDocumentContext(context)) return null;

  return buildLocalizedExtraSystemInstruction("DOCUMENT_ANALYSIS_MODE", { replyLang });
}

/* ------------------------------------------------------------------ */
/* Responses API assembly                                              */
/* ------------------------------------------------------------------ */

export function toResponsesInput({
  history,
  userMessage,
  context,
  effectiveRole,
  grounding,
  replyLang,
  isCrisis = false,
  maxOutputTokens = OPENAI_MAX_OUTPUT_TOKENS,
  extraSystemInstructions = []
}) {
  const normalizedReplyLang = normalizeSystemPromptLang(replyLang || "et");
  const resolvedMaxOutputTokens = resolveMaxOutputTokens(effectiveRole, maxOutputTokens);

  const system = buildSystemPrompt({
    effectiveRole,
    isCrisis,
    replyLang: normalizedReplyLang
  });

  const materialMessage = buildMaterialMessage({ context });
  const groundingMessage = buildGroundingMessage({
    grounding,
    context,
    replyLang: normalizedReplyLang
  });
  const docAnalysis = documentAnalysisRule(context, normalizedReplyLang);

  const extraMessages = Array.isArray(extraSystemInstructions)
    ? extraSystemInstructions
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .map(content => ({ role: "system", content }))
    : [];

  return {
    model: DEFAULT_MODEL,
    input: [
      { role: "system", content: system },
      ...(docAnalysis ? [{ role: "system", content: docAnalysis }] : []),
      materialMessage,
      ...(groundingMessage ? [groundingMessage] : []),
      ...(Array.isArray(history) ? history : []),
      ...extraMessages,
      { role: "user", content: userMessage }
    ],
    max_output_tokens: resolvedMaxOutputTokens
  };
}

export function buildResponsesPayload(input, options = {}) {
  const responseInput = { ...(input || {}) };
  delete responseInput.preferredVerbosity;

  const verbosity = options.verbosity || "medium";

  return {
    ...responseInput,
    stream: options.stream ?? true,
    metadata: {
      source: "sotsiaalai-chat"
    },
    text: {
      verbosity
    },
    reasoning: {
      effort: "low"
    }
  };
}
