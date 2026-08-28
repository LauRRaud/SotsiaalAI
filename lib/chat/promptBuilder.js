import {
  CHAT_PROMPT_TOKEN_AUDIT,
  DEFAULT_MODEL,
  OPENAI_REASONING_EFFORT,
  OPENAI_TEXT_VERBOSITY
} from "./settings.js";

// Prompt-komponendid tokeniauditile. WeakMap, et payload jääks puutumata ja
// kirjed vabaneksid koos päringuga.
const PROMPT_COMPONENTS = new WeakMap();
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
  // B0: otsingu ebaõnnestumine EI ole sama, mis „allikaid ei leitud".
  const retrievalFailedKey = isWorker
    ? "chat.fallback.retrieval_failed_worker"
    : "chat.fallback.retrieval_failed_client";

  if (lang === "ru") {
    return {
      greetingClient: "Здравствуйте! Чем могу помочь?",
      greetingWorker: "Здравствуйте! С какой темой могу помочь?",
      voiceGreetingClient: "Здравствуйте! Да, ваша речь дошла до меня. Чем могу помочь?",
      voiceGreetingWorker: "Здравствуйте! Да, ваша речь дошла до меня. С какой темой могу помочь?",
      noContext: serverT(
        lang,
        noContextKey,
        undefined,
        isWorker
          ? "Можете уточнить, какую тему, целевую группу, период или документ вы имеете в виду?"
          : "Можете уточнить, какую ситуацию, тему или период вы имеете в виду?"
      ),
      crisisNoCtx: serverT(
        lang,
        "chat.fallback.crisis_no_context",
        undefined,
        "Если вы находитесь в непосредственной опасности или думаете о причинении вреда себе, немедленно звоните 112. Если вопрос касается детей или семьи: детская помощь 116 111 (круглосуточно, бесплатно). Для пострадавших от насилия или преступления: помощь жертвам 116 006. Если можете, укажите волость или город — я найду ближайшие контакты помощи."
      ),
      retrievalFailed: serverT(
        lang,
        retrievalFailedKey,
        undefined,
        "В этот раз мне не удалось закончить обработку вашего вопроса. Можете отправить тот же вопрос ещё раз?"
      ),
      crisis: "Если есть непосредственная опасность — звони 112."
    };
  }

  if (lang === "en") {
    return {
      greetingClient: "Hello! How can I help?",
      greetingWorker: "Hello! What topic can I help with?",
      voiceGreetingClient: "Hello! Yes, your speech reached me. How can I help?",
      voiceGreetingWorker: "Hello! Yes, your speech reached me. What topic can I help with?",
      noContext: serverT(
        lang,
        noContextKey,
        undefined,
        isWorker
          ? "Could you clarify which topic, target group, time period, or document you mean?"
          : "Could you clarify which situation, topic, or time period you mean?"
      ),
      crisisNoCtx: serverT(
        lang,
        "chat.fallback.crisis_no_context",
        undefined,
        "If you are in immediate danger or thinking about harming yourself, call 112 now. For concerns involving children or families, call the Child Helpline at 116 111 (free, 24/7). Victims of violence or crime can call Victim Support at 116 006. If you can, tell me your municipality or city — I will look for the nearest support contacts."
      ),
      retrievalFailed: serverT(
        lang,
        retrievalFailedKey,
        undefined,
        "I could not finish processing your question this time. Could you send the same question once more?"
      ),
      crisis: "If there is immediate danger, call 112."
    };
  }

  return {
    greetingClient: "Tere! Mis küsimusega saan aidata?",
    greetingWorker: "Tere! Mis teemaga saan aidata?",
    voiceGreetingClient: "Tere! Jah, sinu kõne jõudis minuni. Mis küsimusega saan aidata?",
    voiceGreetingWorker: "Tere! Jah, sinu kõne jõudis minuni. Mis teemaga saan aidata?",
    noContext: serverT(
      lang,
      noContextKey,
      undefined,
      isWorker
        ? "Kas saad täpsustada, millist teemat, sihtrühma, ajavahemikku või dokumenti sa mõtled?"
        : "Kas saad täpsustada, millist olukorda, teemat või ajavahemikku sa mõtled?"
    ),
    crisisNoCtx: serverT(
      lang,
      "chat.fallback.crisis_no_context",
      undefined,
      "Kui sa oled otseses ohus või mõtled enesevigastamisele, helista kohe 112. Lapsi ja peresid puudutav mure: lasteabi 116 111 (ööpäevaringne, tasuta). Vägivalla või kuriteo ohvrile: ohvriabi 116 006. Kui saad, ütle mulle oma vald või linn — otsin sulle lähima abi kontaktid."
    ),
    retrievalFailed: serverT(
      lang,
      retrievalFailedKey,
      undefined,
      "Mul ei õnnestunud su küsimust seekord lõpuni töödelda. Kas saad sama küsimuse veel korra saata?"
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
      ? `Kinnitatud allikakatkendid\n${context}`
      : "Kinnitatud allikakatkendeid ei ole. Kui fakt puudub, ütle ainult konkreetselt, milline detail jäi kinnitamata."
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
  // Vaikeväärtust siia ei panda: siis jõuab resolveMaxOutputTokens rollipõhise
  // laeni. Globaalne OPENAI_MAX_OUTPUT_TOKENS kehtib teistele moodulitele.
  maxOutputTokens,
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

  const built = {
    model: DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: system,
          prompt_cache_breakpoint: { mode: "explicit" }
        }]
      },
      ...(docAnalysis ? [{ role: "system", content: docAnalysis }] : []),
      materialMessage,
      ...(groundingMessage ? [groundingMessage] : []),
      ...(Array.isArray(history) ? history : []),
      ...extraMessages,
      { role: "user", content: userMessage }
    ],
    max_output_tokens: resolvedMaxOutputTokens
  };

  // Komponentide kirje tokeniauditile. Kogutakse AINULT siis, kui lipp on sees —
  // väljas olles ei tehta siin midagi. Kirje elab WeakMapis, mitte payloadis,
  // et mudelile saadetav objekt jääks muutumatuks.
  if (CHAT_PROMPT_TOKEN_AUDIT) {
    PROMPT_COMPONENTS.set(built, {
      system,
      user: userMessage,
      history: Array.isArray(history) ? history : [],
      sourcePackage: materialMessage,
      tools: null,
      otherDynamic: [docAnalysis, groundingMessage, ...extraMessages].filter(Boolean)
    });
  }

  return built;
}

export function getPromptComponents(input) {
  return PROMPT_COMPONENTS.get(input) || null;
}

export function buildResponsesPayload(input, options = {}) {
  const responseInput = { ...(input || {}) };
  delete responseInput.preferredVerbosity;

  const verbosity = options.verbosity || OPENAI_TEXT_VERBOSITY;
  const effort = options.effort || OPENAI_REASONING_EFFORT;
  const promptCacheKey = String(options.promptCacheKey || "").trim().slice(0, 64);

  return {
    ...responseInput,
    stream: options.stream ?? true,
    ...(promptCacheKey
      ? {
          prompt_cache_key: promptCacheKey,
          prompt_cache_options: {
            mode: "explicit",
            ttl: "30m"
          }
        }
      : {}),
    metadata: {
      source: "sotsiaalai-chat"
    },
    text: {
      verbosity
    },
    reasoning: {
      effort
    }
  };
}
