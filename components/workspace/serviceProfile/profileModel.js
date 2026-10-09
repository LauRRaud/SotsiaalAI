/**
 * Teenuseprofiili mudel ILMA JSX-ita: valikute loendid, vormi kuju, vaadete
 * loend ja nende seis, avaldamise kontroll ning salvestatav keha.
 *
 * MIKS OMA FAIL. Kuni see kõik elas failis ../WorkspaceFeaturePage.jsx vormi
 * joonistuse vahel, ei saanud testida, mida leht serverile saadab, millal
 * avaldamine on lukus ega kuhu „puudu" rida inimese viib. Siin on puhtad
 * funktsioonid; leht (`ServiceProfileSurface`) hoiab olekut ja teeb päringud,
 * vaated (ProfileViews.jsx, ServiceViews.jsx, LocationViews.jsx) ainult
 * joonistavad.
 *
 * KOLM TASET. Profiil ise (organisatsioon, kontakt, piirkond, avaldamine),
 * avatud teenus ja avatud teeninduskoht. Igal tasemel on oma vaadete loend;
 * avatud teenus või koht vahetab lava vaated enda omade vastu.
 *
 * Tekstid tulevad kataloogist nimeruumist `workspace_feature_pages.service_profile`
 * (`tp(võti, varutekst)`). Valikute VÄÄRTUSED on eestikeelsed sõnad, sest need
 * salvestuvad sellisena andmebaasi ja teenusekaardi otsing loeb neid; silt
 * tuleb alati kataloogist.
 */

import { SERVICE_AVAILABILITY_DESCRIPTION_MAX_LENGTH } from "@/lib/serviceAvailability";

export const SERVICE_PROFILE_KEY = "workspace_feature_pages.service_profile";

/* Kättesaadavuse täpsustuse lõikab server 500 märgi peale; väli ütleb sama piiri. */
export const AVAILABILITY_NOTE_LIMIT = SERVICE_AVAILABILITY_DESCRIPTION_MAX_LENGTH;

/* --- Loendiväljad: vormis komadega tekst, serveris massiiv ------------------ */

export function joinList(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

/**
 * KOMAGA VALIKUVÄÄRTUSED. Kolme kategooria nimes on koma („Pere, lapse ja noore
 * tugi", „Puue, rehabilitatsioon ja abivahendid", „Töö, õppimine ja
 * osalemine"), aga loend hoitakse vormis komadega tekstina. Lihtne tükeldamine
 * tegi neist kaks või kolm olematut kategooriat („Pere" ja „lapse ja noore
 * tugi"): lahter ei jäänud valituks ja serverisse läks vale kategooria. See
 * viga oli juba vanal lehel. Tükeldamine tunneb nüüd valikute täisväärtused ära
 * enne, kui teksti komade kohalt lõikab; inimese käsitsi kirjutatud loendid
 * (komaga eraldatud) töötavad edasi.
 */
let commaValues = null;
function valuesWithComma() {
  if (!commaValues) {
    commaValues = Object.values(SERVICE_PROFILE_OPTIONS)
      .flat()
      .map((option) => option[0])
      .filter((optionValue) => /[,;]/.test(optionValue))
      /* Pikem enne: lühem väärtus ei tohi pikema seest tükki ära võtta. */
      .sort((a, b) => b.length - a.length);
  }
  return commaValues;
}

export function splitList(value) {
  let text = String(value || "");
  const kept = [];
  for (const optionValue of valuesWithComma()) {
    if (!text.includes(optionValue)) continue;
    /* Kohatäide (erakasutuse märgid) ei sisalda eraldajaid ega teki inimese kirjutatud tekstist. */
    text = text.split(optionValue).join(`\uE000${kept.length}\uE001`);
    kept.push(optionValue);
  }
  return text
    .split(/[,;\n\r]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^\uE000(\d+)\uE001$/.exec(part);
      return match ? kept[Number(match[1])] : part.replace(/\uE000\d+\uE001/g, (token) => kept[Number(token.slice(1, -1))]);
    });
}

export function toggleListValue(value, optionValue) {
  const selected = new Set(splitList(value));
  if (selected.has(optionValue)) selected.delete(optionValue);
  else selected.add(optionValue);
  return [...selected].join(", ");
}

/* --- Valikud: [väärtus, võti kataloogis, varutekst] -------------------------- */

export const SERVICE_PROFILE_OPTIONS = Object.freeze({
  category: [
    ["KOV sotsiaalteenus", "category_options.kov_social_service", "KOV sotsiaalteenus"],
    ["Nõustamine ja juhendamine", "category_options.counselling_guidance", "Nõustamine ja juhendamine"],
    ["Pere, lapse ja noore tugi", "category_options.family_child_youth", "Pere, lapse ja noore tugi"],
    ["Puue, rehabilitatsioon ja abivahendid", "category_options.disability_rehabilitation", "Puue, rehabilitatsioon ja abivahendid"],
    ["Kodune abi ja hooldus", "category_options.home_care", "Kodune abi ja hooldus"],
    ["Toimetulek ja võlanõustamine", "category_options.coping_debt", "Toimetulek ja võlanõustamine"],
    ["Eluase ja turvalisus", "category_options.housing_safety", "Eluase ja turvalisus"],
    ["Transport ja liikumisabi", "category_options.transport", "Transport ja liikumisabi"],
    ["Töö, õppimine ja osalemine", "category_options.work_learning_participation", "Töö, õppimine ja osalemine"],
    ["Digi- ja asjaajamisabi", "category_options.digital_admin_help", "Digi- ja asjaajamisabi"],
    ["Muu teenus", "category_options.other", "Muu teenus"]
  ],
  targetGroup: [
    ["Puudega inimene", "target_group_options.disabled_person", "Puudega inimene"],
    ["Psüühilise erivajadusega inimene", "target_group_options.psychosocial_disability", "Psüühilise erivajadusega inimene"],
    ["Intellektipuudega inimene", "target_group_options.intellectual_disability", "Intellektipuudega inimene"],
    ["Vaimse tervise murega inimene", "target_group_options.mental_health_concern", "Vaimse tervise murega inimene"],
    ["Toimetulekuraskustes inimene", "target_group_options.coping_difficulty", "Toimetulekuraskustes inimene"],
    ["Eluasemeraskustes inimene", "target_group_options.housing_difficulty", "Eluasemeraskustes inimene"],
    ["Võlgadega inimene", "target_group_options.debt_difficulty", "Võlgadega inimene"],
    ["Sõltuvusprobleemiga inimene", "target_group_options.addiction_concern", "Sõltuvusprobleemiga inimene"],
    ["Vägivalla või kriisiolukorra kogemusega inimene", "target_group_options.violence_crisis_experience", "Vägivalla või kriisiolukorra kogemusega inimene"],
    ["Hooldaja või lähedane", "target_group_options.caregiver_close_person", "Hooldaja või lähedane"],
    ["Lapsevanem", "target_group_options.parent", "Lapsevanem"],
    ["Pere", "target_group_options.family", "Pere"],
    ["Eestkostja", "target_group_options.guardian", "Eestkostja"],
    ["Töötu või tööotsija", "target_group_options.unemployed_jobseeker", "Töötu või tööotsija"],
    ["Sotsiaalselt isoleeritud inimene", "target_group_options.socially_isolated", "Sotsiaalselt isoleeritud inimene"],
    ["Muu sihtrühm", "target_group_options.other", "Muu sihtrühm"]
  ],
  language: [
    ["eesti", "language_options.et", "Eesti"],
    ["inglise", "language_options.en", "Inglise"],
    ["vene", "language_options.ru", "Vene"],
    ["muu", "language_options.other", "Muu"]
  ],
  ageGroup: [
    ["Laps", "age_group_options.child", "Laps"],
    ["Noor", "age_group_options.youth", "Noor"],
    ["Tööealine inimene", "age_group_options.working_age", "Tööealine inimene"],
    ["Täisealine inimene", "age_group_options.adult", "Täisealine inimene"],
    ["Eakas inimene", "age_group_options.elder", "Eakas inimene"]
  ],
  requesterRole: [
    ["Inimene ise", "requester_role_options.self", "Inimene ise"],
    ["Lapsevanem või eestkostja", "requester_role_options.parent_guardian", "Lapsevanem või eestkostja"],
    ["Lähedane", "requester_role_options.close_person", "Lähedane"],
    ["Spetsialist", "requester_role_options.specialist", "Spetsialist"]
  ],
  needTag: [
    ["Hooldusvajadus", "need_options.care_need", "Hooldusvajadus"],
    ["Toimetulekuraskus", "need_options.coping", "Toimetulekuraskus"],
    ["Hoolduskoormus", "need_options.caregiver_burden", "Hoolduskoormus"],
    ["Lapse heaolu", "need_options.child_wellbeing", "Lapse heaolu"],
    ["Vaimne tervis", "need_options.mental_health", "Vaimne tervis"],
    ["Liikumine ja transport", "need_options.mobility_transport", "Liikumine ja transport"],
    ["Asjaajamine", "need_options.administration", "Asjaajamine"]
  ],
  lifeDomain: [
    ["Kodu ja igapäevaelu", "life_domain_options.home_daily", "Kodu ja igapäevaelu"],
    ["Tervis", "life_domain_options.health", "Tervis"],
    ["Pere ja suhted", "life_domain_options.family", "Pere ja suhted"],
    ["Haridus", "life_domain_options.education", "Haridus"],
    ["Töö ja hõive", "life_domain_options.work", "Töö ja hõive"],
    ["Eluase", "life_domain_options.housing", "Eluase"]
  ],
  deliveryMode: [
    ["Kohapeal", "delivery_mode_options.onsite", "Kohapeal"],
    ["Inimese kodus", "delivery_mode_options.home", "Inimese kodus"],
    ["Veebis", "delivery_mode_options.online", "Veebis"],
    ["Telefonitsi", "delivery_mode_options.phone", "Telefonitsi"],
    ["Piirkondlikult", "delivery_mode_options.regional", "Piirkondlikult"]
  ],
  communicationSupport: [
    ["Lihtsas keeles selgitus", "communication_support_options.simple_language", "Lihtsas keeles selgitus"],
    ["Tõlk või keeleabi", "communication_support_options.interpreter", "Tõlk või keeleabi"],
    ["Ligipääsetav suhtlus", "communication_support_options.accessible", "Ligipääsetav suhtlus"]
  ],
  organizationType: [
    ["", "organization_type_options.unspecified", "Täpsustamata"],
    ["MTÜ", "organization_type_options.ngo", "MTÜ"],
    ["SA", "organization_type_options.foundation", "SA"],
    ["Ettevõte", "organization_type_options.company", "Ettevõte"],
    ["Avalik asutus", "organization_type_options.public", "Avalik asutus"],
    ["Muu", "organization_type_options.other", "Muu"]
  ],
  areaType: [
    ["", "area_type_options.unspecified", "Täpsustamata"],
    ["Üleriigiline", "area_type_options.national", "Üleriigiline"],
    ["Maakondlik", "area_type_options.county", "Maakondlik"],
    ["KOV põhine", "area_type_options.municipality", "KOV põhine"],
    ["Teeninduskoha põhine", "area_type_options.location", "Teeninduskoha põhine"],
    ["Veebiteenus", "area_type_options.online", "Veebiteenus"]
  ],
  availability: [
    ["", "availability_options.unspecified", "Täpsustamata"],
    ["accepting", "availability_options.accepting", "Võtab uusi pöördumisi vastu"],
    ["waitlist", "availability_options.waitlist", "Ooteajaga vastuvõtt"],
    ["not_accepting", "availability_options.not_accepting", "Praegu ei võta uusi pöördumisi"]
  ],
  requirement: [
    ["", "requirement_options.unspecified", "Täpsustamata"],
    ["Ei", "requirement_options.no", "Ei"],
    ["Jah", "requirement_options.yes", "Jah"],
    ["Sõltub olukorrast", "requirement_options.depends", "Sõltub olukorrast"]
  ],
  contactMode: [
    ["", "contact_mode_options.unspecified", "Täpsustamata"],
    ["Platvormisisene eelpöördumine", "contact_mode_options.platform", "Platvormisisene eelpöördumine"],
    ["E-post", "contact_mode_options.email", "E-post"],
    ["Telefon", "contact_mode_options.phone", "Telefon"],
    ["Veebivorm", "contact_mode_options.form", "Veebivorm"]
  ],
  fee: [
    ["UNKNOWN", "fee.unknown", "Täpsustamata"],
    ["FREE", "fee.free", "Tasuta"],
    ["PAID", "fee.paid", "Tasuline"],
    ["AGREEMENT", "fee.agreement", "Kokkuleppel"],
    ["MIXED", "fee.mixed", "Mitut tüüpi"]
  ],
  status: [
    ["DRAFT", "status.draft", "Avaldamata"],
    ["REVIEW", "status.review", "Ülevaatusel"],
    ["PUBLISHED", "status.published", "Avaldatud"],
    ["HIDDEN", "status.hidden", "Peidetud"]
  ],
  contactStrategy: [
    ["ORGANIZATION", "contact_strategy.organization", "Kasuta organisatsiooni põhikontakti"],
    ["CUSTOM", "contact_strategy.custom", "Määra teenusele eraldi kontakt"]
  ]
});

/** Ühe rühma valikud siltidega: `[{ value, label }]`. */
export function serviceProfileOptions(tp, group) {
  return (SERVICE_PROFILE_OPTIONS[group] || []).map(([value, key, fallback]) => ({ value, label: tp(key, fallback) }));
}

/** Kõik rühmad korraga: leht ehitab need ühe korra keele kohta. */
export function serviceProfileOptionSets(tp) {
  return Object.fromEntries(Object.keys(SERVICE_PROFILE_OPTIONS).map((group) => [group, serviceProfileOptions(tp, group)]));
}

/**
 * Valitud väärtus, mida loendis ei ole (varasem valik või käsitsi sisestatud
 * sõna), jääb lahtrina näha: muidu salvestuks see edasi ilma, et inimene seda
 * näeks või maha saaks võtta.
 */
export function optionsWithSelected(options, value) {
  const known = new Set(options.map((option) => option.value));
  const extra = [...new Set(splitList(value))].filter((item) => !known.has(item));
  return extra.length ? [...options, ...extra.map((item) => ({ value: item, label: item }))] : options;
}

/** Valitud väärtuste sildid (ülevaate kokkuvõtte jaoks). */
export function selectedLabels(value, options) {
  const labelByValue = new Map(options.map((option) => [option.value, option.label]));
  return splitList(value).map((item) => labelByValue.get(item) || item);
}

/** Valiku silt; tundmatu väärtuse asemel tühi tekst, mitte kood. */
export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || "";
}

/**
 * Kättesaadavuse valikud. Kui teenusel on varasem vabatekstiline seis, mida
 * kolme oleku hulgas ei ole, jääb see valikuna alles, kuni osutaja valib uue.
 */
export function availabilityChoices(options, value, legacyLabel) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: `${legacyLabel}: ${value}` }];
}

/* --- Vormi kuju ---------------------------------------------------------------- */

export function createServiceProfileLocationForm(location = null, index = 0, profile = null) {
  const mapEntry = profile?.serviceMapEntry || null;
  return {
    clientId: location?.id || `location-${index + 1}`,
    label: location?.label || "",
    address: location?.address || location?.normalizedAddress || (index === 0 ? profile?.address || "" : ""),
    normalizedAddress: location?.normalizedAddress || (index === 0 ? profile?.normalizedAddress || mapEntry?.normalizedAddress || "" : ""),
    county: location?.county || profile?.county || "",
    latitude: location?.latitude ?? (index === 0 ? mapEntry?.latitude ?? "" : ""),
    longitude: location?.longitude ?? (index === 0 ? mapEntry?.longitude ?? "" : ""),
    adsObjectId: location?.adsObjectId || (index === 0 ? mapEntry?.adsObjectId || "" : ""),
    geocodingProvider: location?.geocodingProvider || location?.geocodingRaw?.provider || (index === 0 ? mapEntry?.geocodingRaw?.provider || "" : ""),
    geocodingSuggestionToken: location?.geocodingSuggestionToken || "",
    phone: location?.phone || "",
    email: location?.email || "",
    website: location?.website || "",
    openingHours: location?.openingHours || "",
    accessibilityInfo: location?.accessibilityInfo || "",
    mapVisible: location?.mapVisible !== false,
    status: location?.status || (profile?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(location?.sortOrder)) ? Number(location.sortOrder) : index
  };
}

export function createServiceProfileServiceForm(service = null, index = 0, profile = null) {
  const hasServiceContact = Boolean(
    String(service?.contactName || "").trim() ||
    String(service?.phone || "").trim() ||
    String(service?.email || "").trim() ||
    String(service?.website || "").trim()
  );
  return {
    id: service?.id || "",
    /* A4: seos loakataloogiga säilib kliendipoolses mudelis, et vorm ei
       teeskleks seost olematuks. VÄLJA temast ei tehta — `serviceKey` muutub
       ainult eraldi sidumisoperatsiooniga ja server ei loe teda PUT-ist. */
    serviceKey: service?.serviceKey || null,
    name: service?.name || "",
    description: service?.description || "",
    longDescription: service?.longDescription || "",
    includesText: service?.includesText || "",
    excludesText: service?.excludesText || "",
    additionalInfo: service?.additionalInfo || "",
    category: service?.category || "",
    categories: joinList(service?.categories),
    ageGroups: joinList(service?.ageGroups),
    targetGroups: joinList(service?.targetGroups),
    requesterRoles: joinList(service?.requesterRoles),
    needTags: joinList(service?.needTags),
    lifeDomains: joinList(service?.lifeDomains),
    deliveryModes: joinList(service?.deliveryModes),
    serviceArea: service?.serviceArea || profile?.serviceArea || "",
    serviceAreaType: service?.serviceAreaType || "",
    county: service?.county || profile?.county || "",
    municipalityIds: joinList(service?.municipalityIds),
    areaDescription: service?.areaDescription || "",
    serviceLanguages: joinList(service?.serviceLanguages),
    inquiryLanguages: joinList(service?.inquiryLanguages),
    communicationSupport: joinList(service?.communicationSupport),
    feeType: service?.feeType || profile?.feeType || "UNKNOWN",
    priceDescription: service?.priceDescription || "",
    availabilityStatus: service?.availabilityStatus || "",
    availabilityDescription: service?.availabilityDescription || "",
    availability: service?.availability || null,
    availabilityFingerprint: service?.availabilityFingerprint || "",
    directContactAllowed: service?.directContactAllowed || "",
    requiresKovAssessment: service?.requiresKovAssessment || "",
    requiresKovDecision: service?.requiresKovDecision || "",
    requiresSkaReferral: service?.requiresSkaReferral || "",
    requiresSpecialistReferral: service?.requiresSpecialistReferral || "",
    requiredDocumentsNote: service?.requiredDocumentsNote || "",
    referralNotes: service?.referralNotes || "",
    contactMode: service?.contactMode || "",
    contactStrategy: hasServiceContact ? "CUSTOM" : "ORGANIZATION",
    contactName: service?.contactName || "",
    phone: service?.phone || "",
    email: service?.email || "",
    website: service?.website || "",
    locationIds: Array.isArray(service?.locationIds) ? service.locationIds : [],
    acceptsPlatformPreInquiries: service?.acceptsPlatformPreInquiries ?? profile?.acceptsPlatformPreInquiries ?? true,
    acceptsEmailPreInquiries: service?.acceptsEmailPreInquiries ?? profile?.acceptsEmailPreInquiries ?? true,
    mapVisible: service?.mapVisible !== false,
    status: service?.status || (profile?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(service?.sortOrder)) ? Number(service.sortOrder) : index
  };
}

export function createServiceProfileForm(profile = null) {
  const mapEntry = profile?.serviceMapEntry || null;
  const serviceLocations = Array.isArray(profile?.serviceLocations) && profile.serviceLocations.length
    ? profile.serviceLocations.map((location, index) => createServiceProfileLocationForm(location, index, profile))
    : (profile?.address || mapEntry?.normalizedAddress)
        ? [createServiceProfileLocationForm(null, 0, profile)]
        : [];
  const serviceItems = Array.isArray(profile?.serviceItems) && profile.serviceItems.length
    ? profile.serviceItems.map((service, index) => createServiceProfileServiceForm(service, index, profile))
    : (Array.isArray(profile?.services) ? profile.services : []).map((name, index) =>
        createServiceProfileServiceForm({ name, sortOrder: index }, index, profile)
      );
  return {
    organizationName: profile?.organizationName || "",
    organizationType: profile?.organizationType || "",
    registryCode: profile?.registryCode || "",
    shortDescription: profile?.shortDescription || "",
    longDescription: profile?.longDescription || "",
    services: joinList(profile?.services),
    serviceCategories: joinList(profile?.serviceCategories),
    targetGroups: joinList(profile?.targetGroups),
    serviceArea: profile?.serviceArea || "",
    serviceAreaMunicipalityIds: joinList(profile?.serviceAreaMunicipalityIds),
    county: profile?.county || "",
    address: profile?.address || "",
    normalizedAddress: profile?.normalizedAddress || mapEntry?.normalizedAddress || "",
    latitude: mapEntry?.latitude ?? "",
    longitude: mapEntry?.longitude ?? "",
    adsObjectId: mapEntry?.adsObjectId || "",
    geocodingProvider: mapEntry?.geocodingRaw?.provider || "",
    geocodingSuggestionToken: profile?.geocodingSuggestionToken || "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    website: profile?.website || "",
    primaryContactName: profile?.primaryContactName || "",
    languages: joinList(profile?.languages),
    accessibilityInfo: profile?.accessibilityInfo || "",
    generalAccessibilityNote: profile?.generalAccessibilityNote || "",
    feeType: profile?.feeType || "UNKNOWN",
    mapVisible: Boolean(profile?.mapVisible),
    acceptsPlatformPreInquiries: profile?.acceptsPlatformPreInquiries !== false,
    acceptsEmailPreInquiries: profile?.acceptsEmailPreInquiries !== false,
    assistantRecommendationAllowed: profile?.assistantRecommendationAllowed === true,
    status: profile?.status || "DRAFT",
    serviceItems,
    serviceLocations
  };
}

/**
 * Kas vormil on muudatusi, mida serveris ei ole. Vorm sünnib profiilist
 * (`createServiceProfileForm`), seega on võrdlus sama funktsiooni väljundiga
 * täpne: uut välja lisades ei pea siia midagi juurde kirjutama.
 */
export function serviceProfileDirty(form, profile) {
  return JSON.stringify(form) !== JSON.stringify(createServiceProfileForm(profile || null));
}

/* --- Mis salvestub -------------------------------------------------------------- */

/* Server jätab nimeta teenuse ja sisuta teeninduskoha salvestamata. Samad
   reeglid on siin nimega, sest loend näitab nende järgi, mis ei salvestu. */
export const keepsService = (item) => Boolean(String(item?.name || "").trim());
export const keepsLocation = (item) => Boolean(String(item?.address || item?.normalizedAddress || item?.label || "").trim());

/**
 * Avatud teenuse või koha järjekorranumber pärast salvestamist: salvestamata
 * jäänud kirjed langevad eest ära ja järjekord nihkub. `-1`, kui avatud kirje
 * ise ei salvestunud.
 */
export function indexAfterSave(items, index, keeps) {
  const list = Array.isArray(items) ? items : [];
  if (!keeps(list[index])) return -1;
  return list.slice(0, index).filter(keeps).length;
}

/** Keha, mille leht saadab `PUT /api/service-provider/profile`. */
export function serviceProfileSavePayload(form, expectedUpdatedAt) {
  const primaryMapLocation =
    form.serviceLocations.find((item) =>
      item.mapVisible !== false &&
      String(item.address || item.normalizedAddress || "").trim()
    ) || form.serviceLocations.find((item) => String(item.address || item.normalizedAddress || "").trim()) || null;
  return {
    ...form,
    expectedUpdatedAt: expectedUpdatedAt || null,
    address: primaryMapLocation?.address || form.address,
    normalizedAddress: primaryMapLocation?.normalizedAddress || form.normalizedAddress,
    latitude: primaryMapLocation?.latitude || form.latitude,
    longitude: primaryMapLocation?.longitude || form.longitude,
    adsObjectId: primaryMapLocation?.adsObjectId || form.adsObjectId,
    geocodingProvider: primaryMapLocation?.geocodingProvider || form.geocodingProvider,
    geocodingSuggestionToken: primaryMapLocation?.geocodingSuggestionToken || form.geocodingSuggestionToken,
    county: primaryMapLocation?.county || form.county,
    services: [],
    serviceCategories: [],
    targetGroups: [],
    serviceAreaMunicipalityIds: splitList(form.serviceAreaMunicipalityIds),
    languages: [],
    serviceLocations: form.serviceLocations
      .map((item, index) => ({
        ...item,
        status: item.status,
        sortOrder: index
      }))
      .filter(keepsLocation),
    serviceItems: form.serviceItems
      .map((item, index) => {
        const categories = splitList(item.categories);
        return {
          ...item,
          category: categories[0] || "",
          contactName: item.contactStrategy === "CUSTOM" ? item.contactName : "",
          phone: item.contactStrategy === "CUSTOM" ? item.phone : "",
          email: item.contactStrategy === "CUSTOM" ? item.email : "",
          website: item.contactStrategy === "CUSTOM" ? item.website : "",
          categories,
          ageGroups: splitList(item.ageGroups),
          targetGroups: splitList(item.targetGroups),
          requesterRoles: splitList(item.requesterRoles),
          needTags: splitList(item.needTags),
          lifeDomains: splitList(item.lifeDomains),
          deliveryModes: splitList(item.deliveryModes),
          municipalityIds: splitList(item.municipalityIds),
          serviceLanguages: splitList(item.serviceLanguages),
          inquiryLanguages: splitList(item.inquiryLanguages),
          communicationSupport: splitList(item.communicationSupport),
          locationIds: Array.isArray(item.locationIds) ? item.locationIds : [],
          status: item.status,
          sortOrder: index
        };
      })
      .filter(keepsService)
  };
}

/* --- E-posti aadressi kuju -------------------------------------------------------
   Vana vorm lasi brauseril kontrollida iga `type="email"` välja. Sammulaval ei
   ole avamata teenuse väljad lehel olemas, seega teeb sama kontrolli see
   funktsioon terve vormi kohta (brauseri enda reegel, HTML-i standardist). */
const EMAIL_SHAPE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function emailLooksValid(value) {
  const text = String(value || "").trim();
  return !text || EMAIL_SHAPE.test(text);
}

/**
 * Esimene vigase kujuga e-posti aadress vormil ja vaade, kus seda parandada:
 * `{ level, index, view }` või `null`.
 */
export function firstEmailProblem(form) {
  if (!emailLooksValid(form.email)) return { level: "profile", index: -1, view: "contact" };
  const serviceIndex = form.serviceItems.findIndex((item) => item.contactStrategy === "CUSTOM" && !emailLooksValid(item.email));
  if (serviceIndex >= 0) return { level: "service", index: serviceIndex, view: "service_contact" };
  const locationIndex = form.serviceLocations.findIndex((item) => !emailLooksValid(item.email));
  if (locationIndex >= 0) return { level: "location", index: locationIndex, view: "place_contact" };
  return null;
}

/* --- Avaldamine ------------------------------------------------------------------ */

/** Teeninduskohad, mida teenuse juures saab valida (nimi või aadress on olemas). */
export function realServiceLocations(form) {
  return form.serviceLocations.filter((location) =>
    String(location.label || location.address || location.normalizedAddress || "").trim()
  );
}

/** Teeninduskoha nimi loendis ja valikus; tühja koha nime annab kutsuja. */
export function locationTitle(location) {
  return String(location?.label || location?.normalizedAddress || location?.address || "");
}

/** Kas koha aadress on ametliku vastega (valitud soovituste hulgast). */
export function locationHasMatch(location) {
  return Boolean(
    location?.normalizedAddress &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  );
}

/**
 * Avaldamise reeglid. `blocking`: mis takistab AVALDATUD profiili salvestamist
 * (server kontrollib sama: `publish_service_required`, `publish_contact_required`).
 */
export function serviceProfilePublishState(form) {
  const hasPublishableService = form.serviceItems.some((service) =>
    String(service.name || "").trim() &&
    service.mapVisible !== false &&
    String(service.status || "").toUpperCase() === "PUBLISHED"
  );
  const hasMappableLocation = form.serviceLocations.some((location) =>
    location.mapVisible !== false &&
    String(location.address || location.normalizedAddress || "").trim()
  );
  const hasContact = Boolean(
    String(form.email || form.phone || form.website || "").trim() ||
    form.acceptsPlatformPreInquiries ||
    form.serviceItems.some((service) =>
      String(service.email || service.phone || service.website || service.contactMode || "").trim() ||
      service.acceptsPlatformPreInquiries
    )
  );
  const published = form.status === "PUBLISHED";
  const blocking = published ? [!hasPublishableService ? "service" : "", !hasContact ? "contact" : ""].filter(Boolean) : [];
  return { published, hasPublishableService, hasMappableLocation, hasContact, blocking };
}

/** Aadressi seis teenusekaardil: `{ key, fallback, matched }`. */
export function serviceProfileMapStatus(mapEntry) {
  if (!mapEntry) {
    return { key: "map_status.empty", fallback: "Kaardiasukoha saab ette valmistada pärast aadressi salvestamist.", matched: false };
  }
  const geocodingStatus = String(mapEntry.geocodingStatus || "").toUpperCase();
  if (geocodingStatus === "MATCHED" || geocodingStatus === "MANUALLY_CONFIRMED") {
    return { key: "map_status.matched", fallback: "Aadressil on vaste olemas ja seda saab avaldatud profiili korral teenusekaardil kuvada.", matched: true };
  }
  if (geocodingStatus === "AMBIGUOUS") {
    return { key: "map_status.ambiguous", fallback: "Aadress vajab enne kaardil kuvamist täpsustamist.", matched: false };
  }
  if (geocodingStatus === "FAILED") {
    return { key: "map_status.failed", fallback: "Aadressile ei leitud veel vastet. Markerit kaardil ei kuvata.", matched: false };
  }
  return { key: "map_status.pending", fallback: "Aadress ootab vastendamist.", matched: false };
}

/**
 * Avaldamise kontrolli read. Igal real on `view`: vaade, kus seda asja saab
 * muuta, nii et „puudu" ei jää tupikuks. `blocking` rida takistab salvestamist.
 */
export function serviceProfilePublishChecks(form, mapEntry) {
  const state = serviceProfilePublishState(form);
  /* Kui aadressi ei ole kusagil (ei kohal ega kaardikirjel), ei ole ka midagi
     vastendada: rida ütleb siis „pärast aadressi salvestamist", mitte „vastet
     ei leitud". Kaardikirje võib aadressita profiilil kanda olekut FAILED. */
  const hasAddress =
    form.serviceLocations.some((location) => String(location.address || location.normalizedAddress || "").trim()) ||
    Boolean(String(mapEntry?.normalizedAddress || mapEntry?.address || "").trim());
  const map = serviceProfileMapStatus(hasAddress ? mapEntry : null);
  const row = (key, ok, view, okText, openText) => {
    const [textKey, fallback] = ok ? okText : openText;
    return { key, ok, view, blocking: state.blocking.includes(key), textKey, fallback };
  };
  return [
    row("status", state.published, "visibility",
      ["publish_checks.status_published", "Profiili staatus on avaldatud."],
      ["publish_checks.status_not_published", "Muuda profiili staatus avaldatuks, kui soovid seda avalikus vaates kuvada."]),
    row("map", Boolean(form.mapVisible), "visibility",
      ["publish_checks.map_visible", "Profiil on teenusekaardil nähtavaks märgitud."],
      ["publish_checks.map_hidden", "Teenusekaardi nähtavus on välja lülitatud."]),
    row("service", state.hasPublishableService, "services",
      ["publish_checks.service_ready", "Vähemalt üks teenus on avaldamiseks olemas."],
      ["publish_checks.service_missing", "Lisa vähemalt üks avaldatav teenus."]),
    row("location", state.hasMappableLocation, "locations",
      ["publish_checks.location_ready", "Vähemalt üks teeninduskoht on kaardil nähtav ja aadressiga."],
      ["publish_checks.location_missing", "Lisa teeninduskoht koos aadressiga, kui soovid kaardimarkerit."]),
    row("contact", state.hasContact, "contact",
      ["publish_checks.contact_ready", "Kontakt või platvormisisene pöördumisviis on olemas."],
      ["publish_checks.contact_missing", "Lisa kontakt või luba platvormisisesed eelpöördumised."]),
    /* Assistendi luba on teenuseosutaja VALIK, mitte nõue: rida ütleb seisu, aga
       ei loe „üle vaadata" hulka ega takista kontrolli sammu valmis saamast.
       Muidu survestaks kontroll nõusolekut andma. */
    {
      ...row("assistant", Boolean(form.assistantRecommendationAllowed), "visibility",
        ["publish_checks.assistant_allowed", "Assistent võib avaldatud teenuseid soovitada."],
        ["publish_checks.assistant_blocked", "Assistent ei soovita neid teenuseid enne eraldi loa andmist."]),
      optional: true
    },
    { key: "address", ok: map.matched, view: "locations", blocking: false, textKey: map.key, fallback: map.fallback, detail: String(mapEntry?.normalizedAddress || mapEntry?.address || "") }
  ];
}

/* --- Vaated ---------------------------------------------------------------------- */

/* Teeninduskohad on enne teenuseid: teenuse juures valitakse, millistes kohtades seda osutatakse. */
export const PROFILE_VIEW_KEYS = Object.freeze(["who", "about", "contact", "inquiries", "area", "access", "locations", "services", "visibility", "check"]);
export const SERVICE_VIEW_KEYS = Object.freeze([
  "service", "describe", "scope", "category", "target", "people", "needs", "delivery", "languages", "places",
  "reach", "reach_note", "price", "availability", "confirm", "direct", "kov", "terms", "channels", "service_contact", "licence"
]);
export const LOCATION_VIEW_KEYS = Object.freeze(["place", "address", "place_contact"]);

/* Vaade, kuhu avatud kirjest tagasi minnakse. */
export const LIST_VIEW_OF = Object.freeze({ service: "services", location: "locations" });

/* Mitu teeninduskohta mahub teenuse „kohad" vaatesse ilma, et vaade teistest pikemaks läheks. */
const PLACES_FIT = 6;

const has = (value) => Boolean(String(value ?? "").trim());
const hasList = (value) => splitList(value).length > 0;
/* Mitu asja on täidetud: kõik → tehtud, osa → pooleli, mitte ükski → tühi. */
const fill = (...flags) => {
  const done = flags.filter(Boolean).length;
  return done === 0 ? "empty" : done === flags.length ? "done" : "partial";
};
const short = (value, length = 90) => String(value || "").trim().replace(/\s+/g, " ").slice(0, length);

/** Profiili taseme vaadete seis (sammu numbri heledus kiirmenüüs). */
export function profileViewStates(form, mapEntry) {
  const publish = serviceProfilePublishState(form);
  const checks = serviceProfilePublishChecks(form, mapEntry);
  const named = form.serviceItems.filter(keepsService).length;
  const kept = form.serviceLocations.filter(keepsLocation).length;
  const required = checks.filter((item) => !item.optional);
  const okCount = required.filter((item) => item.ok).length;
  return {
    who: has(form.organizationName) ? "done" : has(form.organizationType) || has(form.registryCode) ? "partial" : "empty",
    about: fill(has(form.shortDescription), has(form.longDescription)),
    contact: has(form.email) || has(form.phone) ? "done" : has(form.website) || has(form.primaryContactName) ? "partial" : "empty",
    inquiries: form.acceptsPlatformPreInquiries || form.acceptsEmailPreInquiries ? "done" : "empty",
    area: has(form.serviceArea) || hasList(form.serviceAreaMunicipalityIds) ? "done" : has(form.county) ? "partial" : "empty",
    access: has(form.accessibilityInfo) || has(form.generalAccessibilityNote) ? "done" : "empty",
    locations: !kept ? "empty" : publish.hasMappableLocation ? "done" : "partial",
    services: !named ? "empty" : publish.hasPublishableService ? "done" : "partial",
    visibility: publish.published && form.mapVisible ? "done" : publish.published || form.mapVisible || form.status === "REVIEW" ? "partial" : "empty",
    check: okCount === required.length ? "done" : okCount ? "partial" : "empty"
  };
}

/** Avatud teenuse vaadete seis. `licenceRow`: selle teenuse tegevusloa rida, kui see on laaditud. */
export function serviceViewStates(service, { savedAvailability = null, licenceRow = null } = {}) {
  const freshness = savedAvailability?.freshness || "unknown";
  const customContact = service.contactStrategy === "CUSTOM";
  return {
    service: has(service.name) ? "done" : "empty",
    describe: fill(has(service.description), has(service.longDescription)),
    scope: fill(has(service.includesText), has(service.excludesText), has(service.additionalInfo)),
    category: hasList(service.categories) ? "done" : "empty",
    target: hasList(service.targetGroups) ? "done" : "empty",
    people: fill(hasList(service.ageGroups), hasList(service.requesterRoles)),
    needs: fill(hasList(service.needTags), hasList(service.lifeDomains)),
    delivery: hasList(service.deliveryModes) ? "done" : hasList(service.communicationSupport) ? "partial" : "empty",
    languages: fill(hasList(service.serviceLanguages), hasList(service.inquiryLanguages)),
    places: (service.locationIds || []).length ? "done" : "empty",
    reach: has(service.serviceAreaType) ? "done" : has(service.county) || hasList(service.municipalityIds) ? "partial" : "empty",
    reach_note: has(service.serviceArea) || has(service.areaDescription) ? "done" : "empty",
    price: service.feeType && service.feeType !== "UNKNOWN" ? "done" : has(service.priceDescription) ? "partial" : "empty",
    availability: has(service.availabilityStatus) ? "done" : has(service.availabilityDescription) ? "partial" : "empty",
    confirm: freshness === "fresh" ? "done" : freshness === "stale" ? "partial" : "empty",
    direct: fill(has(service.directContactAllowed), has(service.requiresSkaReferral), has(service.requiresSpecialistReferral)),
    kov: fill(has(service.requiresKovAssessment), has(service.requiresKovDecision)),
    terms: fill(has(service.requiredDocumentsNote), has(service.referralNotes)),
    channels: has(service.contactMode) ? "done" : "empty",
    service_contact: !customContact ? "empty" : has(service.contactName) || has(service.phone) || has(service.email) ? "done" : "partial",
    licence: !licenceRow ? "empty" : String(licenceRow.badge?.tone || "").toUpperCase() === "POSITIVE" ? "done" : "partial"
  };
}

/** Avatud teeninduskoha vaadete seis. */
export function locationViewStates(location) {
  return {
    place: has(location.label) ? "done" : "empty",
    address: locationHasMatch(location) ? "done" : has(location.address) ? "partial" : "empty",
    place_contact: fill(has(location.phone) || has(location.email) || has(location.website), has(location.openingHours))
  };
}

/** Profiili vaadete üks-kaks rida vaates „Kõik sammud". Silte ja sõnu annab leht (`tp`, `options`). */
export function profileViewSummaries(form, mapEntry, { tp, options }) {
  const named = form.serviceItems.filter(keepsService);
  const kept = form.serviceLocations.filter(keepsLocation).length;
  const published = named.filter((item) => item.mapVisible !== false && String(item.status || "").toUpperCase() === "PUBLISHED").length;
  const open = serviceProfilePublishChecks(form, mapEntry).filter((item) => !item.ok && !item.optional).length;
  return {
    who: short(form.organizationName),
    about: short(form.shortDescription || form.longDescription),
    contact: [form.email, form.phone].map((item) => short(item, 40)).filter(Boolean).join(" · "),
    area: short(form.serviceArea || form.serviceAreaMunicipalityIds || form.county),
    access: short(form.accessibilityInfo || form.generalAccessibilityNote),
    services: named.length ? tp("views.services.summary", "Teenuseid {count}, avaldatud {published}", { count: named.length, published }) : "",
    locations: kept ? tp("views.locations.summary", "Teeninduskohti {count}", { count: kept }) : "",
    visibility: optionLabel(options.status, form.status),
    check: open ? tp("views.check.summary_open", "Üle vaadata: {count}", { count: open }) : tp("views.check.summary_ok", "Kõik on korras")
  };
}

/** Avatud teenuse vaadete kokkuvõtted. */
export function serviceViewSummaries(service, { options }) {
  const labels = (value, group) => short(selectedLabels(value, options[group]).join(", "));
  return {
    service: short(service.name),
    describe: short(service.description || service.longDescription),
    scope: short(service.includesText || service.excludesText || service.additionalInfo),
    category: labels(service.categories, "category"),
    target: labels(service.targetGroups, "targetGroup"),
    people: [labels(service.ageGroups, "ageGroup"), labels(service.requesterRoles, "requesterRole")].filter(Boolean).join(", "),
    needs: [labels(service.needTags, "needTag"), labels(service.lifeDomains, "lifeDomain")].filter(Boolean).join(", "),
    delivery: labels(service.deliveryModes, "deliveryMode"),
    languages: labels(service.serviceLanguages, "language"),
    reach: optionLabel(options.areaType, service.serviceAreaType) || short(service.county),
    reach_note: short(service.serviceArea || service.areaDescription),
    price: service.feeType && service.feeType !== "UNKNOWN" ? optionLabel(options.fee, service.feeType) : short(service.priceDescription),
    availability: optionLabel(options.availability, service.availabilityStatus),
    terms: short(service.referralNotes || service.requiredDocumentsNote),
    channels: optionLabel(options.contactMode, service.contactMode),
    service_contact: service.contactStrategy === "CUSTOM" ? [service.contactName, service.email, service.phone].map((item) => short(item, 40)).filter(Boolean).join(" · ") : ""
  };
}

/** Avatud teeninduskoha vaadete kokkuvõtted. */
export function locationViewSummaries(location) {
  return {
    place: short(location.label),
    address: short(location.normalizedAddress || location.address),
    place_contact: [location.phone, location.email].map((item) => short(item, 40)).filter(Boolean).join(" · ")
  };
}

/**
 * Lava sammud: `[{ key, label, short, state, summary, free }]`.
 * Loendid võivad olla pikad (`free`): nende järgi ühist kõrgust ei võeta.
 */
export function serviceProfileSteps(keys, { tp, states = {}, summaries = {}, placeCount = 0 }) {
  return keys.map((key) => ({
    key,
    label: tp(`views.${key}.title`, key),
    short: tp(`views.${key}.short`, key),
    state: states[key] || "empty",
    summary: summaries[key] || undefined,
    free: key === "services" || key === "locations" || (key === "places" && placeCount > PLACES_FIT)
  }));
}

/* --- Loendite read ---------------------------------------------------------------- */

/** Teenuste loendi read: nimi, seis ja see, kas rida salvestub. */
export function serviceRows(form) {
  return form.serviceItems.map((service, index) => ({
    index,
    name: String(service.name || "").trim(),
    saves: keepsService(service),
    status: String(service.status || "").toUpperCase(),
    published: keepsService(service) && service.mapVisible !== false && String(service.status || "").toUpperCase() === "PUBLISHED"
  }));
}

/** Teeninduskohtade loendi read. */
export function locationRows(form) {
  return form.serviceLocations.map((location, index) => ({
    index,
    title: locationTitle(location).trim(),
    address: has(location.label) ? String(location.normalizedAddress || location.address || "").trim() : "",
    saves: keepsLocation(location),
    status: String(location.status || "").toUpperCase(),
    onMap: location.mapVisible !== false && locationHasMatch(location)
  }));
}
