export const HELP_CHAT_INTENTS = Object.freeze([
  "create_help_request",
  "create_help_offer",
  "browse_help_requests",
  "browse_help_offers",
  "connect_to_offer",
  "connect_to_request",
  "service_guidance"
]);

const BROWSE_PATTERNS = Object.freeze([
  /\b(sirvi|vaata|naita\w*|kuva|otsi|browse|list|show|find)\b/
]);

const CREATE_PATTERNS = Object.freeze([
  /\b(loo|koosta|sisest\w*|lis\w*|create|post\w*|publish\w*|vormista\w*)\b/
]);

const CONNECT_PATTERNS = Object.freeze([
  /\b(uhenda|yhenda|connect|match|contact|vota uhendust|get in touch)\b/
]);

const GUIDANCE_PATTERNS = Object.freeze([
  /\?/,
  /\b(kas|kuidas|where|where can|what service|mis teenus|mida teha|can i|get support)\b/
]);

const INFORMATIONAL_PATTERNS = Object.freeze([
  /\binfo\b/,
  /\binfot\b/,
  /\bteenus\w*\b/,
  /\btoetus\w*\b/,
  /\bhyvitis\w*\b/,
  /\bkov\b/,
  /\bomavalitsus\w*\b/,
  /\bvald\b/,
  /\blinn\b/,
  /\bmilline\s+teenus\b/,
  /\bmis\s+teenus\b/,
  /\bkust\s+saan\b/,
  /\bkuidas\s+sa[aä]da\b/
]);

const OFFER_SIGNAL_PATTERNS = Object.freeze([
  /\bpakun\b/,
  /\bsoovin\s+pakkuda\b/,
  /\bsaan\s+aidata\b/,
  /\bvoin\s+aidata\b/,
  /\bvoiksin\s+aidata\b/,
  /\bolen\s+valmis\s+aitama\b/,
  /\baitan\b/,
  /\babistan\b/
]);

const REQUEST_SIGNAL_PATTERNS = Object.freeze([
  /\bvajan\s+abi\b/,
  /\bmul\s+oleks\s+vaja\b/,
  /\bmul\s+on\s+vaja\b/,
  /\bvaja\s+oleks\b/,
  /\botsin\b/,
  /\bsoovin\s+leida\b/,
  /\baita\s+leida\b/,
  /\bvajaksin\b/,
  /\botsin\s+abi\b/,
  /\bpalun\s+abi\b/,
  /\babi\s+vaja\b/
]);

const OFFER_LISTING_PATTERNS = Object.freeze([
  /\babipakkumis\w*\b/,
  /\bhelp\s+offer\b/,
  /\bpakkumis\w*\b/
]);

const REQUEST_LISTING_PATTERNS = Object.freeze([
  /\babipalv\w*\b/,
  /\babisoov\w*\b/,
  /\bhelp\s+request\b/
]);

const SERVICE_PATTERNS = Object.freeze([
  /\b(teenus|service|omavalitsus|municipality|kov|vald|linn)\b/
]);

const MEDIATION_REQUEST_PATTERNS = Object.freeze([
  /\bkas\s+keegi\s+pakub\b/,
  /\bkas\s+keegi\s+saaks\s+aidata\b/,
  /\bon\s+kedagi\s+kes\s+saaks\s+aidata\b/,
  /\bleidub\s+kedagi\s+kes\s+saaks\s+aidata\b/,
  /\bsee\s+tuleks\s+abisoovina\s+ules\s+pan\w*\b/,
  /\bsee\s+tuleks\s+abipalvena\s+ules\s+pan\w*\b/
]);

const MEDIATION_OFFER_PATTERNS = Object.freeze([
  /\bsee\s+tuleks\s+abipakkumisena\s+ules\s+pan\w*\b/,
  /\bsee\s+tuleks\s+pakkumisena\s+ules\s+pan\w*\b/
]);

const LISTING_ACTION_PATTERNS = Object.freeze([
  /\bules\s+pan\w*\b/,
  /\bpostita\w*\b/,
  /\bkuulutu\w*\b/
]);

function normalizeIntentText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function hasMatch(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(patterns, text) {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) count += 1;
  }
  return count;
}

function hasSubstantiveContent(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length >= 2;
}

export function isHelpChatIntent(value) {
  return HELP_CHAT_INTENTS.includes(String(value || "").trim());
}

export function analyzeHelpChatIntent(text = "") {
  const normalized = normalizeIntentText(text);
  if (!normalized) {
    return {
      normalized,
      intent: null
    };
  }

  const hasBrowse = hasMatch(BROWSE_PATTERNS, normalized);
  const hasCreate = hasMatch(CREATE_PATTERNS, normalized);
  const hasConnect = hasMatch(CONNECT_PATTERNS, normalized);
  const hasGuidance = hasMatch(GUIDANCE_PATTERNS, text) || hasMatch(GUIDANCE_PATTERNS, normalized);
  const hasInformationalIntent = hasMatch(INFORMATIONAL_PATTERNS, normalized);
  const offerSignalCount = countMatches(OFFER_SIGNAL_PATTERNS, normalized);
  const requestSignalCount = countMatches(REQUEST_SIGNAL_PATTERNS, normalized);
  const hasOfferListing = hasMatch(OFFER_LISTING_PATTERNS, normalized);
  const hasRequestListing = hasMatch(REQUEST_LISTING_PATTERNS, normalized);
  const hasService = hasMatch(SERVICE_PATTERNS, normalized);
  const hasRequestMediation = hasMatch(MEDIATION_REQUEST_PATTERNS, normalized)
    || (hasRequestListing && hasMatch(LISTING_ACTION_PATTERNS, normalized));
  const hasOfferMediation = hasMatch(MEDIATION_OFFER_PATTERNS, normalized)
    || (hasOfferListing && hasMatch(LISTING_ACTION_PATTERNS, normalized));
  const substantive = hasSubstantiveContent(normalized);
  const offerStrength = offerSignalCount + (hasOfferListing ? 2 : 0) + (hasCreate && hasOfferListing ? 1 : 0);
  const requestStrength = requestSignalCount + (hasRequestListing ? 2 : 0) + (hasCreate && hasRequestListing ? 1 : 0);
  const prefersServiceGuidance =
    (hasGuidance || hasInformationalIntent)
    && (hasService || hasInformationalIntent)
    && !hasOfferMediation
    && !hasRequestMediation
    && !hasOfferListing
    && !hasRequestListing
    && offerSignalCount === 0
    && requestSignalCount <= 1;

  let intent = null;
  if (hasConnect && hasOfferListing) {
    intent = "connect_to_offer";
  } else if (hasConnect && hasRequestListing) {
    intent = "connect_to_request";
  } else if (hasBrowse && hasRequestListing) {
    intent = "browse_help_requests";
  } else if (hasBrowse && hasOfferListing) {
    intent = "browse_help_offers";
  } else if (hasCreate && hasOfferListing) {
    intent = "create_help_offer";
  } else if (hasCreate && hasRequestListing) {
    intent = "create_help_request";
  } else if (prefersServiceGuidance) {
    intent = "service_guidance";
  } else if ((offerStrength > 0 && substantive) || hasOfferMediation) {
    intent = "create_help_offer";
  } else if ((requestStrength > 0 && substantive) || hasRequestMediation) {
    intent = "create_help_request";
  } else if (hasGuidance && (hasService || hasInformationalIntent || hasOfferListing || hasRequestListing)) {
    intent = "service_guidance";
  }

  return {
    normalized,
    intent,
    signals: {
      hasBrowse,
      hasCreate,
      hasConnect,
      hasGuidance,
      hasInformationalIntent,
      hasService,
      substantive,
      hasOfferListing,
      hasRequestListing,
      hasOfferMediation,
      hasRequestMediation,
      offerSignalCount,
      requestSignalCount,
      offerStrength,
      requestStrength
    }
  };
}

export function detectHelpChatIntent(text = "") {
  return analyzeHelpChatIntent(text).intent;
}
