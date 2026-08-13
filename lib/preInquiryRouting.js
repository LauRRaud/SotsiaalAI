import { resolveProviderRecipientUserId } from "@/lib/org/profileRecipient";

function normalizeString(value, maxLength = 1_000) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

function textIncludesAny(value, needles = []) {
  const text = String(value || "").toLocaleLowerCase("et");
  return needles.some((needle) => needle && text.includes(String(needle).toLocaleLowerCase("et")));
}

function normalizedRegion(value) {
  return normalizeString(value, 300)
    .toLocaleLowerCase("et")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(?:vald|linn|maakond|county|municipality)\b/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function regionMatchEvidence(entry, municipality) {
  const requested = normalizedRegion(municipality);
  if (!requested) return { regionMatch: false, regionLevel: "MISSING_INPUT", nationalService: false };

  const municipalityValue = normalizedRegion(entry.municipalityName);
  const countyValue = normalizedRegion(entry.county);
  const serviceAreas = [
    entry.providerProfile?.serviceArea,
    ...(entry.providerProfile?.serviceItems || []).flatMap((service) => [
      service?.serviceArea,
      service?.areaDescription,
      service?.county,
      ...(service?.municipalityIds || [])
    ])
  ].filter(Boolean);
  const nationalService = serviceAreas.some((value) =>
    /\b(?:uleriigiline|kogu\s+eesti|eesti\s+ulene|nationwide|national)\b/u.test(normalizedRegion(value))
  );
  const areaValues = serviceAreas.map(normalizedRegion).filter(Boolean);
  const exactMunicipality = municipalityValue === requested
    || areaValues.some((value) => value === requested || value.includes(requested));
  const sameCounty = Boolean(countyValue && (countyValue === requested || countyValue.includes(requested) || requested.includes(countyValue)));

  if (exactMunicipality) return { regionMatch: true, regionLevel: "MUNICIPALITY", nationalService: false };
  if (sameCounty) return { regionMatch: true, regionLevel: "COUNTY", nationalService: false };
  if (nationalService) return { regionMatch: true, regionLevel: "NATIONAL", nationalService: true };
  return { regionMatch: false, regionLevel: "NONE", nationalService: false };
}

export function explainPreInquiryRecipientMatch(entry = {}, context = {}) {
  const municipality = normalizeString(context.municipality, 180).toLocaleLowerCase("et");
  const needAreas = Array.isArray(context.needAreas)
    ? context.needAreas.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  const keywords = Array.isArray(context.keywords)
    ? context.keywords.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  const reasons = [];
  const matchedServices = [];
  const entryType = entry.type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT";
  const regionEvidence = regionMatchEvidence(entry, municipality);

  if (entryType === "KOV_CONTACT") {
    reasons.push("Tegu on KOV sotsiaalvaldkonna kontaktiga, mis sobib esmaseks pöördumiseks ja abivajaduse täpsustamiseks.");
  } else {
    reasons.push("Tegu on teenuseosutajaga, kelle poole saab pöörduda teenuse tingimuste või sobivuse täpsustamiseks.");
  }

  if (regionEvidence.regionLevel === "MUNICIPALITY") {
    reasons.push("Piirkond kattub sisestatud KOV-i või teeninduspiirkonnaga.");
  } else if (regionEvidence.regionLevel === "COUNTY") {
    reasons.push("Teeninduspiirkond kattub sisestatud KOV-i maakonnaga.");
  } else if (regionEvidence.regionLevel === "NATIONAL") {
    reasons.push("Teenus on teenusekaardil märgitud üleriigiliseks.");
  }

  for (const service of entry.providerProfile?.serviceItems || []) {
    const serviceText = [
      service?.name,
      service?.description,
      service?.longDescription,
      service?.includesText,
      service?.excludesText,
      service?.additionalInfo,
      service?.category,
      service?.priceDescription,
      service?.availabilityStatus,
      service?.availabilityDescription,
      service?.serviceArea,
      service?.serviceAreaType,
      service?.county,
      service?.areaDescription,
      service?.requiredDocumentsNote,
      service?.referralNotes,
      service?.contactMode,
      ...(service?.categories || []),
      ...(service?.ageGroups || []),
      ...(service?.targetGroups || []),
      ...(service?.requesterRoles || []),
      ...(service?.needTags || []),
      ...(service?.lifeDomains || []),
      ...(service?.deliveryModes || []),
      ...(service?.municipalityIds || []),
      ...(service?.serviceLanguages || []),
      ...(service?.inquiryLanguages || []),
      ...(service?.communicationSupport || [])
    ].join(" ");
    if (textIncludesAny(serviceText, [...needAreas, ...keywords])) {
      matchedServices.push(service.name);
    }
  }
  if (matchedServices.length) {
    reasons.push(`Teenusekirjete seast kattus: ${matchedServices.slice(0, 3).join(", ")}.`);
  } else if ((needAreas.length || keywords.length) && textIncludesAny([
    entry.description,
    entry.providerProfile?.shortDescription,
    entry.providerProfile?.longDescription,
    ...(entry.providerProfile?.services || []),
    ...(entry.providerProfile?.serviceCategories || []),
    ...(entry.providerProfile?.targetGroups || [])
  ].join(" "), [...needAreas, ...keywords])) {
    reasons.push("Kirjeldus, teenusekategooria või sihtrühm kattub eelkaardistuse vajadussignaalidega.");
  }

  /* Lubadus „kontaktikanal on olemas" peab vastama sellele, kuhu pöördumine
     PÄRISELT jõuab. Org-profiili alles jäänud `ownerId` on ainult päritolu ja
     ei ole kanal — ilma selle kontrollita lubaks selgitus kättesaadavust,
     mida marsruutimine enam ei paku. */
  const channelMatch = Boolean(entry.email || resolveProviderRecipientUserId(entry.providerProfile));
  if (channelMatch) {
    reasons.push("Kontaktikanal on olemas ja pöördumise saab ette valmistada.");
  }

  const needMatch = Boolean(matchedServices.length || reasons.some((reason) => reason.startsWith("Kirjeldus,")));
  return {
    reasons: reasons.slice(0, 4),
    reason: reasons.slice(0, 3).join(" "),
    matchedServices: [...new Set(matchedServices)].slice(0, 4),
    routingEvidence: {
      ...regionEvidence,
      needMatch,
      channelMatch
    }
  };
}

export function buildPreInquiryRoutingConfidence({
  municipality = "",
  needAreas = [],
  suggestions = [],
  needsMoreInput = false,
  suggestedNextSteps = "",
  urgencyLevel = ""
} = {}) {
  if (suggestedNextSteps === "CRISIS" || urgencyLevel === "URGENT") {
    return {
      level: "CRISIS",
      label: "Kiireloomuline kontroll",
      text: "Kirjelduses on ohusignaale. Enne tavalist kontaktisoovitust tuleb kontrollida, kas vaja on kiiret abi või kriisisuunamist."
    };
  }
  if (needsMoreInput) {
    return {
      level: "LOW",
      label: "Vajab täpsustust",
      text: "Kontaktisoovituse kindlus on madal, sest enne adressaadi valimist on vaja veel olukorra, piirkonna või kiireloomulisuse infot."
    };
  }
  const verifiedSuggestion = suggestions.find((suggestion) => {
    const evidence = suggestion?.routingEvidence;
    return evidence?.regionMatch && evidence?.needMatch && evidence?.channelMatch;
  });
  if (municipality && needAreas.length && verifiedSuggestion) {
    return {
      level: "HIGH",
      label: "Hea vastavus",
      text: "Kontaktisoovitus põhineb piirkonnal, eelkaardistuse vajadussignaalidel ja teenusekaardi avaldatud andmetel."
    };
  }
  if ((municipality || needAreas.length) && suggestions.length) {
    return {
      level: "MEDIUM",
      label: "Osaline vastavus",
      text: "Kontaktisoovitus on võimalik, kuid enne saatmist tasub üle kontrollida piirkond, vajaduse kirjeldus või sobiv teenusesuund."
    };
  }
  return {
    level: "LOW",
    label: "Nõrk vastavus",
    text: "SotsiaalAI ei leidnud piisavalt kindlat vastet. Täpsusta kirjeldust, KOV-i või vajaduse valdkonda."
  };
}
