import { serverT } from "../i18n/serverMessages.js";

const CHAT_MODE_SELECTION_VALUES = Object.freeze([
  "document",
  "rag",
  "help_request",
  "help_offer"
]);

const CHAT_MODE_SELECTION_DISPLAY_ORDER = Object.freeze([
  "rag",
  "document",
  "help_request",
  "help_offer"
]);

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function getMessageText(entry) {
  return String(entry?.text || entry?.content || "").trim();
}

function isUserRole(role = "") {
  const normalized = String(role || "").toLowerCase();
  return normalized === "user" || normalized === "client";
}

function isAssistantRole(role = "") {
  return String(role || "").toLowerCase() === "ai" || String(role || "").toLowerCase() === "assistant";
}

function isAffirmative(text = "") {
  const normalized = normalizeText(text);
  return /^(jah|jaa|yes|y|da|ok|okay|okei|sobib|kinnitan|confirm)\b/.test(normalized);
}

function isNegative(text = "") {
  const normalized = normalizeText(text);
  return /^(ei|no|nope|net|vale|mitte see)\b/.test(normalized);
}

function isSubstantiveMessage(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length >= 2;
}

function wordCount(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function isShortWorkflowContinuationReply(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (wordCount(normalized) > 3) return false;
  if (isAffirmative(normalized) || isNegative(normalized)) return true;
  if (/^[1-3]\b/.test(normalized)) return true;
  if (/^(pdf|docx?|txt|rtf|odt|markdown|md)\b/.test(normalized)) return true;
  if (/^(sobib|jatka|jätka|palun|okei|ok)\b/.test(normalized)) return true;
  return false;
}

function isAssistantCapabilityQuestion(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const asksAssistant =
    /^(kas\s+)?(sa|sina|te|teie)\s+(saad|saaksid|saate|oskad|voiksid|v6iksid|aitad|aitaksid)\b/.test(normalized) ||
    /^kas\s+(saad|saaksid|saate|oskad|voiksid|v6iksid)\b/.test(normalized) ||
    /\b(kas\s+)?(sa|sina|te|teie)\b.{0,24}\b(saaksid|saad|saate|oskad|aitad|aitaksid|voiksid|v6iksid)\b/.test(normalized);
  const asksWork = /\b(teha|kirjutada|koostada|parandada|vormistada|genereerida|luua|valmis teha)\b/.test(normalized);
  const documentOrFormat = /\b(pdf|docx?|dokument|dokumendi|taotlus|avaldus|vorm|kiri|fail)\b/.test(normalized);
  return Boolean(asksAssistant && (asksWork || documentOrFormat));
}

function isSubstantiveWorkflowBypassQuestion(text = "") {
  const normalized = normalizeText(text);
  if (!normalized || isShortWorkflowContinuationReply(normalized)) return false;
  if (isAssistantCapabilityQuestion(normalized)) return false;
  if (wordCount(normalized) < 3) return false;
  const raw = String(text || "").trim();
  const questionLike = /\?$/.test(raw) ||
    /^(mis|mida|milline|millised|kuidas|kas|kus|kust|kuhu|kellele|miks|anna|selgita|raagi|kirjelda|vordle|analuusi)\b/.test(normalized);
  if (!questionLike) return false;
  const asksForSubstantiveWork =
    /(ulevaade|kokkuvote|selgit|kirjeld|analuus|vordl|pohimot|risk|mure|probleem|kitsaskoh|raskus|valjakutse|tingimus|taotlem|vorm|taotlus|kontakt|juhend|juhendmaterjal|metoodik|praktik|uuring|allikas|materjal|pdf|infoleht|teemaleht|kataloog|teema|teemad|pohjus|mida teha|kelle poole|kust leida|milline organisatsioon|millised organisatsioonid)/.test(normalized);
  const socialOrPublicServiceDomain =
    /(sotsiaal|hoolekan|hooldus|hooldaj|omastehool|abi|abivoimal|teenus|teenusepakkuj|tugiteenus|toetus|noustam|laps|lapse|laste|last|pere|eakas|puue|puudega|puuetega|erivajad|nagemispuue|kuulmispuue|liitpuue|pimekurt|viipekeel|ligipaasetav|tervis|kriis|abivajad|hindam|juhtumitoo|spetsialist|organisatsioon|uhendus|uhing|koda|liit|fond|tugiliit|vorgustik|tugivorgustik|partner|kontakt|infoleht|teemaleht|kataloog|materjal|pdf|vorm|taotlus|juhendmaterjal|\bkov\b|omavalitsus|vald|valla|linn|linna|seadus|oigus|oigusakt|maarus|paragrahv|riigi teataja|riigiteataja|\bshs\b|\bska\b|sotsiaalkindlustusamet|tootukassa|tookassa|toovoime|\bstar\b|infosusteem|tehisintellekt|\bai\b|algoritm|eetika|vaartus|otsustusvastutus|dokumenteer|toimetulek|raha|toit|elukoht|koduteenus|sotsiaaltransp)/.test(normalized);
  const serviceQuestion =
    /(teenus|toetus|vorm|taotlus|kontakt|tingimus|taotlem|pakutakse|olemas|koduteenus|sotsiaaltransp)/.test(normalized) &&
    /\b(kov|omavalitsus|vald|valla|linn|linna)\b/.test(normalized);
  return Boolean((questionLike && socialOrPublicServiceDomain) || (asksForSubstantiveWork && socialOrPublicServiceDomain) || serviceQuestion);
}

export function shouldBypassPendingWorkflowForSubstantiveQuestion(message = "") {
  return isSubstantiveWorkflowBypassQuestion(message);
}

function getModeSelectionText(replyLang = "et", key, fallback = "") {
  return serverT(replyLang, `chat.modeSelection.${key}`, null, fallback);
}

function normalizeFlowRole(role = "") {
  return String(role || "").trim().toUpperCase() === "CLIENT" ? "CLIENT" : "SOCIAL_WORKER";
}

function modeSelectionTextKey(mode = "rag", role = "SOCIAL_WORKER") {
  if (mode === "document" && normalizeFlowRole(role) === "CLIENT") return "documentClient";
  return mode;
}

function buildConfirmationLead(mode = "rag", replyLang = "et", role = "SOCIAL_WORKER") {
  return getModeSelectionText(replyLang, `confirm.${modeSelectionTextKey(mode, role)}`, "");
}

function buildAlternativeLead(replyLang = "et") {
  return getModeSelectionText(replyLang, "alternativesLead", "");
}

function buildReprompt(replyLang = "et") {
  return getModeSelectionText(replyLang, "reprompt", "");
}

function modeLabel(mode = "rag", replyLang = "et", role = "SOCIAL_WORKER") {
  return getModeSelectionText(replyLang, `options.${modeSelectionTextKey(mode, role)}`, mode);
}

function getAlternativeModes(suggestedMode = "rag") {
  return CHAT_MODE_SELECTION_DISPLAY_ORDER.filter((mode) => mode !== suggestedMode);
}

function buildNumberedAlternativeList(suggestedMode = "rag", replyLang = "et", role = "SOCIAL_WORKER") {
  return getAlternativeModes(suggestedMode).map((mode, index) => `${index + 1}. ${modeLabel(mode, replyLang, role)}`);
}

function parseSuggestedModeFromPrompt(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const locale of ["et", "en", "ru"]) {
    for (const mode of CHAT_MODE_SELECTION_VALUES) {
      for (const role of ["SOCIAL_WORKER", "CLIENT"]) {
        const lead = normalizeText(buildConfirmationLead(mode, locale, role));
        if (lead && normalized.includes(lead)) return mode;
      }
    }
  }

  return null;
}

function isModeSelectionPrompt(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  for (const locale of ["et", "en", "ru"]) {
    const alternativesLead = normalizeText(buildAlternativeLead(locale));
    const reprompt = normalizeText(buildReprompt(locale));
    if ((alternativesLead && normalized.includes(alternativesLead)) || (reprompt && normalized.includes(reprompt))) {
      return true;
    }
  }

  return parseSuggestedModeFromPrompt(text) != null;
}

function isModeSelectionReply(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return isAffirmative(normalized) || isNegative(normalized) || /^[1-3]\b/.test(normalized);
}

function inferSuggestedMode({ helpIntent = null, documentTaskIntent = false } = {}) {
  if (documentTaskIntent) return "document";
  if (helpIntent === "create_help_request") return "help_request";
  if (helpIntent === "create_help_offer") return "help_offer";
  return "rag";
}

export function buildModeSelectionPrompt({ replyLang = "et", suggestedMode = "rag", role = "SOCIAL_WORKER" } = {}) {
  return [
    buildConfirmationLead(suggestedMode, replyLang, role),
    "",
    buildAlternativeLead(replyLang),
    ...buildNumberedAlternativeList(suggestedMode, replyLang, role),
    "",
    buildReprompt(replyLang)
  ].join("\n");
}

function buildAlternativeOnlyPrompt({ replyLang = "et", suggestedMode = "rag", role = "SOCIAL_WORKER" } = {}) {
  return [
    buildConfirmationLead(suggestedMode, replyLang, role),
    "",
    buildAlternativeLead(replyLang),
    ...buildNumberedAlternativeList(suggestedMode, replyLang, role),
    "",
    buildReprompt(replyLang)
  ].join("\n");
}

function getPendingModeSelection(history = []) {
  if (!Array.isArray(history) || !history.length) return null;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (!isAssistantRole(entry?.role)) continue;
    const text = getMessageText(entry);
    if (!isModeSelectionPrompt(text)) continue;

    let chainStartIndex = i;
    for (let j = i - 1; j >= 0; j -= 1) {
      const previous = history[j];
      if (!isAssistantRole(previous?.role)) continue;
      if (!isModeSelectionPrompt(getMessageText(previous))) continue;
      chainStartIndex = j;
    }

    let sourceMessage = "";
    for (let j = chainStartIndex - 1; j >= 0; j -= 1) {
      const previous = history[j];
      if (!isUserRole(previous?.role)) continue;
      const candidate = getMessageText(previous);
      if (!candidate || isModeSelectionReply(candidate)) continue;
      sourceMessage = candidate;
      break;
    }

    return {
      promptText: text,
      suggestedMode: parseSuggestedModeFromPrompt(text) || "rag",
      sourceMessage
    };
  }

  return null;
}

function parseModeChoice(message = "", suggestedMode = "rag", role = "SOCIAL_WORKER") {
  const normalized = normalizeText(message);
  if (!normalized) return null;
  if (isAffirmative(normalized)) return suggestedMode;

  const alternatives = getAlternativeModes(suggestedMode);
  const numericMatch = normalized.match(/^([1-3])\b/);
  if (numericMatch) {
    const index = Number(numericMatch[1]) - 1;
    return alternatives[index] || null;
  }

  if (/^(info|juhendamine|selgitus|noustamine|nõustamine|information|guidance|advice|informatsiya|rekomendats)/.test(normalized)) {
    return "rag";
  }
  if (normalizeFlowRole(role) === "CLIENT") {
    if (/^(dokument|dokumendi|taotlus|kiri|avaldus|vastus|vorm|document|draft|letter|request|application|form)/.test(normalized)) {
      return "document";
    }
  } else if (/^(dokument|dokumendi|aruanne|aruande|raport|taotlus|kiri|document|draft|report|dokument|otchyot)/.test(normalized)) {
    return "document";
  }
  if (/^(abisoov|abipalve|help request|request|zapros)/.test(normalized)) {
    return "help_request";
  }
  if (/^(abipakkumine|help offer|offer|pakkumine|predlozhenie)/.test(normalized)) {
    return "help_offer";
  }

  return null;
}

export function resolveModeSelection(input = {}) {
  const message = String(input?.message || "").trim();
  const history = Array.isArray(input?.history) ? input.history : [];
  const replyLang = String(input?.replyLang || "et").trim() || "et";
  const role = normalizeFlowRole(input?.role || "SOCIAL_WORKER");
  const suggestedMode = inferSuggestedMode({
    helpIntent: input?.helpIntent || null,
    documentTaskIntent: input?.documentTaskIntent === true
  });
  const pending = getPendingModeSelection(history);

  if (pending) {
    if (shouldBypassPendingWorkflowForSubstantiveQuestion(message)) {
      return {
        handled: false,
        pending,
        suggestedMode: pending.suggestedMode,
        resolvedMode: null,
        routedMessage: message,
        pending_workflow_bypassed: true,
        pendingWorkflowBypassed: true,
        pending_workflow_bypass_reason: "substantive_question",
        pendingWorkflowBypassReason: "substantive_question",
        routed_to_chat_rag_due_to_substantive_question: true,
        routedToChatRagDueToSubstantiveQuestion: true
      };
    }

    if (isNegative(message)) {
      return {
        handled: true,
        pending,
        suggestedMode: pending.suggestedMode,
        resolvedMode: null,
        routedMessage: pending.sourceMessage || "",
        reply: buildAlternativeOnlyPrompt({
          replyLang,
          suggestedMode: pending.suggestedMode,
          role
        })
      };
    }

    const resolvedMode = parseModeChoice(message, pending.suggestedMode, role);
    if (resolvedMode) {
      return {
        handled: false,
        pending,
        suggestedMode: pending.suggestedMode,
        resolvedMode,
        routedMessage: pending.sourceMessage || message
      };
    }

    return {
      handled: true,
      pending,
      suggestedMode: pending.suggestedMode,
      resolvedMode: null,
      routedMessage: pending.sourceMessage || "",
      reply: buildModeSelectionPrompt({
        replyLang,
        suggestedMode: pending.suggestedMode,
        role
      })
    };
  }

  if (input?.skipSelection === true || !isSubstantiveMessage(message)) {
    return {
      handled: false,
      pending,
      suggestedMode,
      resolvedMode: null,
      routedMessage: message
    };
  }

  return {
    handled: true,
    pending: null,
    suggestedMode,
    resolvedMode: null,
    routedMessage: message,
    reply: buildModeSelectionPrompt({
      replyLang,
      suggestedMode,
      role
    })
  };
}
