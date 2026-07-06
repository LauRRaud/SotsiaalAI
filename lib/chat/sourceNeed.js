function normalizeSourceNeedText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isAssistantSourceUiIssue(message = "") {
  const text = normalizeSourceNeedText(message);
  if (!text) return false;
  const mentionsSources = /(allik|viide|viited|\bsource\b|\bsources\b|\bcite\b|\bcitation\b|\brag\b)/.test(text);
  if (!mentionsSources) return false;
  return /\b(miks|mida teha|kuidas|kaasa|tarbet|uleliig|ebavajal|naeb|naitab|kuvab|tekib|tekkis|valtida|selliseid vastuseid|allikarea|vastuste allikad|ilma otsese)\b/.test(text);
}

function isLikelyConversationalTurn(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text) return false;
  if (/^(tere|hei|hey|hello|hi|tsau|aitah|tanan|selge|ok|okei|jah|jaa|ei|sobib|hea|vaga hea)$/.test(text)) return true;
  if (/^(kuidas sul laheb|how are you|kes sa oled|mis su nimi on)$/.test(text)) return true;
  if (/\b(mina olen|ma olen|mu nimi on|my name is|i am)\b/.test(text) && text.split(/\s+/).length <= 12) return true;
  if (/\b(tundub|paistab|naib)\b.*\b(hea|korras|ok|okei|sobiv)\b/.test(text) && text.split(/\s+/).length <= 12) return true;
  if (/^(kas )?(koik|k6ik|kik).*\b(hea|korras|ok|okei)\b/.test(text)) return true;
  return false;
}

function isShortRetrievalFollowup(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text) return false;
  return /^(jah|jaa|jep|ok|okei|selge|sobib|hea|vaga hea|ei)$/.test(text);
}

function isAffirmativeRetrievalFollowup(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text) return false;
  return /^(jah|jaa|jep|ok|okei|palun|sobib|1|2|3)$/.test(text);
}

function isAssistantCapabilityQuestion(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text) return false;
  const asksAssistant =
    /^(kas\s+)?(sa|sina|te|teie)\s+(saad|saaksid|oskad|voiksid|v6iksid|aitad|aitaksid)\b/.test(text) ||
    /\b(kas\s+)?(sa|sina|te|teie)\b.{0,24}\b(saaksid|saad|oskad|aitad|aitaksid|voiksid|v6iksid)\b/.test(text);
  const asksWork = /\b(aita|aidata|teha|kirjutada|koostada|parandada|vormistada)\b/.test(text);
  return asksAssistant || (asksWork && /^(kas\s+)?(sa|sina|te|teie)\b/.test(text));
}

function hasKnowledgeQuestionShape(message = "") {
  const raw = String(message || "");
  const text = normalizeSourceNeedText(raw).replace(/[.!?\s]+$/g, "");
  if (!text || text.length < 8) return false;
  if (isAssistantCapabilityQuestion(message)) return false;
  const hasQuestionMark = raw.includes("?");
  const startsAsQuestion =
    /^(kas|mis|mida|millest|millised|milliseid|milline|kuidas|miks|kes|kus|millal|what|which|how|why|who|where|when)\b/.test(text);
  const asksSynthesis =
    /\b(murekoht|murekohad|probleem|probleemid|kitsaskoht|kitsaskohad|puudus|puudused|valjakutse|valjakutsed|ulevaade|kokkuvote|vordle|analuusi|selgita|kirjelda|kirjeldatud|mainitud|kasitletud|raagitud|toodud|soovitused|praktika|kogemus|uuring|juhend|materjal|allikas)\b/.test(text);
  const asksAboutPresenceOrUse =
    /\b(kasutatakse|kasutab|kasutavad|olemas|pakutakse|leidub|mainitakse|on\s+kirjas|kas\s+on)\b/.test(text);
  return hasQuestionMark || startsAsQuestion || asksSynthesis || asksAboutPresenceOrUse;
}

function isSubstantiveKnowledgeQuestion(message = "") {
  if (isLikelyConversationalTurn(message) || isAssistantCapabilityQuestion(message)) return false;
  const text = normalizeSourceNeedText(message);
  if (!text) return false;
  if (hasKnowledgeQuestionShape(message)) return true;
  const contentTokens = text
    .split(/\s+/)
    .filter(token => token.length >= 4)
    .filter(token => !/^(seda|selle|sellest|siin|seal|tana|praegu|palun|lihtsalt)$/.test(token));
  return contentTokens.length >= 5 &&
    /\b(ulevaade|kokkuvote|selgita|kirjelda|analuusi|vordle|suntees|materjalides|allikates)\b/.test(text);
}

function isSubstantiveUserText(message = "") {
  if (isLikelyConversationalTurn(message) || isAssistantCapabilityQuestion(message)) return false;
  const raw = String(message || "");
  const text = normalizeSourceNeedText(raw).replace(/[.!?\s]+$/g, "");
  if (!text) return false;
  const tokens = text
    .split(/\s+/)
    .filter(token => token.length >= 2)
    .filter(token => !/^(ma|mul|minu|sa|sina|te|teie|see|seda|selle|seal|siin|ja|ning|aga|voi|v6i|on|oli|olen|oled|oleme|palun)$/.test(token));
  if (raw.includes("?") && tokens.length >= 1) return true;
  return tokens.length >= 2 || text.length >= 16;
}

function isServiceJurisdictionLookup(message = "") {
  const text = normalizeSourceNeedText(message);
  if (!text) return false;
  const mentionsService = /\b[a-z0-9]*teenus[a-z0-9]*\b/u.test(text);
  const mentionsJurisdiction = /\b(kov|kohalik|kohaliku|omavalitsus|omavalitsuse|riik|riigi|riiklik|riiklikud|riikliku)\b/.test(text);
  const asksClassification = /\b(kas|on|voi|kumma|kumb|kuulub|korraldab|vastutab|vastutus)\b/.test(text);
  return mentionsService && mentionsJurisdiction && asksClassification;
}

function isTargetGroupRetrievalFollowup(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text || text.length > 90) return false;
  return /\b(laps|lapse|lapsele|lapsed|laste|alaealine|alaealisele|pere|perele|vanem|vanemale|eakas|eakale|vanur|vanurile|puue|puudega|erivajadus|erivajadusega|hooldusvajadus|hooldusvajadusega|kriis|kriisis)\b/.test(text);
}

function isSourceAnchoredRetrievalFollowup(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text || text.length > 120) return false;
  if (/^(ei|selge|aitah|tanan|ok|okei)$/.test(text)) return false;
  if (/^(jah|jaa|jep|palun|tee|jah tahan|tahan|sobib)$/.test(text)) return true;
  if (/^(eesti|eestis|soome|soomes|ott|tootukassa|töötukassa)$/.test(text)) return true;
  return /\b(seal|sealt|selles|sellel|artiklis|artikli|allikas|allikas|tekstis|mainitakse|mainitud|naide|näide|eesti|soome|ott|tootukassa|töötukassa)\b/.test(text);
}

function isBroadSourceSynthesisFollowup(message = "") {
  const text = normalizeSourceNeedText(message).replace(/[.!?\s]+$/g, "");
  if (!text || text.length > 260) return false;
  const hasBroadIntent = /\b(vordle|võrdle|vordlus|võrdlus|analuusi|analüüsi|analyysi|analyseeri|suntees|süntees|sunteesi|sünteesi|ulevaade|ülevaade|laiemalt|laiem|teiste|teisi|mitme|mitmeid|mitu|erinevused|sarnasused|kasitlused|käsitlused|peamised|kokkuvotte|kokkuvõtte)\b/.test(text);
  const hasSourceScope = /\b(seda|selle|sellest|artiklit|artikli|artiklite|allikat|allikate|materjali|materjalide|tekstide|ajakirjas|sotsiaaltoo|sotsiaaltöö)\b/.test(text);
  return hasBroadIntent && hasSourceScope;
}

export function shouldUseExternalSourcesForTurn(message = "", options = {}) {
  if (options?.previousSourceUseRequest) return false;
  if (isAssistantSourceUiIssue(message)) return false;
  if (isServiceJurisdictionLookup(message)) return true;
  if (options?.hasHistory && options?.hasRecentAssistantSources && isBroadSourceSynthesisFollowup(message)) return true;
  if (options?.hasHistory && options?.hasRecentAssistantSources && isSourceAnchoredRetrievalFollowup(message)) return true;
  if (options?.hasHistory && isAffirmativeRetrievalFollowup(message)) return true;
  if (isLikelyConversationalTurn(message)) {
    return Boolean(options?.defaultToExternalSources && options?.hasHistory && isShortRetrievalFollowup(message));
  }
  if (isAssistantCapabilityQuestion(message)) return false;
  if (options?.forceSources || options?.sourceLookupRequest || options?.defaultToExternalSources) return true;

  const text = normalizeSourceNeedText(message);
  if (!text) return false;
  if (options?.hasHistory && isTargetGroupRetrievalFollowup(text)) return true;

  if (/(?:§|paragrahv|seadus|maarus|maaruse|riigi teataja|riigiteataja|\bshs\b|oigusakt|regulation|law)\b/.test(text)) {
    return true;
  }

  if (isSubstantiveKnowledgeQuestion(message)) {
    return true;
  }

  const socialDomain =
    /(sotsiaal|hoolekan|hooldus|toet|teenus|abi|laps|lapse|laste|pere|eakas|eakale|vanur|puue|puudega|erivajad|lastekaitse|\bkov\b|omavalitsus|vald|valla|vallas|linn|linna|linnas|taotl|taot|elukoht|rahvastikuregister|\bska\b|sotsiaalkindlustusamet|tookassa|tootukassa|toovoime|tooturg|toohoive|tehisintellekt|\bai\b|algoritm|automatiseer|andmepohine)/.test(text);
  const asksForRuleOrProcedure =
    /(kas|mis|mida|millal|kuidas|kuhu|kellele|kes|milline|tingimus|tingimused|noue|nouded|tahtaeg|summa|maar|maara|kontakt|vorm|saab|voib|peab|tuleb|tohib|kohustus|oigus|menetlus|leia|otsi|loetle|nimeta|koik|k6ik|kõik|olemas|apply|application|eligible|requirement|deadline|amount|contact|form)/.test(text);
  const mentalHealthDigitalSupportDomain =
    /(vaimne tervis|vaimse tervise|psuhho|eneseabi|digitaalne tugi|vestlusrobot|juturobot|chatbot)/.test(text);
  const broadEvidenceQuestion =
    /(kasutus|kasutatakse|kasutab|maini|mainitud|kirjeld|kasitletud|esile|kerkinud|valdkond|naide|näide)/.test(text);

  if ((socialDomain || mentalHealthDigitalSupportDomain) && (asksForRuleOrProcedure || broadEvidenceQuestion)) {
    return true;
  }

  return isSubstantiveUserText(message);
}
