import prisma from "../prisma.js";
import {
  createHelpMatch,
  listAlternativeOffersForRequest,
  listAlternativeRequestsForOffer,
  listMatchingOffersForRequest,
  listMatchingRequestsForOffer
} from "./matches.js";
import { detectHelpChatIntent } from "./intents.js";
import { helpWorkflowT } from "./chatWorkflowText.js";
import { inferHelpCategoryCode } from "./categories.js";
import { findLocationAliasMatches } from "./locationAliases.js";
import {
  municipalityGuessNeedsConfirmation,
  normalizePlaceToMunicipality
} from "./locationNormalization.js";
import { createHelpWorkflowActions } from "./workflowActions.js";
import { createHelpWorkflowExtraction } from "./workflowExtraction.js";
import { buildBroadPrompt, createHelpQuestionFlow } from "./workflowQuestions.js";
import { createHelpWorkflowPreview } from "./workflowPreview.js";
import {
  buildHelpListingMetaLine,
  formatHelpTypeLabel,
  formatTimeTypeLabel,
  toHelpListingView
} from "./listingViews.js";
import { createHelpOffer } from "./offers.js";
import { createHelpRequest } from "./requests.js";
import { refineHelpDraftWithAi } from "./aiExtraction.js";
import { inferTargetGroupCodes } from "./targetGroups.js";
import { createHelpWorkflowDraftState, isActiveHelpWorkflowState, normalizeHelpWorkflowState } from "./workflowState.js";
import { redactPersonalData } from "../privacy/piiFilter.js";

const CATEGORY_LABELS = Object.freeze({
  TRANSPORT: "Transport",
  DAILY_TASKS: "Igapäevaabi",
  HOME_HELP: "Koduabi",
  DIGITAL_HELP: "Digiabi",
  CARE_SUPPORT: "Tugi ja hooldus",
  CHILD_YOUTH_SUPPORT: "Laste ja noorte tugi",
  LEARNING_GUIDANCE: "Õppimise ja juhendamise abi",
  SOCIAL_SUPPORT: "Seltskond ja sotsiaalne tugi",
  ADMIN_FORM_HELP: "Asjaajamise ja vormide abi",
  OTHER: "Muu abi"
});

const TARGET_GROUP_LABELS = Object.freeze({
  CHILD: "Laps",
  YOUTH: "Noor",
  ADULT: "Täiskasvanu",
  ELDER: "Eakas"
});

const SUPPORTED_TARGET_GROUP_CODES = new Set(Object.keys(TARGET_GROUP_LABELS));


const LOCATION_PREPOSITION_PATTERN = /\b(?:asukohaks|asukohas|asukoht|piirkonnas|piirkond|kohas|kohale|kandis|linnas|vallas|külas|alevis|alevikus|juures|lähedal|near|in|at)\s+([\p{L}\d][\p{L}\d'.-]*(?:\s+[\p{L}\d][\p{L}\d'.-]*){0,3})/iu;
const MUNICIPALITY_PATTERN = /\b([\p{L}-]+(?:\s+[\p{L}-]+)?\s+(?:vald|linn))\b/iu;
const WEEKDAY_OR_TIME_PATTERN = /\b(esmaspäev|esmaspaev|teisipäev|teisipaev|kolmapäev|kolmapaev|neljapäev|neljapaev|reede|laupäev|laupaev|pühapäev|puhapaev|igal|iga|õhtuti|ohtuti|hommikuti|päeviti|paeviti|nädalavahetusel|nadalavahetusel|alates|kohe|lähiajal|lahiajal|järgmisest|jargmisest)\b/i;
const SCOPE_PATTERN = /\b(ainult|õhtuti|hommikuti|tööpäeviti|nädalavahetusel|kokkuleppel|kindlas piirkonnas|piiratud piirkonnas)\b/i;
const PAID_DETAILS_PATTERN = /\b(\d+\s*(?:eur|euro|€)|tunnihind|päevahind|kord|tasu|kokkuleppeline tasu|tasustamine)\b/i;
const TITLE_PREFIX_PATTERN = /^\s*(?:pealkiri|title)\s*[:=-]\s*/i;

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function collapseWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sentenceCaseLabel(value = "") {
  const text = collapseWhitespace(value);
  if (!text) return "";
  return `${text.charAt(0).toLocaleUpperCase("et-EE")}${text.slice(1)}`;
}

function looksLikeMeaningfulGeneratedTitleBase(value = "") {
  const cleaned = collapseWhitespace(String(value || "").replace(/[^\p{L}\p{N}\s-]/gu, " "));
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const letterCount = (cleaned.match(/\p{L}/gu) || []).length;
  const digitCount = (cleaned.match(/\d/g) || []).length;
  const vowelCount = (normalizeText(cleaned).match(/[aeiouy]/g) || []).length;

  if (!letterCount && !digitCount) return false;
  if (words.length === 1) {
    if (!digitCount && letterCount < 5) return false;
    if (letterCount >= 5 && vowelCount === 0) return false;
  }
  if (letterCount > 0 && letterCount <= 3 && words.length <= 1) return false;
  return true;
}

function formatLabelledLine(label, value) {
  return `${label}: ${value}`;
}

function isAffirmative(text = "") {
  const normalized = normalizeText(text);
  return /^(jah|jaa|yes|ok|okay|kinnitan|confirm|salvesta|save|sobib)\b/.test(normalized);
}

function isCancel(text = "") {
  return /\b(katkesta|lopeta|lõpeta|cancel|abort|ara salvesta|ära salvesta)\b/.test(normalizeText(text));
}

function isNegative(text = "") {
  const normalized = normalizeText(text);
  return /^(ei|no|not really)\b/.test(normalized) && normalized.split(/\s+/).length <= 3;
}

function _shortDescription(text = "", max = 220) {
  const normalized = collapseWhitespace(text);
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}...`;
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => collapseWhitespace(value)).filter(Boolean)));
}

function parseOrdinalSelection(text = "", max = 0) {
  const normalized = normalizeText(text);
  const numericMatch = normalized.match(/\b([1-9]|10)\b/);
  if (numericMatch) {
    const index = Number(numericMatch[1]) - 1;
    if (index >= 0 && index < max) return index;
  }
  if (/\b(esimene|first)\b/.test(normalized)) return max > 0 ? 0 : null;
  if (/\b(teine|second)\b/.test(normalized)) return max > 1 ? 1 : null;
  if (/\b(kolmas|third)\b/.test(normalized)) return max > 2 ? 2 : null;
  return null;
}

function looksLikeBrowseSelection(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return /\b([1-9]|10|esimene|teine|kolmas|first|second|third|koigiga|koik|all|uhenda|yhenda|connect|match|contact)\b/.test(normalized);
}

function buildIntentTitle(intent) {
  if (intent === "create_help_offer") return "Abipakkumine";
  return "Abisoov";
}

function buildCategoryFallbackTitle(categoryCode = "", intent = "create_help_request") {
  const categoryLabel = getCategoryLabel(categoryCode);
  if (!categoryLabel) return buildIntentTitle(intent);
  return intent === "create_help_offer"
    ? `${categoryLabel} pakkumine`
    : `${categoryLabel} soov`;
}

function stripAvailabilityHelpTypeTail(value = "") {
  const text = collapseWhitespace(value);
  if (!text) return "";
  return collapseWhitespace(
    text
      .replace(/\s*,\s*(?:uhekordne|\u00fchekordne|regulaarne)(?:\s+abi)?\s*,\s*/giu, ", ")
      .replace(/\s*,\s*(?:uhekordne|\u00fchekordne|regulaarne|paindlik)(?:\s+abi)?\.?$/iu, "")
      .replace(/\s+(?:ja|ning)\s+(?:uhekordne|\u00fchekordne|regulaarne|paindlik)(?:\s+abi)?\.?$/iu, "")
      .replace(/\s+(?:ja|ning)\s+on\s+(?:vabatahtlik|tasuline|tasuta)(?:\s+abi)?\.?$/iu, "")
      .replace(/\s*,\s*on\s+(?:vabatahtlik|tasuline|tasuta)(?:\s+abi)?\.?$/iu, "")
      .replace(/\s+(?:ja|ning)\s+abi\s+on\s+(?:vabatahtlik|tasuline|tasuta)(?:\s+abi)?\.?$/iu, "")
      .replace(/\s*,\s*abi\s+on\s+(?:vabatahtlik|tasuline|tasuta)(?:\s+abi)?\.?$/iu, "")
      .trim()
  );
}

function isVagueOfferIntentText(text = "") {
  const normalized = normalizeText(collapseWhitespace(text))
    .replace(/[^\p{L}\d]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return /^(?:pakun\s+)?(?:tahaks|tahan|soovin)\s+(?:(?:kedagi|kellelegi|inimest|inimesi)\s+)?(?:[\p{L}\d]+\s+){0,5}(?:abistada|aidata)$/u.test(normalized);
}

function trimGeneratedTitleBase(text = "", maxLength = 60) {
  const normalized = collapseWhitespace(text).replace(/[.?!,:;]+$/g, "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) {
    return normalized.replace(/\b(?:ja|ning|voi|ehk)$/i, "").trim();
  }
  const sliced = normalized.slice(0, maxLength + 1);
  const boundary = sliced.lastIndexOf(" ");
  const shortened = boundary >= Math.floor(maxLength * 0.6)
    ? sliced.slice(0, boundary)
    : normalized.slice(0, maxLength);
  return collapseWhitespace(shortened)
    .replace(/[.?!,:;-]+$/g, "")
    .replace(/\b(?:ja|ning|voi|ehk)$/i, "")
    .trim();
}

function buildDescriptionBasedTitle(description = "", intent = "create_help_request") {
  const rawDescription = collapseWhitespace(description).replace(/[.?!]+$/g, "").trim();
  const firstSentence = rawDescription.split(/(?<=[.!?])\s+/)[0] || rawDescription;
  const baseDescription = trimGeneratedTitleBase(
    firstSentence
      .replace(/\s+(Pakun|Vajan)\b.*$/i, "")
      .replace(/^(Pakun|Vajan)\s+/i, "")
      .trim(),
    60
  );
  if (!baseDescription || !looksLikeMeaningfulGeneratedTitleBase(baseDescription)) return "";
  if (intent === "create_help_offer" && isVagueOfferIntentText(baseDescription)) return "";
  return intent === "create_help_offer"
    ? collapseWhitespace(`Pakun ${baseDescription}`).replace(/^Pakun pakun/i, "Pakun")
    : collapseWhitespace(`Vajan ${baseDescription}`).replace(/^Vajan vajan/i, "Vajan");
}

function deriveHelpTypeEnum(description = "") {
  const normalized = normalizeText(description);
  const mentionsVoluntary = /\b(vabatahtlik\w*|tasuta|volunteer|voluntary)\b/.test(normalized);
  const mentionsPaid = /\b(tasuli\w*|paid|tasu eest)\b/.test(normalized);

  if (mentionsVoluntary && mentionsPaid) return "MIXED";
  if (mentionsPaid) return "PAID";
  if (mentionsVoluntary) return "VOLUNTARY";
  return "";
}

function deriveTimeTypeEnum(description = "") {
  const normalized = normalizeText(description);
  if (/\b(paar korda nadalas|paar korda nädalas|iga nadal|iga paev|igapaev|iga päev|weekly|daily|recurring|regular)\b/.test(normalized)) {
    return "RECURRING";
  }
  if (/\b(ukskord|üks kord|one time|one-off|uhekordne|ühekordne)\b/.test(normalized)) {
    return "ONE_TIME";
  }
  if (/\b(paindlik|ajutine|temporary|flexible|vastavalt vajadusele|as needed)\b/.test(normalized)) {
    return "FLEXIBLE";
  }
  return "";
}

function _deriveDraftFields(description = "", intent = "create_help_request") {
  const normalized = normalizeText(description);
  let category = "";
  let categoryCode = "";
  let serviceLabel = "";
  let helpType = deriveHelpTypeEnum(description);
  let timeType = deriveTimeTypeEnum(description);
  let targetGroup = "";

  if (/\b(transport|soit|sõit|viia|autoga)\b/.test(normalized)) {
    category = "Transport";
    categoryCode = "TRANSPORT";
    serviceLabel = "Transpordiabi";
  } else if (/\b(pood|poes|ostud|toidupood|shop)\b/.test(normalized)) {
    category = "Igapaevaabi";
    categoryCode = "DAILY_TASKS";
    serviceLabel = "Poeabi";
  } else if (/\b(isiklik abistaja|abistaja|care assistant)\b/.test(normalized)) {
    category = "Tugi ja hooldus";
    categoryCode = "CARE_SUPPORT";
    serviceLabel = "Isikliku abistaja abi";
  } else if (/\b(koduabi|kodus|korist|majapid)\b/.test(normalized)) {
    category = "Koduabi";
    categoryCode = "HOME_HELP";
    serviceLabel = "Koduabi";
  } else if (/\b(selts|kaasa|saatm|compan)\b/.test(normalized)) {
    category = "Seltskond ja sotsiaalne tugi";
    categoryCode = "SOCIAL_SUPPORT";
    serviceLabel = "Saatmis- voi seltsimisabi";
  } else if (/\b(vorm|avald|dokum|asjaaj|admin|form)\b/.test(normalized)) {
    category = "Asjaajamise ja vormide abi";
    categoryCode = "ADMIN_FORM_HELP";
    serviceLabel = "Dokumentide ja vormide abi";
  } else if (/\b(digi|telefon|arvuti|internet|e-teenus|computer)\b/.test(normalized)) {
    category = "Digiabi";
    categoryCode = "DIGITAL_HELP";
    serviceLabel = "Digiabi";
  }

  if (/\b(emale|emalele|isale|vanaemale|vanaisale|eakale|senior)\b/.test(normalized)) {
    targetGroup = "Eakas inimene";
  } else if (/\b(lapsele|lastele|noorele|young person|child)\b/.test(normalized)) {
    targetGroup = "Laps / noor";
  }

  const title = serviceLabel || buildIntentTitle(intent);
  return {
    title,
    category,
    categoryCode,
    serviceLabel,
    helpType,
    timeType,
    targetGroup
  };
}

function _cleanInitialDescription(text = "") {
  return String(text || "")
    .replace(/^[\s,.-]*(aita mul\s+vormistada|soovin\s+pakkuda|pakun|saan\s+aidata|voin\s+aidata|voiksin\s+aidata|olen\s+valmis\s+aitama|aitan|mul oleks vaja|mul on vaja|vaja oleks|vajan|otsin|soovin leida|aita leida)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function _shouldAppendDescription(text = "", currentState = null) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (isAffirmative(text) || isCancel(text)) return false;
  if (currentState?.municipalityCandidates?.length && (normalized.length <= 40 || /^\d+$/.test(normalized))) return false;
  if (/\b(tallinn(as)?|tartu(s)?|narva(s)?|parnu(s)?|pärnu(s)?|viljandi(s)?|valga(s)?|keila(s)?)\b/.test(normalized) && normalized.length <= 24) {
    return false;
  }
  return normalized.length >= 6;
}

function getCategoryLabel(code = "") {
  return CATEGORY_LABELS[String(code || "").trim().toUpperCase()] || "";
}

function getTargetGroupLabels(codes = []) {
  return uniqueStrings(codes.map((code) => TARGET_GROUP_LABELS[String(code || "").trim().toUpperCase()] || ""));
}

const {
  detectBeneficiaryLabel: extractedDetectBeneficiaryLabel,
  inferCategoryFromText: extractedInferCategoryFromText,
  mergeDraftState: mergeDraftStateFromExtraction
} = createHelpWorkflowExtraction({
  LOCATION_PREPOSITION_PATTERN,
  MUNICIPALITY_PATTERN,
  PAID_DETAILS_PATTERN,
  SCOPE_PATTERN,
  TITLE_PREFIX_PATTERN,
  WEEKDAY_OR_TIME_PATTERN,
  collapseWhitespace,
  createHelpWorkflowDraftState,
  findLocationAliasMatches,
  generateStructuredSummary: generatePracticalStructuredSummary,
  generateTitleFromDraft,
  getCategoryLabel,
  getTargetGroupLabels,
  inferHelpCategoryCode,
  inferTargetGroupCodes,
  isAffirmative,
  isCancel,
  isNegative,
  municipalityGuessNeedsConfirmation,
  normalizeDraft,
  normalizePlaceToMunicipality,
  normalizeText,
  parseOrdinalSelection,
  uniqueStrings
});

function normalizeDraft(input = {}) {
  const targetGroup = sentenceCaseLabel(input.targetGroup);
  const targetGroups = uniqueStrings(input.targetGroups).map(sentenceCaseLabel).filter(Boolean);
  const explicitTargetGroupCodes = uniqueStrings(input.targetGroupCodes)
    .map((value) => value.toUpperCase())
    .filter((code) => SUPPORTED_TARGET_GROUP_CODES.has(code));
  const targetGroupCodes = explicitTargetGroupCodes.length
    ? explicitTargetGroupCodes
    : inferTargetGroupCodes({ targetGroup, targetGroups }).filter((code) => SUPPORTED_TARGET_GROUP_CODES.has(code));

  return {
    title: collapseWhitespace(input.title),
    description: collapseWhitespace(input.description),
    category: collapseWhitespace(input.category),
    categoryCode: collapseWhitespace(input.categoryCode).toUpperCase(),
    secondaryCategories: uniqueStrings(input.secondaryCategories),
    secondaryCategoryCodes: uniqueStrings(input.secondaryCategoryCodes).map((value) => value.toUpperCase()),
    serviceLabel: collapseWhitespace(input.serviceLabel),
    helpType: collapseWhitespace(input.helpType).toUpperCase(),
    timeType: collapseWhitespace(input.timeType).toUpperCase(),
    targetGroup,
    targetGroups,
    targetGroupCodes,
    rawPlace: collapseWhitespace(input.rawPlace),
    availabilityOrStart: sentenceCaseLabel(stripAvailabilityHelpTypeTail(input.availabilityOrStart)),
    contactPreference: collapseWhitespace(input.contactPreference),
    compensationDetails: sentenceCaseLabel(input.compensationDetails),
    beneficiaryLabel: sentenceCaseLabel(input.beneficiaryLabel),
    urgency: sentenceCaseLabel(input.urgency),
    providerScopeOrConditions: sentenceCaseLabel(input.providerScopeOrConditions),
    conditions: sentenceCaseLabel(input.conditions),
    skillsOrBackground: collapseWhitespace(input.skillsOrBackground),
    accessibilityNotes: collapseWhitespace(input.accessibilityNotes),
    languagePreference: collapseWhitespace(input.languagePreference),
    structuredSummary: collapseWhitespace(input.structuredSummary),
    extraNotes: collapseWhitespace(input.extraNotes)
  };
}

function normalizedFieldValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  return collapseWhitespace(value);
}

function changedFieldNames(previousDraft = {}, nextDraft = {}) {
  const changed = [];
  const allKeys = new Set([...Object.keys(previousDraft), ...Object.keys(nextDraft)]);
  for (const key of allKeys) {
    if (normalizedFieldValue(previousDraft[key]) !== normalizedFieldValue(nextDraft[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function _detectCompensationType(message = "") {
  const normalized = normalizeText(message);
  const mentionsVoluntary = /\b(vabatahtlik\w*|tasuta|volunteer|voluntary)\b/.test(normalized);
  const mentionsPaid = /\b(tasuli\w*|tasu eest|paid|eur|euro|€|tunnihind|kokkuleppeline tasu)\b/.test(normalized);
  const mentionsBoth = /\b(molemad|mõlemad|nii vabatahtlik kui tasuline|(?:olen\s+)?avatud\s+molemale|(?:olen\s+)?avatud\s+mõlemale)\b/.test(normalized);
  if (mentionsBoth || (mentionsVoluntary && mentionsPaid)) return "MIXED";
  if (mentionsPaid) return "PAID";
  if (mentionsVoluntary) return "VOLUNTARY";
  return "";
}

function _detectCompensationDetails(message = "", helpType = "") {
  const trimmed = collapseWhitespace(message);
  if (!trimmed) return "";
  if (!PAID_DETAILS_PATTERN.test(trimmed) && !/\bkokkuleppel\b/i.test(trimmed)) return "";
  if (helpType === "VOLUNTARY" && !/\bkuluhuvitis|sõidukulu|sõidukulud\b/i.test(trimmed)) return "";
  return trimmed;
}

function _detectTimeType(message = "") {
  const normalized = normalizeText(message);
  if (/\b(uhekordne|ühekordne|one time|one-off|seekord)\b/.test(normalized)) return "ONE_TIME";
  if (/\b(regulaarne|regulaarselt|iga nadal|iga nädal|kolmapaeviti|kolmapäeviti|esmaspaeviti|esmaspäeviti|teisipaeviti|teisipäeviti|neljapaeviti|neljapäeviti|reedeti|laupaeviti|laupäeviti|puhapaeviti|pühapäeviti|nadalavahetusel|nädalavahetusel)\b/.test(normalized)) return "RECURRING";
  if (/\b(paindlik|paindlikult|vastavalt vajadusele|as needed|kokkuleppel)\b/.test(normalized)) return "FLEXIBLE";
  return "";
}

function _detectAvailabilityOrStart(message = "") {
  const trimmed = collapseWhitespace(message);
  if (!trimmed) return "";
  if (WEEKDAY_OR_TIME_PATTERN.test(trimmed) || /\b(kohe|lähiajal|paindlikult|saadaval|vaba)\b/i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

function _detectUrgency(message = "") {
  const normalized = normalizeText(message);
  if (/\b(kohe|esimesel voimalusel|esimesel võimalusel|niipea kui voimalik|niipea kui võimalik)\b/.test(normalized)) return "kohe";
  if (/\b(lahiajal|lähiajal|lähinadalal|lähinädalal|peagi|varsti)\b/.test(normalized)) return "lähiajal";
  if (/\b(paindlik|paindlikult|ei ole kiire|pole kiire)\b/.test(normalized)) return "paindlik";
  return "";
}

function _detectBeneficiaryLabel(message = "") {
  const normalized = normalizeText(message);
  if (/\b(endale|mulle|minule|enda jaoks)\b/.test(normalized)) return "endale";
  if (/\b(emale)\b/.test(normalized)) return "emale";
  if (/\b(isale)\b/.test(normalized)) return "isale";
  if (/\b(lapsele)\b/.test(normalized)) return "lapsele";
  if (/\b(kliendile)\b/.test(normalized)) return "kliendile";
  if (/\b(vanaemale)\b/.test(normalized)) return "vanaemale";
  if (/\b(vanaisale)\b/.test(normalized)) return "vanaisale";
  return "";
}

function hasExplicitLocationCue(message = "") {
  const text = String(message || "").trim();
  if (!text) return false;
  const normalized = normalizeText(text);
  if (MUNICIPALITY_PATTERN.test(text) || LOCATION_PREPOSITION_PATTERN.test(text)) return true;
  if (findLocationAliasMatches(text).length) return true;
  return /\b(asukoht|asukohaks|omavalitsus|vald|linn|alev|küla|kyla|piirkond|koht)\b/.test(normalized);
}

function _detectProviderScopeOrConditions(message = "") {
  const trimmed = collapseWhitespace(message);
  if (!trimmed) return "";
  if (SCOPE_PATTERN.test(trimmed) || /\b(kolmapaeviti|kolmapäeviti|esmaspaeviti|esmaspäeviti|teisipaeviti|teisipäeviti|õhtuti|ohtuti|hommikuti)\b/i.test(trimmed)) return trimmed;
  return "";
}

function _detectConditions(message = "") {
  const trimmed = collapseWhitespace(message);
  if (!trimmed) return "";
  if (/\b(trepp|ratastool|liikumisraskus|vajab saatjat|ei saa üksinda|juurdepääs)\b/i.test(trimmed)) return trimmed;
  return "";
}

function _detectSkillsOrBackground(message = "") {
  const trimmed = collapseWhitespace(message);
  if (!trimmed) return "";
  if (/\b(kogemus|oskused|juhiluba|auto olemas|hoolduskogemus|digiabi kogemus|taust)\b/i.test(trimmed)) return trimmed;
  return "";
}

function _inferCategoryFromText(message = "", previousCode = "") {
  const normalized = normalizeText(message);
  if (!normalized) {
    return { categoryCode: previousCode || "", category: getCategoryLabel(previousCode), confidence: previousCode ? "high" : "low" };
  }
  if (/\btransport\w*\b/.test(normalized)) {
    return { categoryCode: "TRANSPORT", category: getCategoryLabel("TRANSPORT"), confidence: "high" };
  }
  if (/\b(pood|poes|poeabi|ostud|asjaajamine|kaimine|käimine)\b/.test(normalized)) {
    return { categoryCode: "DAILY_TASKS", category: getCategoryLabel("DAILY_TASKS"), confidence: "high" };
  }
  if (/\b(digi|arvuti|telefon|internet|e-teenus|e teenus)\b/.test(normalized)) {
    return { categoryCode: "DIGITAL_HELP", category: getCategoryLabel("DIGITAL_HELP"), confidence: "high" };
  }
  if (/\b(hooldus|hooldaja|isiklik abistaja|tugiisik|saatja)\b/.test(normalized)) {
    return { categoryCode: "CARE_SUPPORT", category: getCategoryLabel("CARE_SUPPORT"), confidence: "high" };
  }
  const inferredCode = inferHelpCategoryCode({
    primaryCategoryCode: previousCode,
    description: message
  });
  if (inferredCode && inferredCode !== "OTHER") {
    return { categoryCode: inferredCode, category: getCategoryLabel(inferredCode), confidence: "high" };
  }
  if (/\b(muu abi|muu)\b/.test(normalized)) {
    return { categoryCode: "OTHER", category: getCategoryLabel("OTHER"), confidence: "medium" };
  }
  return { categoryCode: previousCode || "", category: getCategoryLabel(previousCode), confidence: previousCode ? "high" : "low" };
}

const {
  computeMissingFields,
  getNextQuestion,
  nextMissingField
} = createHelpQuestionFlow({
  normalizeDraft,
  inferCategoryFromText: extractedInferCategoryFromText
});

const {
  buildChangeReflection,
  buildDraftProgressReply,
  buildPreviewEditPrompt,
  buildPreviewReply
} = createHelpWorkflowPreview({
  normalizeDraft,
  collapseWhitespace,
  formatLabelledLine
});

const {
  buildSavedReply,
  handleBrowseTurn,
  handleConnectTurn,
  isBrowseHelpIntent,
  isConnectHelpIntent,
  isCreateHelpIntent,
  saveStructuredRecord
} = createHelpWorkflowActions({
  buildHelpListingMetaLine,
  buildIntentTitle,
  createHelpMatch,
  createHelpOffer,
  createHelpRequest,
  createHelpWorkflowDraftState,
  formatHelpTypeLabel,
  formatTimeTypeLabel,
  formatLabelledLine,
  generateStructuredSummary: generatePracticalStructuredSummary,
  isAffirmative,
  isNegative,
  listAlternativeOffersForRequest,
  listAlternativeRequestsForOffer,
  listMatchingOffersForRequest,
  listMatchingRequestsForOffer,
  normalizeDraft,
  parseOrdinalSelection,
  toHelpListingView
});

function _inferTargetGroupsFromMessage(message = "", previousCodes = []) {
  const normalized = normalizeText(message);
  const manualCodes = [];
  if (/\b(laps|lapsele|lastele|lapsed)\b/.test(normalized)) manualCodes.push("CHILD");
  if (/\b(noor|noorele|noortele|noored)\b/.test(normalized)) manualCodes.push("YOUTH");
  if (/\b(taiskasvanu|taiskasvanule|taiskasvanud)\b/.test(normalized)) manualCodes.push("ADULT");
  if (/\b(eakas|eakale|eakad|eakatele|pensionar|pensionarid)\b/.test(normalized)) manualCodes.push("ELDER");
  if (manualCodes.length) {
    return {
      targetGroupCodes: uniqueStrings(manualCodes),
      targetGroups: getTargetGroupLabels(manualCodes),
      confidence: "high"
    };
  }
  const codes = inferTargetGroupCodes({
    targetGroup: message
  });
  if (codes.length) {
    return {
      targetGroupCodes: uniqueStrings(codes),
      targetGroups: getTargetGroupLabels(codes),
      confidence: "high"
    };
  }
  if (previousCodes.length) {
    return {
      targetGroupCodes: uniqueStrings(previousCodes),
      targetGroups: getTargetGroupLabels(previousCodes),
      confidence: "high"
    };
  }
  return {
    targetGroupCodes: [],
    targetGroups: [],
    confidence: "low"
  };
}

function _cleanNaturalDescription(text = "", _intent = "create_help_request") {
  return String(text || "")
    .replace(TITLE_PREFIX_PATTERN, "")
    .replace(/^[\s,.-]*(?:aita mul\s+vormistada|soovin\s+pakkuda|pakun|saan\s+aidata|voin\s+aidata|voiksin\s+aidata|olen\s+valmis\s+aitama|aitan)\s+/i, "")
    .replace(/^[\s,.-]*(?:mul oleks vaja|mul on vaja|vaja oleks|vajan|otsin|soovin leida|aita leida)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitSwitchIntent(message = "", currentIntent = null) {
  const normalized = normalizeText(message);
  if (!normalized) return null;
  if (isCancel(normalized)) return "cancel";
  if (/\b(soovin hoopis abisoovi teha|see on abisoov|muudan see on abisoov|muudan, see on abisoov)\b/.test(normalized)) {
    return currentIntent === "create_help_request" ? null : "create_help_request";
  }
  if (/\b(soovin hoopis abipakkumist teha|see on abipakkumine|muudan see on abipakkumine|muudan, see on abipakkumine)\b/.test(normalized)) {
    return currentIntent === "create_help_offer" ? null : "create_help_offer";
  }
  return null;
}

function generateTitleFromDraft(draft = {}, intent = "create_help_request") {
  const explicitOrExistingTitle = collapseWhitespace(draft.title);
  const descriptionBasedTitle = buildDescriptionBasedTitle(draft.description, intent);
  const canReplaceGenericIntentTitle = Boolean(
    draft.categoryCode
    && explicitOrExistingTitle
    && normalizeText(explicitOrExistingTitle) === normalizeText(buildIntentTitle(intent))
  );
  const canReplaceVagueOfferTitle = Boolean(
    draft.categoryCode
    && explicitOrExistingTitle
    && intent === "create_help_offer"
    && isVagueOfferIntentText(explicitOrExistingTitle)
  );
  const canReplaceGeneratedTitle = Boolean(
    draft.categoryCode
    && explicitOrExistingTitle
    && descriptionBasedTitle
    && normalizeText(explicitOrExistingTitle) === normalizeText(descriptionBasedTitle)
  );

  if (
    explicitOrExistingTitle
    && !canReplaceGenericIntentTitle
    && !canReplaceVagueOfferTitle
    && !canReplaceGeneratedTitle
  ) {
    return explicitOrExistingTitle;
  }
  if (draft.categoryCode) {
    return buildCategoryFallbackTitle(draft.categoryCode, intent);
  }
  if (descriptionBasedTitle) {
    return descriptionBasedTitle;
  }
  return buildIntentTitle(intent);
}

function _generateStructuredSummary(draft = {}, municipalityLabel = "", intent = "create_help_request") {
  return collapseWhitespace([
    generateTitleFromDraft(draft, intent),
    draft.rawPlace,
    municipalityLabel,
    draft.helpType ? formatHelpTypeLabel(draft.helpType, "et") : "",
    draft.timeType ? formatTimeTypeLabel(draft.timeType, "et") : ""
  ].filter(Boolean).join(" · ")).slice(0, 280);
}

function generatePracticalStructuredSummary(draft = {}, municipalityLabel = "") {
  const parts = [
    draft.rawPlace,
    municipalityLabel,
    draft.helpType ? formatHelpTypeLabel(draft.helpType, "et") : "",
    draft.timeType ? formatTimeTypeLabel(draft.timeType, "et") : ""
  ].filter(Boolean);

  if (!parts.length && draft.category) {
    parts.push(draft.category);
  }

  return collapseWhitespace(parts.join(" | ")).slice(0, 280);
}

async function readHelpWorkflowState(convId, userId, prismaClient = prisma) {
  const conversationId = String(convId || "").trim();
  const ownerId = String(userId || "").trim();
  if (!conversationId || !ownerId) return null;

  const conversation = await prismaClient.conversation.findUnique({
    where: { id: conversationId },
    select: {
      userId: true
    }
  });
  if (!conversation || conversation.userId !== ownerId) return null;

  const assistantMessages = await prismaClient.conversationMessage.findMany({
    where: {
      conversationId,
      role: "ASSISTANT"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 12,
    select: {
      metadata: true
    }
  });

  for (const message of assistantMessages) {
    const nextState = normalizeHelpWorkflowState(message?.metadata?.workflow?.help || message?.metadata?.helpWorkflow || null);
    if (nextState) return nextState;
  }

  return null;
}

function buildWorkflowMetadata(state) {
  return {
    workflow: {
      help: state || null
    }
  };
}

function isGenericLocationCandidate(value = "") {
  return /\b(vajadusel|kokkuleppel|paindlik(?:ult)?|saadaval|saadavus|algus|aeg|ajad|paevad|kell|kohapeal|veebi(?:s)?|online|telefoni|vestluse|mobiil|kaugelt)\b/i.test(normalizeText(value));
}

function extractLocationCandidates(message = "") {
  const text = String(message || "").trim();
  if (!text) return [];

  const candidates = [];
  const municipalityMatch = text.match(MUNICIPALITY_PATTERN);
  if (municipalityMatch?.[1]) candidates.push(collapseWhitespace(municipalityMatch[1]));

  const prepMatch = text.match(LOCATION_PREPOSITION_PATTERN);
  if (prepMatch?.[1]) candidates.push(collapseWhitespace(prepMatch[1]));

  const aliasMatches = findLocationAliasMatches(text);
  for (const alias of aliasMatches) {
    candidates.push(alias.place);
  }

  const plainWords = text
    .replace(/[.,!?;:()"]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const token of plainWords) {
    if (token.length < 4) continue;
    if (/\b(minule|mulle|endale)\b/i.test(token)) continue;
    if (isGenericLocationCandidate(token)) continue;
    if (/\b(eakatele|eakale|lapsele|emale|isale|vabatahtlik|tasuline|regulaarne|paindlik|paindlikult|lahiajal|lähiajal|uhekordselt|ühekordselt|telefoni|vestluse|kaudu|poes|kaimiseks)\b/i.test(token)) {
      continue;
    }
    if (/(s|l|le|lt|st|ga)$/i.test(token)) candidates.push(token.replace(/[.,!?;:]+$/g, ""));
  }

  return uniqueStrings(candidates);
}

async function _resolveMunicipalityUpdate(message, state, prismaClient = prisma, activeField = "") {
  if (state?.municipalityCandidates?.length) {
    if (state.municipalityCandidates.length === 1 && isNegative(message)) {
      return {
        municipalityId: null,
        municipalityLabel: "",
        municipalityCandidates: [],
        rawPlace: ""
      };
    }

    if (state.municipalityCandidates.length === 1 && isAffirmative(message)) {
      const selected = state.municipalityCandidates[0];
      return {
        municipalityId: selected.id,
        municipalityLabel: selected.displayName,
        municipalityCandidates: [],
        rawPlace: state?.draft?.rawPlace || selected.displayName
      };
    }

    const selectionIndex = parseOrdinalSelection(message, state.municipalityCandidates.length);
    if (selectionIndex != null) {
      const selected = state.municipalityCandidates[selectionIndex];
      return {
        municipalityId: selected.id,
        municipalityLabel: selected.displayName,
        municipalityCandidates: [],
        rawPlace: state?.draft?.rawPlace || selected.displayName
      };
    }

    const normalizedMessage = normalizeText(message);
    const byName = state.municipalityCandidates.find((candidate) => normalizeText(candidate.displayName) === normalizedMessage);
    if (byName) {
      return {
        municipalityId: byName.id,
        municipalityLabel: byName.displayName,
        municipalityCandidates: [],
        rawPlace: state?.draft?.rawPlace || byName.displayName
      };
    }
  }

  const shouldInferLocation = activeField === "rawPlace"
    || activeField === "municipalityId"
    || !state?.draft?.rawPlace
    || hasExplicitLocationCue(message);

  if (!shouldInferLocation) return null;

  const locationCandidates = extractLocationCandidates(message);
  for (const candidate of locationCandidates) {
    const normalizedPlace = await normalizePlaceToMunicipality({
      rawPlace: candidate,
      message: candidate
    }, {}, prismaClient);
    if (!normalizedPlace?.rawPlace && !normalizedPlace?.municipalityId && !normalizedPlace?.candidates?.length) {
      continue;
    }

    if (normalizedPlace.municipalityId && !municipalityGuessNeedsConfirmation(normalizedPlace)) {
      return {
        municipalityId: normalizedPlace.municipalityId,
        municipalityLabel: normalizedPlace.municipalityDisplayName || normalizedPlace.municipality?.displayName || "",
        municipalityCandidates: [],
        rawPlace: normalizedPlace.rawPlace || candidate
      };
    }
    if (municipalityGuessNeedsConfirmation(normalizedPlace)) {
      return {
        municipalityId: null,
        municipalityLabel: "",
        municipalityCandidates: (normalizedPlace.candidates || []).map((item) => ({
          id: item.id,
          displayName: item.displayName,
          county: item.county,
          type: item.type
        })),
        rawPlace: normalizedPlace.rawPlace || candidate
      };
    }
    if (normalizedPlace?.rawPlace) {
      return {
        municipalityId: null,
        municipalityLabel: "",
        municipalityCandidates: [],
        rawPlace: normalizedPlace.rawPlace
      };
    }
  }
  return null;
}

async function mergeDraftState(state, message, prismaClient = prisma, options = {}) {
  return mergeDraftStateFromExtraction(state, message, {
    prismaClient,
    getNextMissingField: nextMissingField,
    aiDraftPatcher: typeof options?.aiDraftPatcher === "function"
      ? options.aiDraftPatcher
      : refineHelpDraftWithAi
  });
}

function prepareQuestionProgressState(state, replyLang) {
  const missingFields = computeMissingFields(state);
  const nextQuestion = getNextQuestion({
    ...state,
    missingFields
  }, replyLang);

  const nextState = createHelpWorkflowDraftState({
    ...state,
    mode: "draft",
    missingFields,
    step: nextQuestion
      ? (nextQuestion.layer === "enrichment" ? "collect_conditional_fields" : "collect_required_fields")
      : "preview",
    confirmationPending: !nextQuestion,
    activeQuestionLayer: nextQuestion?.layer || null,
    activeQuestionKey: nextQuestion?.key || null,
    askedEnrichmentKeys: nextQuestion?.layer === "enrichment"
      ? uniqueStrings([...(state?.askedEnrichmentKeys || []), nextQuestion.key])
      : state?.askedEnrichmentKeys || []
  });

  return {
    missingFields,
    nextQuestion,
    nextState
  };
}

function buildQuestionReply(state, question, changedFields = [], replyLang = "et") {
  return buildDraftProgressReply(state, question, replyLang, {
    changedFields
  }) || question?.prompt || "";
}

async function _saveStructuredRecord(state, userId, prismaClient = prisma) {
  const draft = normalizeDraft(state?.draft || {});
  const descriptionLines = [
    draft.description,
    state.intent === "create_help_request" && draft.beneficiaryLabel ? `Kellele abi vaja on: ${draft.beneficiaryLabel}` : "",
    state.intent === "create_help_request" && draft.urgency ? `Kiireloomulisus: ${draft.urgency}` : "",
    state.intent === "create_help_offer" && draft.providerScopeOrConditions ? `Tingimused: ${draft.providerScopeOrConditions}` : "",
    draft.category ? `Põhikategooria: ${draft.category}` : "",
    state.municipalityLabel ? `Omavalitsus: ${state.municipalityLabel}` : "",
    draft.rawPlace ? `Täpsem asukoht: ${draft.rawPlace}` : "",
    draft.targetGroups.length ? `Sihtrühm: ${draft.targetGroups.join(", ")}` : "",
    draft.helpType ? `Abi vorm: ${formatHelpTypeLabel(draft.helpType, "et")}` : "",
    draft.compensationDetails ? `Tasu info: ${draft.compensationDetails}` : "",
    draft.timeType ? `Ajalisus: ${formatTimeTypeLabel(draft.timeType, "et")}` : "",
    draft.availabilityOrStart ? `Saadavus / algus: ${draft.availabilityOrStart}` : "",
    draft.conditions ? `Lisatingimused: ${draft.conditions}` : "",
    draft.skillsOrBackground ? `Oskused või taust: ${draft.skillsOrBackground}` : ""
  ].filter(Boolean);

  const redactPublicText = (value) => redactPersonalData(value).redactedText;
  const sharedPayload = {
    userId,
    municipalityId: state.municipalityId,
    primaryCategoryCode: draft.categoryCode || undefined,
    category: draft.category,
    serviceLabel: draft.category || redactPublicText(draft.title),
    title: redactPublicText(draft.title || buildIntentTitle(state.intent)),
    description: redactPublicText(descriptionLines.join("\n")),
    structuredSummary: redactPublicText(draft.structuredSummary || generatePracticalStructuredSummary(draft, state.municipalityLabel)),
    roleLabel: redactPublicText(state.intent === "create_help_request"
      ? draft.beneficiaryLabel || draft.category
      : draft.providerScopeOrConditions || draft.category),
    beneficiaryLabel: state.intent === "create_help_request" ? redactPublicText(draft.beneficiaryLabel || "") || undefined : undefined,
    urgency: state.intent === "create_help_request" ? draft.urgency || undefined : undefined,
    providerScopeOrConditions: state.intent === "create_help_offer" ? redactPublicText(draft.providerScopeOrConditions || "") || undefined : undefined,
    availabilityOrStart: redactPublicText(draft.availabilityOrStart || "") || undefined,
    compensationDetails: redactPublicText(draft.compensationDetails || "") || undefined,
    conditions: redactPublicText(draft.conditions || "") || undefined,
    skillsOrBackground: redactPublicText(draft.skillsOrBackground || "") || undefined,
    helpType: draft.helpType || undefined,
    timeType: draft.timeType,
    targetGroupCodes: draft.targetGroupCodes,
    rawPlace: redactPublicText(draft.rawPlace || "") || undefined,
    classificationSource: "USER",
    userConfirmedAt: new Date().toISOString()
  };

  if (state.intent === "create_help_offer") {
    return createHelpOffer(sharedPayload, prismaClient);
  }

  return createHelpRequest(sharedPayload, prismaClient);
}

function _resolveBrowseSelection(message, browseResults = []) {
  if (!browseResults.length) return null;
  if (browseResults.length === 1) return browseResults[0];

  const selectionIndex = parseOrdinalSelection(message, browseResults.length);
  if (selectionIndex != null) {
    return browseResults[selectionIndex] || null;
  }

  return null;
}

function _isCreateHelpIntent(intent = "") {
  return intent === "create_help_request" || intent === "create_help_offer";
}

function _isBrowseHelpIntent(intent = "") {
  return intent === "browse_help_offers" || intent === "browse_help_requests";
}

function _isConnectHelpIntent(intent = "") {
  return intent === "connect_to_offer" || intent === "connect_to_request";
}

async function handleCreateTurn({ state, message, userId, replyLang, prismaClient, aiDraftPatcher }) {
  const switchIntent = explicitSwitchIntent(message, state.intent);
  if (switchIntent === "cancel") {
    return {
      handled: true,
      workflowState: null,
      reply: helpWorkflowT(replyLang, "create.cancelled"),
      cards: [],
      attachments: []
    };
  }
  if (switchIntent && switchIntent !== state.intent) {
    const nextState = createHelpWorkflowDraftState({
      intent: switchIntent,
      step: "collect_required_fields",
      flowLocked: true,
      confirmationPending: false,
      activeQuestionLayer: "basic",
      activeQuestionKey: "description",
      sourceMessage: ""
    });
    return {
      handled: true,
      workflowState: nextState,
      reply: buildBroadPrompt(switchIntent, replyLang),
      cards: [],
      attachments: []
    };
  }

  if (!state.flowLocked || state.step === "intent_confirmation") {
    const lockedState = createHelpWorkflowDraftState({
      ...state,
      flowLocked: true,
      step: "collect_required_fields",
      confirmationPending: false,
      activeQuestionLayer: null,
      activeQuestionKey: null
    });
    const sourceMessage = String(state.sourceMessage || "").trim();
    if (!sourceMessage) {
      const prepared = prepareQuestionProgressState(lockedState, replyLang);
      return {
        handled: true,
        workflowState: prepared.nextState,
        reply: prepared.nextQuestion?.prompt || buildBroadPrompt(lockedState.intent, replyLang),
        cards: [],
        attachments: []
      };
    }

    const mergedFromSource = await mergeDraftState(lockedState, sourceMessage, prismaClient, { aiDraftPatcher });
    const prepared = prepareQuestionProgressState(mergedFromSource, replyLang);

    if (!prepared.nextQuestion) {
      return {
        handled: true,
        workflowState: createHelpWorkflowDraftState({
          ...prepared.nextState,
          step: "edit_or_save",
          confirmationPending: true,
          activeQuestionLayer: null,
          activeQuestionKey: null
        }),
        reply: buildPreviewReply(prepared.nextState, replyLang),
        cards: [],
        attachments: []
      };
    }

    return {
      handled: true,
      workflowState: prepared.nextState,
      reply: buildQuestionReply(prepared.nextState, prepared.nextQuestion, changedFieldNames(lockedState.draft || {}, prepared.nextState.draft || {}), replyLang)
        || buildBroadPrompt(lockedState.intent, replyLang),
      cards: [],
      attachments: []
    };
  }

  if ((state.step === "preview" || state.step === "edit_or_save") && isAffirmative(message)) {
    const record = await saveStructuredRecord(state, userId, prismaClient);
    const nextState = createHelpWorkflowDraftState({
      ...state,
      mode: "saved",
      step: "saved",
      flowLocked: false,
      confirmationPending: false,
      activeQuestionLayer: null,
      activeQuestionKey: null,
      municipalityId: record.municipalityId,
      municipalityLabel: record?.municipality?.displayName || state.municipalityLabel,
      linkedRequestId: state.intent === "create_help_request" ? record.id : state.linkedRequestId,
      linkedOfferId: state.intent === "create_help_offer" ? record.id : state.linkedOfferId,
      sourceRecordId: record.id,
      missingFields: []
    });
    const browseResult = await handleBrowseTurn({
      state: nextState,
      replyLang,
      prismaClient
    });
    const savedReply = buildSavedReply(nextState, record, replyLang, {
      includeNextStep: false
    });
    const browseReply = String(browseResult?.reply || "").trim();
    return {
      handled: true,
      workflowState: browseResult?.workflowState || nextState,
      reply: [savedReply, browseReply].filter(Boolean).join("\n\n"),
      cards: [],
      attachments: Array.isArray(browseResult?.attachments) ? browseResult.attachments : []
    };
  }

  if ((state.step === "preview" || state.step === "edit_or_save") && isNegative(message)) {
    return {
      handled: true,
      workflowState: createHelpWorkflowDraftState({
        ...state,
        step: "edit_or_save",
        confirmationPending: true,
        activeQuestionLayer: null,
        activeQuestionKey: null
      }),
      reply: buildPreviewEditPrompt(state, replyLang),
      cards: [],
      attachments: []
    };
  }

  if (state.step === "preview" || state.step === "edit_or_save") {
    return {
      handled: true,
      workflowState: createHelpWorkflowDraftState({
        ...state,
        step: "edit_or_save",
        confirmationPending: true,
        activeQuestionLayer: null,
        activeQuestionKey: null
      }),
      reply: buildPreviewEditPrompt(state, replyLang),
      cards: [],
      attachments: []
    };
  }

  const missingField = state.activeQuestionKey || nextMissingField(state);
  if (
    state.intent === "create_help_offer"
    && (missingField === "offerAudience" || missingField === "targetGroupCodes")
    && extractedDetectBeneficiaryLabel(message)
  ) {
    return {
      handled: true,
      workflowState: state,
      reply: helpWorkflowT(replyLang, "questions.shared.targetGroupClarifyOffer"),
      cards: [],
      attachments: []
    };
  }

  const mergedState = await mergeDraftState(state, message, prismaClient, { aiDraftPatcher });
  const changedFields = changedFieldNames(state.draft || {}, mergedState.draft || {}).concat(
    state.municipalityLabel !== mergedState.municipalityLabel ? ["municipalityLabel"] : []
  );
  const prepared = prepareQuestionProgressState(mergedState, replyLang);

  if (prepared.nextQuestion) {
    return {
      handled: true,
      workflowState: prepared.nextState,
      reply: buildQuestionReply(prepared.nextState, prepared.nextQuestion, changedFields, replyLang),
      cards: [],
      attachments: []
    };
  }

  return {
    handled: true,
    workflowState: createHelpWorkflowDraftState({
      ...prepared.nextState,
      step: "edit_or_save",
      confirmationPending: true,
      missingFields: [],
      activeQuestionLayer: null,
      activeQuestionKey: null
    }),
    reply: buildPreviewReply(prepared.nextState, replyLang, {
      prefix: buildChangeReflection(prepared.nextState, changedFields, replyLang)
    }),
    cards: [],
    attachments: []
  };
}

async function _handleBrowseTurn({ state, replyLang, prismaClient }) {
  const intent = state.intent === "create_help_offer" || state.intent === "browse_help_requests"
    ? "browse_help_requests"
    : "browse_help_offers";
  const sourceId = intent === "browse_help_offers" ? state.linkedRequestId || state.sourceRecordId : state.linkedOfferId || state.sourceRecordId;

  if (!sourceId) {
    return {
      handled: true,
      workflowState: state,
      reply: helpWorkflowT(replyLang, intent === "browse_help_offers" ? "browse.sourceMissingOffers" : "browse.sourceMissingRequests"),
      cards: [],
      attachments: []
    };
  }

  const rawResults = intent === "browse_help_offers"
    ? await listMatchingOffersForRequest(sourceId, { limit: 5 }, prismaClient)
    : await listMatchingRequestsForOffer(sourceId, { limit: 5 }, prismaClient);
  const results = rawResults.map((item) => ({
    ...item,
    listingView: toHelpListingView(item, { kind: item.kind, locale: replyLang })
  }));

  const nextState = createHelpWorkflowDraftState({
    ...state,
    mode: "browse",
    step: "browse",
    intent,
    sourceRecordId: sourceId,
    browseResults: results,
    confirmationPending: false
  });

  return {
      handled: true,
      workflowState: nextState,
      reply: buildBrowseReply(intent, results, replyLang),
      cards: [],
      attachments: []
    };
  }

async function _handleConnectTurn({ state, message, replyLang, prismaClient }) {
  if (!state.browseResults?.length) {
    return {
      handled: true,
      workflowState: state,
      reply: helpWorkflowT(replyLang, "connect.needBrowse"),
      cards: [],
      attachments: []
    };
  }

  const selected = resolveBrowseSelection(message, state.browseResults);
  if (!selected) {
    return {
      handled: true,
      workflowState: state,
      reply: helpWorkflowT(replyLang, "connect.askWhich"),
      cards: [],
      attachments: []
    };
  }

  const requestId = selected.kind === "offer"
    ? state.linkedRequestId || state.sourceRecordId
    : selected.id;
  const offerId = selected.kind === "offer"
    ? selected.id
    : state.linkedOfferId || state.sourceRecordId;

  try {
    const match = await createHelpMatch({
      requestId,
      offerId
    }, prismaClient);

    const nextState = createHelpWorkflowDraftState({
      ...state,
      mode: "done",
      step: "connect",
      matchId: match.id,
      roomId: match.roomId,
      confirmationPending: false
    });

    return {
      handled: true,
      workflowState: nextState,
      reply: helpWorkflowT(replyLang, "connect.created"),
      cards: [],
      attachments: []
    };
  } catch (error) {
    return {
      handled: true,
      workflowState: state,
      reply: helpWorkflowT(replyLang, error?.code === "HELP_MATCH_ALREADY_ACTIVE" ? "connect.alreadyActive" : "connect.failed"),
      cards: [],
      attachments: []
    };
  }
}

export async function runHelpChatWorkflow(input = {}, prismaClient = prisma) {
  const message = String(input?.message || "").trim();
  const userId = String(input?.userId || "").trim();
  if (!message || !userId) return { handled: false };

  const replyLang = String(input?.replyLang || "et").trim();
  const currentState = normalizeHelpWorkflowState(input?.workflowState || null)
    || await readHelpWorkflowState(input?.convId, userId, prismaClient);
  const forcedIntentRaw = String(input?.forcedIntent || "").trim();
  const forcedIntent =
    forcedIntentRaw === "create_help_request" || forcedIntentRaw === "create_help_offer"
      ? forcedIntentRaw
      : null;
  const detectedIntent = forcedIntent || detectHelpChatIntent(message);

  if (!currentState) {
    if (!forcedIntent && !isCreateHelpIntent(detectedIntent)) {
      return {
        handled: false,
        workflowState: null
      };
    }

    const lockedState = createHelpWorkflowDraftState({
      intent: forcedIntent || detectedIntent,
      step: "collect_required_fields",
      flowLocked: false,
      sourceMessage: message
    });
  return handleCreateTurn({
    state: lockedState,
    message,
    userId,
    replyLang,
    prismaClient,
    aiDraftPatcher: input?.aiDraftPatcher
  });
  }

  if (detectedIntent === "service_guidance" && !currentState) {
    return {
      handled: false,
      workflowState: currentState
    };
  }

  if (!currentState && !forcedIntent && !detectedIntent) {
    return {
      handled: false,
      workflowState: currentState
    };
  }

  let state = currentState
    ? createHelpWorkflowDraftState(currentState)
    : createHelpWorkflowDraftState({
        intent: forcedIntent || detectedIntent,
        step: "collect_required_fields",
        flowLocked: true,
        sourceMessage: message
      });

  if (!forcedIntent && isBrowseHelpIntent(detectedIntent)) {
    state = createHelpWorkflowDraftState({
      ...state,
      intent: detectedIntent,
      mode: "browse",
      step: "browse",
      confirmationPending: false
    });
  } else if (!forcedIntent && isConnectHelpIntent(detectedIntent)) {
    state = createHelpWorkflowDraftState({
      ...state,
      intent: detectedIntent,
      step: "connect",
      confirmationPending: false
    });
  } else if (
    !forcedIntent
    && (state.mode === "saved" || state.mode === "done")
    && isCreateHelpIntent(detectedIntent)
  ) {
    const nextState = createHelpWorkflowDraftState({
      intent: detectedIntent,
      step: "collect_required_fields",
      flowLocked: true,
      sourceMessage: message
    });
    return handleCreateTurn({
      state: nextState,
      message,
      userId,
      replyLang,
      prismaClient,
      aiDraftPatcher: input?.aiDraftPatcher
    });
  }

  if (
    !forcedIntent
    && isBrowseHelpIntent(state.intent)
    && Array.isArray(state.browseResults)
    && state.browseResults.length
    && looksLikeBrowseSelection(message)
  ) {
    state = createHelpWorkflowDraftState({
      ...state,
      intent: state.intent === "browse_help_requests" ? "connect_to_request" : "connect_to_offer",
      step: "connect",
      confirmationPending: false
    });
  }

  if (isBrowseHelpIntent(state.intent)) {
    return handleBrowseTurn({
      state,
      replyLang,
      prismaClient
    });
  }

  if (isConnectHelpIntent(state.intent)) {
    return handleConnectTurn({
      state,
      message,
      replyLang,
      prismaClient
    });
  }

  if (!isActiveHelpWorkflowState(state) && !state.flowLocked && !forcedIntent) {
    return {
      handled: false,
      workflowState: state
    };
  }

  return handleCreateTurn({
    state,
    message,
    userId,
    replyLang,
    prismaClient,
    aiDraftPatcher: input?.aiDraftPatcher
  });
}

export function buildHelpWorkflowMetadata(state) {
  return buildWorkflowMetadata(state);
}

export async function getHelpWorkflowState(convId, userId, prismaClient = prisma) {
  return readHelpWorkflowState(convId, userId, prismaClient);
}
