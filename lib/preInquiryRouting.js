function normalizeString(value, maxLength = 1_000) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

function textIncludesAny(value, needles = []) {
  const text = String(value || "").toLocaleLowerCase("et");
  return needles.some((needle) => needle && text.includes(String(needle).toLocaleLowerCase("et")));
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

  if (entryType === "KOV_CONTACT") {
    reasons.push("Tegu on KOV sotsiaalvaldkonna kontaktiga, mis sobib esmaseks pöördumiseks ja abivajaduse täpsustamiseks.");
  } else {
    reasons.push("Tegu on teenuseosutajaga, kelle poole saab pöörduda teenuse tingimuste või sobivuse täpsustamiseks.");
  }

  if (municipality && textIncludesAny([
    entry.municipalityName,
    entry.county,
    entry.address,
    entry.providerProfile?.serviceArea,
    ...(entry.providerProfile?.serviceItems || []).flatMap((service) => [
      service?.serviceArea,
      service?.areaDescription,
      service?.county,
      ...(service?.municipalityIds || [])
    ])
  ].join(" "), [municipality])) {
    reasons.push("Piirkond kattub sisestatud KOV-i või teeninduspiirkonnaga.");
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
  } else if (needAreas.length && textIncludesAny([
    entry.description,
    entry.providerProfile?.shortDescription,
    entry.providerProfile?.longDescription,
    ...(entry.providerProfile?.services || []),
    ...(entry.providerProfile?.serviceCategories || []),
    ...(entry.providerProfile?.targetGroups || [])
  ].join(" "), needAreas)) {
    reasons.push("Kirjeldus, teenusekategooria või sihtrühm kattub eelkaardistuse vajadussignaalidega.");
  }

  if (entry.email || entry.providerProfile?.ownerId) {
    reasons.push("Kontaktikanal on olemas ja pöördumise saab ette valmistada.");
  }

  return {
    reasons: reasons.slice(0, 4),
    reason: reasons.slice(0, 3).join(" "),
    matchedServices: [...new Set(matchedServices)].slice(0, 4)
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
  if (municipality && needAreas.length && suggestions.length) {
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
