import { hasValidatedPublication } from "./responsePolicy.js";
import { normalizeSourceSelection, resolveSourceSelection } from "./sourceSelection.js";

const RECOVERY_VERSION = "conversational_recovery_v1";
const OUT_OF_SOCIAL_SCOPE_MARKER = "SOTSIAALAI_OUT_OF_SOCIAL_SCOPE";
const NO_USEFUL_CLARIFICATION_MARKER = "SOTSIAALAI_NO_USEFUL_CLARIFICATION";

const DOCUMENT_REASONS = new Set([
  "document_identity_unconfirmed",
  "identified_document_missing_from_rendered_sources",
  "author_corpus_count_unconfirmed",
  "author_corpus_sources_missing",
  "author_corpus_count_not_answered",
  "author_corpus_count_mismatch",
  "unsupported_author_corpus_numeric_claim",
  "unsupported_author_work_year"
]);

const TEMPORAL_REASONS = new Set([
  "missing_requested_year",
  "source_year_not_body_year"
]);

const CONTACT_REASONS = new Set([
  "contact_inventory_unavailable",
  "contact_inventory_sources_missing",
  "contact_municipality_clarification_mismatch",
  "contact_check_cadence_source_missing",
  "unsupported_contact_check_cadence",
  "contact_check_cadence_missing",
  "unsupported_contact_phone",
  "unsupported_contact_phone_relation",
  "unsupported_contact_email",
  "unsupported_contact_email_relation",
  "unsupported_contact_checked_date",
  "unsupported_contact_inventory_claim",
  "contact_inventory_total_missing",
  "contact_inventory_role_count_missing",
  "contact_inventory_names_incomplete",
  "unexpected_contact_items",
  "unsupported_contact_role_relation",
  "contact_role_not_answered",
  "contact_phone_not_answered",
  "contact_email_not_answered",
  "contact_details_not_answered",
  "contact_presence_mismatch",
  "contact_evidence_not_answered",
  "contact_name_not_answered",
  "contact_phone_list_incomplete",
  "contact_email_list_incomplete"
]);

const METRIC_REASONS = new Set([
  "no_numeric_claim",
  "unsupported_numeric_claim",
  "numeric_relation_mismatch",
  "numeric_category_value_mismatch",
  "unsupported_numeric_category_relation",
  "whole_scope_mismatch"
]);

const RECOVERY_TARGETS = new Set([
  "source_selection",
  "document_anchor",
  "year_scope",
  "temporal_breakdown",
  "contact_scope",
  "municipality_scope",
  "metric_scope",
  "topic_scope",
  "answer_scope"
]);

const CLARIFICATION_FRAME_WORDS = {
  et: new Set([
    "aga", "ajavahemik", "ajavahemiku", "all", "andmed", "andmete", "artikkel", "artikli",
    "autor", "autori", "dokumendi", "dokument", "eraldi", "esmalt", "et", "ilmumisaasta",
    "ja", "järgi", "kas", "keda", "kelle", "keskenduma", "keskendun", "kes", "kindla",
    "kirjeldatud", "kohta", "koht", "kogu", "kontakti", "kontakt", "kuidas", "kuhu", "kui",
    "kumba", "kus", "kust", "linna", "millal", "milline", "millise", "millised", "millist",
    "milliseid", "mis", "mida", "miks", "millisele", "millises", "mõelda", "mõtled", "mõtlesid", "mõtlesite", "mõeldud",
    "näitaja", "näitajale", "ning", "oli", "oleks", "omavalitsus", "omavalitsust", "on", "osa",
    "palun", "pead", "peaksin", "pealkiri", "pealkirja", "periood", "perioodi", "pidasid", "pidasite", "rolli", "roll",
    "rühmale", "rühm", "sa", "saad", "silmas", "soovid", "sihtrühm", "teenuse", "teenus", "teema",
    "täpsustada", "täpsemalt", "täpsele", "uuringu", "uuring", "vahel", "või", "vald", "aasta",
    "aastad", "aastaid", "aastate", "öelda", "õigesti", "aru", "saada"
  ]),
  en: new Set([
    "a", "about", "and", "article", "author", "by", "can", "clarify", "contact", "could", "data",
    "did", "document", "do", "does", "exact", "first", "focus", "for", "group", "how", "is", "it",
    "mean", "measure", "metric", "municipality", "of", "on", "or", "overall", "period", "place", "please",
    "publication", "report", "role", "service", "should", "specific", "study", "the", "time", "title", "to",
    "topic", "trend", "was", "were", "what", "when", "where", "which", "who", "why", "would", "year", "years",
    "you", "your"
  ]),
  ru: new Set([
    "автор", "в", "вы", "год", "года", "данных", "документ", "или", "имели", "имеете", "исследования", "как",
    "какая", "какие", "какой", "какое", "контакт", "куда", "место", "название", "на", "о", "общем",
    "период", "показатель", "публикации", "под", "пожалуйста", "правильно", "ли", "я", "понял", "поняла", "виду", "роль", "самоуправление", "сначала",
    "сосредоточиться", "статья", "тема", "точный", "уточните", "услуга", "что", "чтобы", "где", "когда",
    "кого", "почему", "сколько", "отчёт", "отчет", "по", "одному", "каждый", "тренде", "между"
  ])
};

function normalizedLanguage(replyLang = "et") {
  return replyLang === "en" || replyLang === "ru" ? replyLang : "et";
}

function boundedStringList(value, limit = 8) {
  return Array.isArray(value)
    ? value.map(item => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function boundedMunicipalityCandidates(value) {
  return Array.from(new Set(boundedStringList(value, 4)
    .filter(item => item.length <= 80 && lexicalTokens(item).length >= 2 && !numericTokens(item).length)));
}

function boundedYears(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= 1900 && item <= 2100)))
    .slice(0, 8);
}

function boundedMessageId(value = "") {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,80}$/u.test(text) ? text : "";
}

function numericTokens(value = "") {
  return String(value || "").match(/\d+(?:[.,]\d+)?/gu) || [];
}

function lexicalTokens(value = "") {
  return String(value || "").match(/\p{Letter}+(?:['’-]\p{Letter}+)*/gu) || [];
}

function normalizeLexicalToken(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase();
}

function clarificationComparableText(value = "") {
  return [
    ...lexicalTokens(value).map(normalizeLexicalToken),
    ...numericTokens(value)
  ].join(" ");
}

function boundedEditDistance(left = "", right = "", maximum = 2) {
  const a = normalizeLexicalToken(left);
  const b = normalizeLexicalToken(right);
  if (!a || !b || Math.abs(a.length - b.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    let rowMinimum = current[0];
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1);
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        substitution
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }
  return previous[b.length];
}

function questionPrefixAllowed(value, replyLang) {
  const text = String(value || "").replace(/^[\s"'“”‘’(]+/u, "");
  const firstToken = normalizeLexicalToken(lexicalTokens(text)[0] || "");
  const allowedTokens = replyLang === "en"
    ? ["do", "does", "did", "is", "are", "was", "were", "can", "could", "would", "should", "which", "what", "who", "whom", "whose", "where", "when", "how", "why", "please", "to"]
    : replyLang === "ru"
      ? ["вы", "ты", "правильно", "имеете", "можете", "уточните", "что", "какой", "какая", "какое", "какие", "кого", "чей", "где", "куда", "откуда", "когда", "как", "почему", "сколько", "чтобы"]
      : ["kas", "mis", "mida", "milline", "millist", "millise", "millised", "milliseid", "kes", "keda", "kelle", "kus", "kuhu", "kust", "millal", "kuidas", "miks", "kui", "kumba", "palun", "et"];
  return new Set(allowedTokens.map(normalizeLexicalToken)).has(firstToken);
}

function hasClarificationQuestionShape(reply = "", replyLang = "et") {
  const text = String(reply || "").replace(/\s+/gu, " ").trim();
  if (!text || text.length > 420 || /[\r\n]/u.test(String(reply || ""))) return false;
  if ((text.match(/\?/gu) || []).length !== 1 || !/\?[)\]"'“”‘’]*$/u.test(text)) return false;
  if (!questionPrefixAllowed(text, normalizedLanguage(replyLang))) return false;
  const body = text.replace(/\?[)\]"'“”‘’]*$/u, "").replace(/\b\d+\./gu, "");
  return !/[!?]/u.test(body) && !/\.(?:\s|$)/u.test(body);
}

export function analyzeClarificationReply(reply = "", {
  userMessage = "",
  replyLang = "et"
} = {}) {
  const language = normalizedLanguage(replyLang);
  const text = String(reply || "").replace(/\s+/gu, " ").trim();
  const rejected = { safe: false, correctionHints: [] };
  if (!hasClarificationQuestionShape(reply, language)) return rejected;
  if (
    clarificationComparableText(text) &&
    clarificationComparableText(text) === clarificationComparableText(userMessage)
  ) return rejected;
  if (/(?:https?:\/\/|www\.|(?<![\p{Letter}\p{Number}_])[\w.+-]+@[\w.-]+\.[a-z]{2,}(?![\p{Letter}\p{Number}_]))/iu.test(text)) return rejected;
  if (/(?<![\p{Letter}\p{Number}_])(?:pin(?:-?kood)?|parool|salasõna|isikukood|autentimis(?:kood)?|autentimise\s+kood|kinnituskood|turvakood|kaardinumber|cvv|cvc|password|passcode|personal\s+id|social\s+security|authentication\s+code|verification\s+code|bank\s+card|card\s+number|пароль|пин(?:-?код)?|код\s+подтверждения|личный\s+код|номер\s+карты)(?![\p{Letter}\p{Number}_])/iu.test(text)) return rejected;
  if (/(?<![\p{Letter}\p{Number}_])(?:rag|retrieval|embedding|validator|andmebaas|allika\p{Letter}*|otsing\p{Letter}*|korpus|materjal\p{Letter}*|süsteem\p{Letter}*|database|sources?|search|materials?|system|retrieved context|база данных|корпус|поиск|источник\p{Letter}*|материал\p{Letter}*|систем\p{Letter}*)(?![\p{Letter}\p{Number}_])/iu.test(text)) return rejected;
  if (/(?:ma ei leidnud|ei saa kinnitada|could not find|couldn't find|cannot confirm|не наш[её]л|не могу подтвердить)/iu.test(text)) return rejected;

  const allowedNumbers = new Set(numericTokens(userMessage));
  if (!numericTokens(text).every(number => allowedNumbers.has(number))) return rejected;

  const userTokens = lexicalTokens(userMessage);
  const normalizedUserTokens = new Set(userTokens.map(normalizeLexicalToken));
  const frameWords = new Set(Array.from(CLARIFICATION_FRAME_WORDS[language], normalizeLexicalToken));
  const correctionHints = [];
  for (const token of lexicalTokens(text)) {
    const normalized = normalizeLexicalToken(token);
    if (!normalized || normalizedUserTokens.has(normalized) || frameWords.has(normalized)) continue;
    const maxDistance = normalized.length >= 8 ? 2 : normalized.length >= 4 ? 1 : 0;
    const closeToUserToken = maxDistance > 0 && userTokens.some((userToken) => {
      const normalizedUser = normalizeLexicalToken(userToken);
      return normalizedUser.length >= 4 && boundedEditDistance(normalized, normalizedUser, maxDistance) <= maxDistance;
    });
    if (!closeToUserToken || correctionHints.length >= 2) return rejected;
    if (!correctionHints.some(item => normalizeLexicalToken(item) === normalized)) {
      correctionHints.push(String(token).slice(0, 80));
    }
  }
  return { safe: true, correctionHints };
}

export function isSafeClarificationReply(reply = "", options = {}) {
  return analyzeClarificationReply(reply, options).safe;
}

function missingTargetForReason(reason = "", validationTrace = null) {
  if (DOCUMENT_REASONS.has(reason)) return "document_anchor";
  if (TEMPORAL_REASONS.has(reason)) return "year_scope";
  if (reason === "cross_source_numeric_mix") {
    return String(validationTrace?.temporal_claim_binding_reason || "").trim()
      ? "temporal_breakdown"
      : "metric_scope";
  }
  if (CONTACT_REASONS.has(reason)) return "contact_scope";
  if (METRIC_REASONS.has(reason)) return "metric_scope";
  if (reason === "no_rendered_evidence") return "topic_scope";
  return "answer_scope";
}

function recoveryPromptText(replyLang, phase) {
  const language = normalizedLanguage(replyLang);
  if (language === "en") {
    return phase === "no_context"
      ? `CONVERSATIONAL_RECOVERY: There are no confirmed source excerpts for a factual answer. Do not answer from general model knowledge and do not classify the user's message as outside the social sector; that decision has already been made before this call. If an ambiguity, obvious typo, or missing user-provided detail can materially help the next turn reach an answer, ask exactly one short, natural clarification question. If the message is already clear enough and no user clarification can create the missing evidence, output exactly ${NO_USEFUL_CLARIFICATION_MARKER} and nothing else. Do not mention search, RAG, a database, sources, the system, or a validator. Do not add any new fact, name, number, contact detail, or link that the user did not provide. Output only the marker or one question.`
      : "CONVERSATIONAL_RECOVERY: Use only the confirmed source excerpts for factual claims. Never fill a missing fact from external or general model knowledge. If the excerpts support a useful part of the answer, give that part immediately and state briefly what remains unproven; do not ask the user to choose a scope when that choice cannot create new evidence. Ask exactly one short, natural clarification question only when no useful factual part is supported and the user's answer can materially resolve what to answer. Do not suggest possible meanings or choices that the user did not provide; ask neutrally for the missing detail. Do not describe the technical system or add new facts, names, numbers, contact details, or links.";
  }
  if (language === "ru") {
    return phase === "no_context"
      ? `CONVERSATIONAL_RECOVERY: Подтверждённых фрагментов источников для фактического ответа нет. Не отвечай, опираясь на общие знания модели, и не объявляй сообщение пользователя выходящим за рамки социальной сферы: это решение уже принято до данного вызова. Если неоднозначность, очевидная опечатка или недостающая деталь от пользователя действительно поможет в следующем сообщении прийти к ответу, задай ровно один короткий естественный уточняющий вопрос. Если сообщение уже достаточно ясно и уточнение пользователя не может создать недостающее подтверждение, выведи только ${NO_USEFUL_CLARIFICATION_MARKER}. Не упоминай поиск, RAG, базу данных, источники, систему или валидатор. Не добавляй новых фактов, имён, чисел, контактов или ссылок. Выведи только маркер или один вопрос.`
      : "CONVERSATIONAL_RECOVERY: Для фактических утверждений используй только подтверждённые фрагменты источников. Никогда не заполняй пробелы внешними или общими знаниями модели. Если фрагменты подтверждают полезную часть ответа, сразу дай её и кратко укажи, что осталось недоказанным; не проси пользователя выбирать объём ответа, если такой выбор не создаст новых доказательств. Задай ровно один короткий естественный уточняющий вопрос только тогда, когда нельзя подтвердить никакую полезную фактическую часть и ответ пользователя действительно поможет определить ответ. Не предлагай возможные значения или варианты, которых пользователь не называл; нейтрально спроси только недостающую деталь. Не описывай техническую систему и не добавляй новых фактов, имён, чисел, контактов или ссылок.";
  }
  return phase === "no_context"
    ? `CONVERSATIONAL_RECOVERY: Kinnitatud allikakatkendeid faktivastuseks ei ole. Ära vasta mudeli üldteadmiste põhjal ega kuuluta kasutaja sõnumit sotsiaalvaldkonnast välja jäävaks; see otsus on enne seda kõnet juba tehtud. Kui ebaselgus, ilmne kirjaviga või kasutajalt puuduv detail saab järgmise pöördega päriselt vastuseni aidata, esita täpselt üks lühike loomulik täpsustusküsimus. Kui sõnum on juba piisavalt selge ja kasutaja täpsustus ei saa puuduvat tõendit luua, väljasta täpselt ${NO_USEFUL_CLARIFICATION_MARKER}. Ära maini otsingut, RAG-i, andmebaasi, allikaid, süsteemi ega validatorit. Ära lisa ühtegi uut fakti, nime, numbrit, kontakti ega linki, mida kasutaja ei andnud. Väljasta ainult marker või üks küsimus.`
    : "CONVERSATIONAL_RECOVERY: Kasuta faktiväideteks ainult kinnitatud allikakatkendeid. Ära täida puuduvat fakti väliste ega mudeli üldteadmistega. Kui katkendid toetavad vastuse kasulikku osa, anna see kohe ja ütle lühidalt, mis jäi tõendamata; ära palu kasutajal valida vastuse ulatust, kui see valik uut tõendit ei loo. Esita täpselt üks lühike loomulik täpsustusküsimus ainult siis, kui ühtegi kasulikku faktiosa ei saa kinnitada ja kasutaja vastus saab sisuliselt määrata, millele vastata. Ära paku võimalikke tähendusi ega valikuid, mida kasutaja ise ei nimetanud; küsi neutraalselt ainult puuduvat detaili. Ära kirjelda tehnilist süsteemi ega lisa uusi fakte, nimesid, numbreid, kontakte või linke.";
}

export function withConversationalRecoveryInstruction(extraSystemInstructions = [], {
  replyLang = "et",
  phase = "answer_or_clarify"
} = {}) {
  const existing = Array.isArray(extraSystemInstructions)
    ? extraSystemInstructions.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  return [...existing, recoveryPromptText(replyLang, phase)];
}

function localizedClarification({ replyLang, target, years = [], aggregatePeriodAvailable = false }) {
  const language = normalizedLanguage(replyLang);
  const yearText = years.join(", ");
  if (language === "en") {
    if (target === "document_anchor") return "Could you add the author, publication year, or a distinctive part of the document title?";
    if (target === "year_scope") {
      return yearText
        ? `Should I handle ${yearText} one year at a time, or focus only on the overall period trend?`
        : "Do you mean the document's publication year or the year of the study or data?";
    }
    if (target === "temporal_breakdown") return aggregatePeriodAvailable
      ? "Would it help if I give the supported whole-period figures and leave the unproven year-by-year trend out?"
      : "Which single year or measure should I focus on first?";
    if (target === "contact_scope") return "Which municipality and which role or service contact do you mean?";
    if (target === "metric_scope") return "Which exact measure, group, and time period should I focus on first?";
    if (target === "topic_scope") return "Could you narrow the question by topic, time period, or a specific document?";
    return "Could you clarify the topic, time period, place, or document you mean?";
  }
  if (language === "ru") {
    if (target === "document_anchor") return "Можете добавить автора, год публикации или отличительную часть названия документа?";
    if (target === "year_scope") {
      return yearText
        ? `Рассмотреть ${yearText} по одному году или сосредоточиться только на общем тренде периода?`
        : "Вы имеете в виду год публикации документа или год исследования либо данных?";
    }
    if (target === "temporal_breakdown") return aggregatePeriodAvailable
      ? "Привести подтверждённые показатели за весь период, не включая недоказанный тренд по отдельным годам?"
      : "На каком одном годе или показателе сначала сосредоточиться?";
    if (target === "contact_scope") return "Какое самоуправление и какой контакт по роли или услуге вы имеете в виду?";
    if (target === "metric_scope") return "На каком точном показателе, группе и периоде мне сначала сосредоточиться?";
    if (target === "topic_scope") return "Можете сузить вопрос по теме, периоду или конкретному документу?";
    return "Можете уточнить тему, период, место или документ, который вы имеете в виду?";
  }
  if (target === "document_anchor") return "Kas saad lisada autori, ilmumisaasta või dokumendi pealkirja eristuva osa?";
  if (target === "year_scope") {
    return yearText
      ? `Kas käsitlen aastaid ${yearText} ükshaaval või keskendun ainult kogu perioodi trendile?`
      : "Kas mõtled dokumendi ilmumisaastat või uuringu või andmete aastat?";
  }
  if (target === "temporal_breakdown") return aggregatePeriodAvailable
    ? "Kas sobib, kui toon välja tõendatud kogu perioodi koondnäitajad ja jätan tõendamata aastatrendi kõrvale?"
    : "Millisele ühele aastale või näitajale peaksin esmalt keskenduma?";
  if (target === "contact_scope") return "Millist omavalitsust ning millise rolli või teenuse kontakti sa mõtled?";
  if (target === "metric_scope") return "Millisele täpsele näitajale, rühmale ja ajavahemikule peaksin esmalt keskenduma?";
  if (target === "topic_scope") return "Kas saad küsimust täpsustada teema, ajavahemiku või kindla dokumendi järgi?";
  return "Kas saad täpsustada, millist teemat, ajavahemikku, kohta või dokumenti sa mõtled?";
}

export function buildNoContextRecoveryFallback(replyLang = "et", target = "answer_scope") {
  return localizedClarification({
    replyLang,
    target: RECOVERY_TARGETS.has(target) ? target : "answer_scope"
  });
}

function localizedSocialScopeBoundary(replyLang = "et") {
  const language = normalizedLanguage(replyLang);
  if (language === "en") return "I answer only social-sector questions.";
  if (language === "ru") return "Я отвечаю только на вопросы социальной сферы.";
  return "Vastan ainult sotsiaalvaldkonna küsimustele.";
}

function localizedEvidenceLimit(replyLang = "et") {
  const language = normalizedLanguage(replyLang);
  if (language === "en") return "I can’t give a sufficiently reliable answer to that right now.";
  if (language === "ru") return "Сейчас я не могу дать на это достаточно надёжный ответ.";
  return "Ma ei saa sellele praegu piisavalt kindlat vastust anda.";
}

function inactiveRecovery({
  action,
  trigger,
  reason,
  replySource,
  modelCallCount = 0,
  guard
}) {
  return {
    version: RECOVERY_VERSION,
    active: false,
    action,
    trigger,
    reason,
    target: "none",
    missing_fields: [],
    reply_source: replySource,
    question_asked: false,
    model_call_count: Math.max(0, Number(modelCallCount) || 0),
    additional_model_call_count: 0,
    external_knowledge_allowed: false,
    technical_status_allowed: false,
    clarification_guard: guard,
    correction_hints: []
  };
}

export function resolveSocialScopeBoundary(candidateReply = "", {
  replyLang = "et",
  trigger = "answer_model_scope",
  modelCallCount = 1
} = {}) {
  const candidate = String(candidateReply || "").replace(/\s+/gu, " ").trim();
  const localizedReply = localizedSocialScopeBoundary(replyLang);
  if (candidate !== OUT_OF_SOCIAL_SCOPE_MARKER && candidate !== localizedReply) return null;
  return {
    reply: localizedReply,
    recovery: inactiveRecovery({
      action: "domain_boundary",
      trigger,
      reason: "outside_social_scope",
      replySource: candidate === OUT_OF_SOCIAL_SCOPE_MARKER
        ? "model_classification_deterministic_reply"
        : "validated_model_scope_reply",
      modelCallCount,
      guard: candidate === OUT_OF_SOCIAL_SCOPE_MARKER
        ? "exact_out_of_scope_marker"
        : "exact_localized_scope_boundary"
    })
  };
}

export function buildDeterministicSocialScopeBoundary({
  replyLang = "et",
  scopeReason = "no_deterministic_social_signal"
} = {}) {
  const boundary = resolveSocialScopeBoundary(OUT_OF_SOCIAL_SCOPE_MARKER, {
    replyLang,
    trigger: "question_plan_scope",
    modelCallCount: 0
  });
  return {
    ...boundary,
    recovery: {
      ...boundary.recovery,
      reply_source: "deterministic_question_plan",
      clarification_guard: String(scopeReason || "no_deterministic_social_signal").slice(0, 80)
    }
  };
}

export function buildDeterministicMunicipalityClarification({
  candidates = [],
  replyLang = "et",
  rootUserMessageId = null
} = {}) {
  const names = boundedMunicipalityCandidates(candidates);
  if (names.length < 2) return null;
  const language = normalizedLanguage(replyLang);
  const joined = names.length === 2
    ? language === "en"
      ? `${names[0]} or ${names[1]}`
      : language === "ru"
        ? `${names[0]} или ${names[1]}`
        : `${names[0]} või ${names[1]}`
    : names.join(", ");
  const reply = language === "en"
    ? `Do you mean ${joined}?`
    : language === "ru"
      ? `Вы имеете в виду ${joined}?`
      : `Kas mõtled ${joined}?`;
  return {
    reply,
    recovery: {
      version: RECOVERY_VERSION,
      active: true,
      action: "ask_clarification",
      trigger: "question_plan_municipality_ambiguity",
      reason: "municipality_ambiguous",
      target: "municipality_scope",
      missing_fields: ["municipality_scope"],
      reply_source: "deterministic_question_plan",
      question_asked: true,
      model_call_count: 0,
      additional_model_call_count: 0,
      external_knowledge_allowed: false,
      technical_status_allowed: false,
      clarification_guard: "resolved_municipality_candidates_only",
      correction_hints: [],
      municipality_candidates: names,
      ...(boundedMessageId(rootUserMessageId)
        ? { root_user_message_id: boundedMessageId(rootUserMessageId) }
        : {})
    }
  };
}

function quotedUserTerm(candidateReply = "", userMessage = "") {
  const normalizedUserTokens = new Set(lexicalTokens(userMessage).map(normalizeLexicalToken));
  for (const match of String(candidateReply || "").matchAll(/[„“"«]([^“”"»]{1,80})[“”"»]/gu)) {
    const tokens = lexicalTokens(match[1]);
    if (tokens.length !== 1) continue;
    const token = String(tokens[0] || "").slice(0, 80);
    if (normalizedUserTokens.has(normalizeLexicalToken(token))) return token;
  }
  return "";
}

function localizedAmbiguousTermQuestion(term = "", replyLang = "et") {
  const language = normalizedLanguage(replyLang);
  if (language === "en") return `What do you mean by “${term}”?`;
  if (language === "ru") return `Что вы имеете в виду под словом «${term}»?`;
  return `Mida sa sõna „${term}” all mõtled?`;
}

export function resolveModelClarification(candidateReply = "", {
  userMessage = "",
  replyLang = "et",
  target = "answer_scope",
  trigger = "answer_model_clarification",
  modelCallCount = 1,
  rootUserMessageId = null
} = {}) {
  const candidateQuestion = analyzeClarificationReply(candidateReply, { userMessage, replyLang });
  // A quoted word in a factual answer is not itself a clarification request.
  const ambiguousTerm = !candidateQuestion.safe && hasClarificationQuestionShape(candidateReply, replyLang) &&
    clarificationComparableText(candidateReply) !== clarificationComparableText(userMessage)
    ? quotedUserTerm(candidateReply, userMessage) : "";
  if (!candidateQuestion.safe && !ambiguousTerm) return null;
  const safeTarget = RECOVERY_TARGETS.has(target) ? target : "answer_scope";
  return {
    reply: candidateQuestion.safe
      ? String(candidateReply || "").replace(/\s+/gu, " ").trim()
      : localizedAmbiguousTermQuestion(ambiguousTerm, replyLang),
    recovery: {
      version: RECOVERY_VERSION,
      active: true,
      action: "ask_clarification",
      trigger,
      reason: "clarification_validated",
      target: safeTarget,
      missing_fields: [safeTarget],
      reply_source: candidateQuestion.safe
        ? "single_model_call"
        : "deterministic_sanitized_clarification",
      question_asked: true,
      model_call_count: Math.max(0, Number(modelCallCount) || 0),
      additional_model_call_count: 0,
      external_knowledge_allowed: false,
      technical_status_allowed: false,
      clarification_guard: candidateQuestion.safe
        ? "closed_lexicon_or_typo_correction"
        : "quoted_user_term_only",
      correction_hints: candidateQuestion.safe ? candidateQuestion.correctionHints : [],
      ...(boundedMessageId(rootUserMessageId)
        ? { root_user_message_id: boundedMessageId(rootUserMessageId) }
        : {})
    }
  };
}

export function buildSocialAcknowledgementReply(message = "", replyLang = "et") {
  const key = lexicalTokens(message).map(normalizeLexicalToken).join(" ");
  const greetings = new Set([
    "tere", "tervist", "hei", "tsau", "hello", "hi", "hey", "привет", "здравствуйте"
  ]);
  if (greetings.has(key)) {
    const language = normalizedLanguage(replyLang);
    if (language === "en") return "Hello! How can I help with a social-sector question?";
    if (language === "ru") return "Здравствуйте! Чем я могу помочь по вопросу социальной сферы?";
    return "Tere! Kuidas saan sind sotsiaalvaldkonna küsimusega aidata?";
  }
  const acknowledgements = new Set([
    "aitah", "suur aitah", "tanan", "tanan sind", "sain aru", "selge pilt",
    "thanks", "thank you", "many thanks", "got it", "that helps",
    "спасибо", "большое спасибо", "понятно", "теперь понятно"
  ]);
  if (!acknowledgements.has(key)) return "";
  const language = normalizedLanguage(replyLang);
  if (language === "en") return "You’re welcome! If another question comes up, just write it here.";
  if (language === "ru") return "Пожалуйста! Если появится ещё вопрос, просто напишите его здесь.";
  return "Hea meelega! Kui sul tekib järgmine küsimus, kirjuta lihtsalt.";
}

export function inferNoContextRecoveryTarget(retrievalMeta = null) {
  const meta = retrievalMeta && typeof retrievalMeta === "object" ? retrievalMeta : {};
  const queryPlan = meta.queryPlan && typeof meta.queryPlan === "object" ? meta.queryPlan : {};
  const planner = queryPlan.question_planner && typeof queryPlan.question_planner === "object"
    ? queryPlan.question_planner
    : queryPlan;
  const mode = String(queryPlan.mode || planner.mode || "").trim().toLowerCase();
  if (
    meta.documentIdentityEvidence?.required === true ||
    meta.authorCorpusEvidence?.required === true ||
    /^(?:specific_document|specific_research_fact|person_source_lookup)/u.test(mode)
  ) return "document_anchor";
  if (
    mode === "temporal" ||
    boundedYears(meta.temporalClaimContract?.target_years).length > 0 ||
    boundedYears(meta.evidencePackage?.temporal_claim_contract?.target_years).length > 0
  ) return "year_scope";
  if (
    meta.currentMunicipalityContactEvidenceRequested === true ||
    meta.structuredContactMissingMunicipalityTurn === true
  ) return "contact_scope";
  if (
    meta.numericFactEvidence?.enabled === true ||
    meta.requestedMetricContract?.enabled === true ||
    planner?.semantic_candidates?.requested_numeric_slots?.slots?.length > 0
  ) return "metric_scope";
  return "answer_scope";
}

export function resolveValidationRecovery({
  providerReply = "",
  fallbackReply = "",
  userMessage = "",
  replyLang = "et",
  validationTrace = null,
  modelCallCount = 1,
  rootUserMessageId = null
} = {}) {
  if (validationTrace?.passed !== false || hasValidatedPublication(validationTrace, fallbackReply)) {
    return { reply: String(fallbackReply || providerReply || "").trim(), recovery: null };
  }
  const reason = String(validationTrace?.reason || "validation_failed").trim();
  const initialTarget = missingTargetForReason(reason, validationTrace);
  const aggregatePeriodAvailable = validationTrace?.temporal_aggregate_period_available === true;
  const aggregateResolutionAlreadyApplied = /(?:asendab\s+varasema\s+aastate\s+kaupa\s+trendi\s+noude|(?:ainult|only|только).{0,80}(?:koond|aggregate|сводн).{0,80}(?:trend|тренд))/u
    .test(normalizeLexicalToken(userMessage));
  const target = initialTarget === "temporal_breakdown" && aggregateResolutionAlreadyApplied
    ? "metric_scope"
    : initialTarget;
  const providerQuestion = analyzeClarificationReply(providerReply, { userMessage, replyLang });
  const userResolvableAmbiguity = reason === "document_identity_unconfirmed" || (
    reason === "source_year_not_body_year" &&
    validationTrace?.temporal_year_contract?.requested_year_role === "ambiguous"
  );
  const safeProviderQuestion = providerQuestion.safe &&
    userResolvableAmbiguity &&
    !aggregateResolutionAlreadyApplied;
  if (!userResolvableAmbiguity) {
    return {
      reply: String(fallbackReply || "").trim() || localizedEvidenceLimit(replyLang),
      recovery: inactiveRecovery({
        action: "state_evidence_limit",
        trigger: "fact_validation_failed",
        reason,
        replySource: "deterministic_fallback",
        modelCallCount,
        guard: "user_cannot_resolve_validation_failure"
      })
    };
  }
  const years = boundedYears(validationTrace?.temporal_missing_years);
  return {
    reply: safeProviderQuestion
      ? String(providerReply || "").replace(/\s+/gu, " ").trim()
      : localizedClarification({ replyLang, target, years, aggregatePeriodAvailable }),
    recovery: {
      version: RECOVERY_VERSION,
      active: true,
      action: "ask_clarification",
      trigger: "fact_validation_failed",
      reason,
      target,
      missing_fields: [target],
      reply_source: safeProviderQuestion ? "single_model_call" : "deterministic_fallback",
      question_asked: true,
      model_call_count: Math.max(0, Number(modelCallCount) || 0),
      additional_model_call_count: 0,
      external_knowledge_allowed: false,
      technical_status_allowed: false,
      clarification_guard: "closed_lexicon_or_typo_correction",
      correction_hints: providerQuestion.correctionHints,
      ...(boundedMessageId(rootUserMessageId)
        ? { root_user_message_id: boundedMessageId(rootUserMessageId) }
        : {}),
      ...(!safeProviderQuestion && target === "temporal_breakdown" && aggregatePeriodAvailable
        ? { suggested_resolution: "aggregate_period" }
        : {})
    }
  };
}

export function buildNoContextRecovery({
  candidateReply = "",
  fallbackReply = "",
  socialAcknowledgementReply = "",
  userMessage = "",
  replyLang = "et",
  ragSearchFailed = false,
  isCrisis = false,
  target = "answer_scope",
  modelCallCount = 0,
  modelCallFailed = false,
  rootUserMessageId = null
} = {}) {
  if (isCrisis) {
    return { reply: String(fallbackReply || "").trim(), recovery: null };
  }
  if (socialAcknowledgementReply) {
    return {
      reply: String(socialAcknowledgementReply).trim(),
      recovery: {
        version: RECOVERY_VERSION,
        active: false,
        action: "social_acknowledgement",
        trigger: "social_turn",
        reason: "non_factual_acknowledgement",
        target: "none",
        missing_fields: [],
        reply_source: "deterministic_fallback",
        question_asked: false,
        model_call_count: 0,
        additional_model_call_count: 0,
        external_knowledge_allowed: false,
        technical_status_allowed: false,
        clarification_guard: "closed_social_dictionary",
        correction_hints: []
      }
    };
  }
  if (ragSearchFailed) {
    return {
      reply: String(fallbackReply || "").trim(),
      recovery: {
        version: RECOVERY_VERSION,
        active: false,
        action: "retry_same_question",
        trigger: "technical_retrieval_failure",
        reason: "rag_search_failed",
        target: "same_question",
        missing_fields: [],
        reply_source: "deterministic_fallback",
        question_asked: true,
        model_call_count: 0,
        additional_model_call_count: 0,
        external_knowledge_allowed: false,
        technical_status_allowed: false,
        clarification_guard: "deterministic_only",
        correction_hints: []
      }
    };
  }
  const modelClarification = resolveModelClarification(candidateReply, {
    userMessage,
    replyLang,
    target,
    trigger: "no_confirmed_context",
    modelCallCount,
    rootUserMessageId
  });
  if (!modelClarification) {
    const markerAccepted = String(candidateReply || "").trim() === NO_USEFUL_CLARIFICATION_MARKER;
    return {
      reply: localizedEvidenceLimit(replyLang),
      recovery: inactiveRecovery({
        action: "state_evidence_limit",
        trigger: "no_confirmed_context",
        reason: markerAccepted
          ? "no_user_resolvable_clarification"
          : modelCallFailed
            ? "clarification_model_failed"
            : "clarification_guard_fallback",
        replySource: "deterministic_fallback",
        modelCallCount,
        guard: markerAccepted
          ? "exact_no_useful_clarification_marker"
          : "closed_lexicon_or_typo_correction"
      })
    };
  }
  return modelClarification;
}

export function recoveryWorkflow(recovery = null) {
  if (!recovery || typeof recovery !== "object") return null;
  const municipalityCandidates = boundedMunicipalityCandidates(recovery.municipality_candidates);
  return {
    ragRecovery: {
      version: recovery.version === RECOVERY_VERSION ? RECOVERY_VERSION : RECOVERY_VERSION,
      active: recovery.active === true,
      action: String(recovery.action || "").slice(0, 40),
      reason: String(recovery.reason || "").slice(0, 80),
      target: String(recovery.target || "").slice(0, 40),
      missingFields: boundedStringList(recovery.missing_fields, 4),
      ...(normalizeSourceSelection(recovery.source_selection) ? { sourceSelection: normalizeSourceSelection(recovery.source_selection) } : {}),
      clarificationHints: boundedStringList(recovery.correction_hints, 2),
      ...(municipalityCandidates.length >= 2 ? { municipalityCandidates } : {}),
      ...(boundedMessageId(recovery.root_user_message_id)
        ? { rootUserMessageId: boundedMessageId(recovery.root_user_message_id) }
        : {}),
      ...(recovery.suggested_resolution === "aggregate_period"
        ? { suggestedResolution: "aggregate_period" }
        : {})
    }
  };
}

export function normalizeTrustedRagRecovery(raw = null) {
  if (!raw || typeof raw !== "object" || raw.active !== true) return null;
  if (String(raw.version || "").trim() !== RECOVERY_VERSION) return null;
  const target = String(raw.target || "").slice(0, 40);
  if (!RECOVERY_TARGETS.has(target)) return null;
  const clarificationHints = boundedStringList(raw.clarificationHints || raw.clarification_hints, 2)
    .filter(item => item.length <= 80 && lexicalTokens(item).length === 1 && !numericTokens(item).length);
  const municipalityCandidates = boundedMunicipalityCandidates(
    raw.municipalityCandidates || raw.municipality_candidates
  );
  return {
    version: RECOVERY_VERSION,
    active: true,
    action: String(raw.action || "").slice(0, 40),
    reason: String(raw.reason || "").slice(0, 80),
    target,
    missingFields: boundedStringList(raw.missingFields || raw.missing_fields, 4),
    ...(target === "source_selection" && normalizeSourceSelection(raw.sourceSelection)
      ? { sourceSelection: normalizeSourceSelection(raw.sourceSelection) } : {}),
    clarificationHints,
    ...(target === "municipality_scope" && municipalityCandidates.length >= 2
      ? { municipalityCandidates }
      : {}),
    ...(boundedMessageId(raw.rootUserMessageId || raw.root_user_message_id)
      ? { rootUserMessageId: boundedMessageId(raw.rootUserMessageId || raw.root_user_message_id) }
      : {}),
    ...(String(raw.suggestedResolution || raw.suggested_resolution || "").trim() === "aggregate_period"
      ? { suggestedResolution: "aggregate_period" }
      : {})
  };
}

function isAffirmativeRecoveryReply(value = "") {
  const firstToken = normalizeLexicalToken(lexicalTokens(value)[0] || "");
  return new Set([
    "jah", "jep", "jaa", "okei", "ok", "oige", "just",
    "yes", "yeah", "yep", "correct", "right",
    "да", "ага", "верно", "точно"
  ]).has(firstToken);
}

function municipalityTypeFromToken(value = "") {
  const token = normalizeLexicalToken(value);
  if (/^(?:linn(?:a|asse|as|ast|ale|al|alt|aks|ani|ana|ata|aga)?|city|town|город\p{Letter}*)$/u.test(token)) {
    return "city";
  }
  if (/^(?:vald|valla|valda|vallasse|vallas|vallast|vallale|vallal|vallalt|vallaks|vallani|vallana|vallata|vallaga|parish|волост\p{Letter}*)$/u.test(token)) {
    return "parish";
  }
  return "";
}

function municipalitySelectionType(value = "") {
  const types = new Set(lexicalTokens(value).map(municipalityTypeFromToken).filter(Boolean));
  return types.size === 1 ? Array.from(types)[0] : "";
}

function resolveMunicipalityCandidate(value = "", recovery = null) {
  const candidates = boundedMunicipalityCandidates(recovery?.municipalityCandidates);
  if (candidates.length < 2) return "";
  const normalizedValue = lexicalTokens(value).map(normalizeLexicalToken).join(" ");
  if (!normalizedValue) return "";
  const exactMatches = candidates.filter(candidate =>
    lexicalTokens(candidate).map(normalizeLexicalToken).join(" ") === normalizedValue
  );
  if (exactMatches.length === 1) return exactMatches[0];
  const selectedType = municipalitySelectionType(value);
  if (!selectedType) return "";
  const typeMatches = candidates.filter(candidate => {
    const tokens = lexicalTokens(candidate);
    return municipalityTypeFromToken(tokens[tokens.length - 1]) === selectedType;
  });
  return typeMatches.length === 1 ? typeMatches[0] : "";
}

export function recoveryQueryHints(message = "", recoveryState = null) {
  const recovery = normalizeTrustedRagRecovery(recoveryState);
  if (
    !recovery ||
    !isAffirmativeRecoveryReply(String(message || "").trim()) ||
    !isRagRecoveryContinuation(message, recovery)
  ) return [];
  return recovery.clarificationHints;
}

function boundedRecoveryHistoryText(values = [], limit = 0) {
  const texts = (Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean);
  const boundedLimit = Math.max(0, Number(limit) || 0);
  if (!texts.length || !boundedLimit) return "";
  const joined = texts.join("\n");
  if (joined.length <= boundedLimit) return joined;

  const available = Math.max(0, boundedLimit - Math.max(0, texts.length - 1));
  const allocations = Array(texts.length).fill(0);
  let remaining = available;
  let pending = texts.map((_, index) => index);
  while (pending.length && remaining > 0) {
    const share = Math.floor(remaining / pending.length);
    const short = pending.filter(index => texts[index].length <= share);
    if (!short.length) {
      pending.forEach((index, position) => {
        allocations[index] = share + (position < remaining % pending.length ? 1 : 0);
      });
      remaining = 0;
      break;
    }
    for (const index of short) {
      allocations[index] = texts[index].length;
      remaining -= texts[index].length;
    }
    const completed = new Set(short);
    pending = pending.filter(index => !completed.has(index));
  }

  return texts.map((text, index) => {
    const allocation = allocations[index];
    if (!allocation) return "";
    if (text.length <= allocation) return text;
    if (allocation <= 8) return text.slice(0, allocation);
    const marker = "\n…\n";
    const retained = allocation - marker.length;
    const headLength = Math.ceil(retained / 2);
    return `${text.slice(0, headLength)}${marker}${text.slice(-(retained - headLength))}`;
  }).filter(Boolean).join("\n");
}

export function buildRecoveryBoundMessage({
  message = "",
  recoveryState = null,
  trustedHistory = []
} = {}) {
  const current = String(message || "").trim();
  if (!current || !isRagRecoveryContinuation(current, recoveryState)) return current;
  const priorUserTexts = (Array.isArray(trustedHistory) ? trustedHistory : [])
    .filter(item => String(item?.role || "").toLowerCase() === "user")
    .map(item => String(item?.text || item?.content || "").trim())
    .filter(Boolean)
    .slice(0, 4);
  if (!priorUserTexts.length) return current;
  const recovery = normalizeTrustedRagRecovery(recoveryState);
  const resolvedMunicipality = recovery?.target === "municipality_scope"
    ? resolveMunicipalityCandidate(current, recovery)
    : "";
  if (recovery?.target === "source_selection") return priorUserTexts[0].slice(0, 4000);
  const normalizedCurrentTokens = lexicalTokens(current).map(normalizeLexicalToken);
  const normalizedCurrent = normalizedCurrentTokens.join(" ");
  const explicitAggregateScope = recovery?.target === "temporal_breakdown" &&
    /(?:koond|kogu periood|overall period|whole period|aggregate|весь период|сводн)/u.test(normalizedCurrent) &&
    /(?:ainult|ara|ilma|only|without|leave out|только|без|не включ)/u.test(normalizedCurrent);
  const acceptedAggregateResolution = recovery?.target === "temporal_breakdown" &&
    recovery?.suggestedResolution === "aggregate_period" &&
    isAffirmativeRecoveryReply(current);
  const aggregateResolution = explicitAggregateScope || acceptedAggregateResolution
    ? "Käesolev täpsustus asendab varasema aastate kaupa trendi nõude: vasta ainult tõendatud kogu perioodi koondnäitajatega ning ütle, et eraldi aastatrend ei ole tõendatud."
    : "";
  const suffixParts = Array.from(new Set([
    ...recoveryQueryHints(current, recoveryState),
    resolvedMunicipality || current,
    aggregateResolution
  ].map(item => String(item || "").trim()).filter(Boolean)));
  const suffix = suffixParts.join("\n").slice(-4000);
  const priorLimit = Math.max(0, 4000 - suffix.length - (suffix ? 1 : 0));
  const boundedPriorText = boundedRecoveryHistoryText(priorUserTexts, priorLimit);
  return [boundedPriorText, suffix].filter(Boolean).join("\n");
}

export function isRagRecoveryContinuation(message = "", recoveryState = null) {
  const recovery = normalizeTrustedRagRecovery(recoveryState);
  if (!recovery) return false;
  if (recovery.target === "source_selection") return ["selected", "clarify", "expired"].includes(
    resolveSourceSelection(message, recovery.sourceSelection).status
  );
  const rawText = String(message || "").trim();
  const text = rawText.toLowerCase();
  if (!text) return false;
  const words = text.split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);
  const wordTokens = lexicalTokens(text).map(normalizeLexicalToken);
  const firstToken = wordTokens[0] || "";
  const hasToken = (...tokens) => tokens.some(token => wordTokens.includes(normalizeLexicalToken(token)));
  if (words.length > 12 || (text.includes("?") && words.length > 6)) return false;
  const questionTokens = new Set([
    "kas", "mis", "mida", "milline", "millised", "kes", "kelle", "kus", "kuhu", "millal", "kuidas", "miks",
    "do", "does", "did", "is", "are", "what", "which", "who", "where", "when", "how", "why",
    "что", "какой", "какая", "какие", "кто", "где", "куда", "когда", "как", "почему"
  ].map(normalizeLexicalToken));
  const startsNewQuestion = questionTokens.has(firstToken);
  const containsNewQuestion = startsNewQuestion || wordTokens.slice(1).some(token => questionTokens.has(token));
  const changesTopicAfterAssent = wordTokens.slice(1).some(token => new Set(["aga", "hoopis", "but", "instead", "но", "вместо"]).has(token));
  const normalizedWordSequence = wordTokens.join(" ");
  const explicitNewTopic = /^(?:(?:jah|jaa|jep|okei|ok|yes|yeah|yep|да|ага)\s+)?(?:(?:uus|teine)\s+(?:teema|kusimus)|(?:new|another|different)\s+(?:topic|question)|(?:нов\p{L}*|друг\p{L}*)\s+(?:тем\p{L}*|вопрос\p{L}*))(?:\s|$)/u
    .test(normalizedWordSequence);
  const standaloneInstructionTokens = new Set([
    "selgita", "kirjelda", "räägi", "anna", "võrdle", "aita", "küsin",
    "explain", "describe", "tell", "give", "compare", "help", "ask",
    "объясни", "опишите", "расскажи", "дайте", "сравните", "помоги", "спрошу"
  ].map(normalizeLexicalToken));
  const startsStandaloneInstruction = standaloneInstructionTokens.has(firstToken);
  const containsStandaloneInstruction = wordTokens.slice(1).some(token => standaloneInstructionTokens.has(token));
  const yearTargetMatch = /(?<!\d)(?:19|20)\d{2}(?!\d)/u.test(text) || hasToken("aasta", "aastat", "aastate", "periood", "eraldi", "trend", "koond", "year", "years", "period", "separately", "год", "года", "период", "отдельно", "тренд");
  const documentTargetMatch = hasToken("artikkel", "artikli", "autor", "pealkiri", "aasta", "dokument", "aruanne", "article", "author", "title", "year", "document", "report", "статья", "автор", "название", "год", "документ", "отчёт", "отчет") ||
    /(?<!\d)(?:19|20)\d{2}(?!\d)/u.test(text) ||
    (words.length <= 3 && /\p{Uppercase_Letter}/u.test(rawText));
  const contactTargetMatch = hasToken("vald", "valla", "linn", "linna", "kov", "omavalitsus", "kontakt", "roll", "teenus", "municipality", "city", "contact", "role", "service", "волость", "город", "самоуправление", "контакт", "роль", "услуга") ||
    Boolean(municipalitySelectionType(text)) ||
    (words.length <= 3 && /\p{Uppercase_Letter}/u.test(rawText));
  const metricTargetMatch = hasToken("näitaja", "rühm", "sihtrühm", "protsent", "arv", "ulatus", "measure", "metric", "group", "percentage", "count", "показатель", "группа", "процент", "число");
  const politeStandaloneInstruction =
    new Set(["palun", "please", "пожалуйста"]).has(firstToken) &&
    containsStandaloneInstruction;
  if (
    startsNewQuestion ||
    explicitNewTopic ||
    startsStandaloneInstruction ||
    politeStandaloneInstruction ||
    containsStandaloneInstruction
  ) return false;
  if (isAffirmativeRecoveryReply(text)) {
    return words.length <= 8 &&
      !containsNewQuestion &&
      !changesTopicAfterAssent;
  }
  if (new Set(["ei", "no", "нет"]).has(firstToken) && words.length <= 4) return true;
  if (
    words.length <= 8 &&
    hasToken("see", "seda", "selle", "need", "mõlemad", "esimene", "teine", "viimane", "that", "this", "it", "those", "both", "first", "second", "last", "это", "этот", "эта", "оба", "первый", "второй", "последний")
  ) return true;
  if (recovery.target === "year_scope" || recovery.target === "temporal_breakdown") {
    return yearTargetMatch;
  }
  if (recovery.target === "document_anchor") {
    return documentTargetMatch;
  }
  if (recovery.target === "contact_scope" || recovery.target === "municipality_scope") {
    return contactTargetMatch;
  }
  if (recovery.target === "metric_scope") {
    return metricTargetMatch;
  }
  if (recovery.target === "answer_scope" || recovery.target === "topic_scope") {
    return words.length <= 6 && !text.includes("?") && !startsNewQuestion;
  }
  return false;
}

export { RECOVERY_VERSION };
