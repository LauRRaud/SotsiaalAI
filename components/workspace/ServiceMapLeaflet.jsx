"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeServiceMapAccessPath, serviceMapAccessPathHasDetails } from "@/lib/serviceMap/accessPath";
import { serviceAvailabilityPresentation } from "@/lib/serviceAvailabilityUi";

import styles from "./ServiceMapLeaflet.module.css";
import {
  POPUP_EDGE_PADDING,
  accessPathWord,
  addressNamesMunicipality,
  groupPopupView,
  popupDateLocale,
  popupSourceLink,
  popupTopLeftPadding,
  serviceEmailHref,
  servicePhoneHref
} from "./serviceMapPopupRules";

const ESTONIA_BOUNDS = [
  [57.45, 21.35],
  [59.95, 28.35]
];

const ESTONIA_FIT_BOUNDS = [
  [57.52, 21.55],
  [59.85, 28.22]
];

const DEFAULT_TILE_URL = "/api/service-map/tiles/{z}/{x}/{y}";

const DEFAULT_ATTRIBUTION = "Aluskaart: Maa- ja Ruumiamet";
const DEFAULT_LEAFLET_SCRIPT_URL = "/vendor/leaflet/leaflet.js";
const DEFAULT_LEAFLET_CSS_URL = "/vendor/leaflet/leaflet.css";
const SERVICE_MAP_MIN_ZOOM = 8;

let leafletLoadPromise = null;

function readText(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function entryCoordinates(entry) {
  const latitude = numberOrNull(entry?.latitude);
  const longitude = numberOrNull(entry?.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < 57 || latitude > 60.5 || longitude < 19 || longitude > 31) return null;
  return [latitude, longitude];
}

function coordinateKey(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
  return `${Number(coordinates[0]).toFixed(6)}:${Number(coordinates[1]).toFixed(6)}`;
}

function groupedEntriesByCoordinates(entries = []) {
  const groupsByKey = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const coordinates = entryCoordinates(entry);
    if (!coordinates) continue;
    const key = coordinateKey(coordinates);
    if (!key) continue;

    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        id: `coord:${key}`,
        coordinates,
        entries: []
      });
    }
    groupsByKey.get(key).entries.push(entry);
  }

  return Array.from(groupsByKey.values()).map((group) => {
    const sortedEntries = group.entries.slice().sort((a, b) =>
      String(a?.title || "").localeCompare(String(b?.title || ""), "et", { sensitivity: "base" })
    );
    return {
      ...group,
      entries: sortedEntries,
      primaryEntry: sortedEntries[0]
    };
  });
}

function groupForEntryId(entries = [], entryId = "") {
  if (!entryId) return null;
  return groupedEntriesByCoordinates(entries).find((group) =>
    group.entries.some((entry) => entry?.id === entryId)
  ) || null;
}

function shortText(value, maxLength = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function popupDescription(entry) {
  if (entry?.type === "HELP_REQUEST" || entry?.type === "HELP_OFFER") {
    return shortText(entry?.description || "", 170);
  }
  if (entry?.type !== "SERVICE_PROVIDER") return "";
  const raw = String(entry?.description || entry?.providerProfile?.shortDescription || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const withoutOperationalNotes = raw
    .split(/\s+(?:Roll|Vastuvõtt|Vastuvott):/i)[0]
    .trim();
  const firstSentence = withoutOperationalNotes.match(/^.*?[.!?](?=\s|$)/u)?.[0]?.trim() || withoutOperationalNotes;
  return shortText(firstSentence, 150);
}

function isHelpMapEntry(entry) {
  return entry?.type === "HELP_REQUEST" || entry?.type === "HELP_OFFER";
}

function safeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function entryRegionText(entry) {
  return [entry?.municipalityName || entry?.municipality?.displayName, entry?.county].filter(Boolean).join(", ");
}

function appendText(parent, tagName, className, text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  parent.appendChild(element);
  return element;
}

function appendContactMeta(parent, entry) {
  const phone = String(entry?.phone || "").trim();
  const email = String(entry?.email || "").trim();
  if (!phone && !email) return null;

  const meta = document.createElement("span");
  meta.className = "service-map-popup__contact-meta";

  if (phone) {
    appendText(meta, "span", "service-map-popup__contact-phone", phone);
  }

  if (email) {
    appendText(meta, "span", "service-map-popup__contact-email", email);
  }

  parent.appendChild(meta);
  return meta;
}

/* Paneeli lingid ja nupud ei tohi vajutust kaardile edasi anda (kaart võtaks
   selle lohistamise alguseks). */
function keepFromMap(element) {
  const stop = (event) => event.stopPropagation();
  element.addEventListener("pointerdown", stop);
  element.addEventListener("mousedown", stop);
  element.addEventListener("mouseup", stop);
  element.addEventListener("touchstart", stop, { passive: true });
}

/* `href`: telefon ja e-post on lingid, et number oleks telefonis ühe vajutusega
   valitav. Avatakse nagu teised paneeli lingid: aadress antakse brauserile otse. */
function appendMeta(parent, label, value, href = "") {
  const text = String(value || "").trim();
  if (!text) return null;

  const row = document.createElement("p");
  row.className = "service-map-popup__meta";

  const labelElement = document.createElement("span");
  labelElement.className = "service-map-popup__label";
  labelElement.textContent = label;
  row.appendChild(labelElement);

  const valueElement = document.createElement(href ? "a" : "span");
  valueElement.textContent = text;
  if (href) {
    valueElement.href = href;
    valueElement.className = "service-map-popup__meta-link";
    keepFromMap(valueElement);
    valueElement.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(href);
    });
  }
  row.appendChild(valueElement);

  parent.appendChild(row);
  return row;
}

function appendActionLink(parent, href, label, options = {}) {
  const link = document.createElement("a");
  link.href = href;
  link.className = "service-map-popup__action";
  link.target = options.target || "_self";
  if (options.target) link.target = options.target;
  if (options.rel) link.rel = options.rel;
  const stopMapInteraction = (event) => {
    event.stopPropagation();
  };
  link.addEventListener("pointerdown", stopMapInteraction);
  link.addEventListener("mousedown", stopMapInteraction);
  link.addEventListener("mouseup", stopMapInteraction);
  link.addEventListener("touchstart", stopMapInteraction, { passive: true });
  if (options.forceLocation) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(href);
    });
  } else {
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  link.appendChild(labelElement);

  parent.appendChild(link);
  return link;
}

function appendActionButton(parent, label, onClick, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "service-map-popup__action";
  if (options.disabled) button.disabled = true;
  const stopMapInteraction = (event) => {
    event.stopPropagation();
  };
  button.addEventListener("pointerdown", stopMapInteraction);
  button.addEventListener("mousedown", stopMapInteraction);
  button.addEventListener("mouseup", stopMapInteraction);
  button.addEventListener("touchstart", stopMapInteraction, { passive: true });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!options.disabled) onClick?.(event);
  });

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  button.appendChild(labelElement);

  parent.appendChild(button);
  return button;
}

function feeLabel(value, t) {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  if (normalized === "FREE") return readText(t, "workspace_feature_pages.service_profile.fee.free", "Tasuta");
  if (normalized === "PAID") return readText(t, "workspace_feature_pages.service_profile.fee.paid", "Tasuline");
  if (normalized === "AGREEMENT") return readText(t, "workspace_feature_pages.service_profile.fee.agreement", "Kokkuleppel");
  if (normalized === "MIXED") return readText(t, "workspace_feature_pages.service_profile.fee.mixed", "Mitut tüüpi");
  return "";
}

/* Sõna valib `accessPathWord` (serviceMapPopupRules.js): sisemist koodi
   ekraanile ei lasta. Enne oli varuväärtus kood ise ja nelja rühma sõnad
   puudusid kataloogist üldse, nii et iga kontakti juures seisis „CHECK_SOURCE"
   ja „UNKNOWN" (kujundusaudit K13). */
function accessPathValueLabel(t, group, value) {
  return accessPathWord(t, group, value);
}

function yesNoLabel(value, t) {
  if (value === true) return readText(t, "serviceMap.accessPath.yes", "Jah");
  if (value === false) return readText(t, "serviceMap.accessPath.no", "Ei");
  return readText(t, "serviceMap.accessPath.unknownShort", "Teadmata");
}

function appendAccessPath(parent, entry, t) {
  const accessPath = normalizeServiceMapAccessPath(entry?.accessPath);
  const hasDetails = serviceMapAccessPathHasDetails(accessPath);
  const isHealthContact =
    accessPath.accessType === "HEALTH_CONTACT_FIRST" ||
    accessPath.firstStep === "CONTACT_HEALTH_PROVIDER";
  const sourceUrl = safeWebsiteUrl(accessPath.sourceUrl || entry?.sourceUrl);

  /* Kui teenuseni jõudmise kohta ei ole midagi teada, ei ole ka midagi öelda.
     Seni sai iga selline kirje (kõik registrist tulnud KOV-kontaktid) ploki
     „Kuidas edasi liikuda?" lausega, et loogika vajab kontrollimist, ja read
     „esimene samm" ning „allika seis" ilma sisuta. See tegi paneeli pikaks ja
     kontakt ise jäi selle taha. Allika link on siis tegevuste reas
     (`createPopupContent`). */
  if (!hasDetails && !isHealthContact) return null;

  const section = document.createElement("div");
  section.className = "service-map-popup__access-path";

  if (isHealthContact) {
    appendText(
      section,
      "p",
      "service-map-popup__access-path-title",
      readText(t, "serviceMap.healthContact.title", "Tervisekontakt")
    );
    appendText(
      section,
      "p",
      "service-map-popup__access-path-body",
      readText(t, "serviceMap.healthContact.description", "See kontakt võib sobida tervisega seotud küsimuse esmaseks täpsustamiseks.")
    );
    appendText(
      section,
      "p",
      "service-map-popup__access-path-note",
      readText(t, "serviceMap.healthContact.notMedicalPlatform", "Sotsiaal.pro ei anna meditsiinilist hinnangut, diagnoosi ega ravisoovitust.")
    );
  }

  appendText(
    section,
    "p",
    "service-map-popup__access-path-title",
    readText(t, "serviceMap.accessPath.title", "Kuidas edasi liikuda?")
  );
  appendText(
    section,
    "p",
    "service-map-popup__access-path-body",
    hasDetails && accessPath.userExplanation
      ? accessPath.userExplanation
      : readText(t, "serviceMap.accessPath.unknown", "Teenusele jõudmise täpne loogika vajab kontrollimist. Vaata ametlikku allikat või võta ühendust vastava kontaktiga.")
  );

  const meta = document.createElement("div");
  meta.className = "service-map-popup__access-path-meta";
  appendMeta(meta, readText(t, "serviceMap.accessPath.firstStep", "Esimene samm"), accessPathValueLabel(t, "firstSteps", accessPath.firstStep));
  if (hasDetails || accessPath.accessType !== "UNKNOWN") {
    appendMeta(meta, readText(t, "serviceMap.accessPath.accessType", "Ligipääsu tüüp"), accessPathValueLabel(t, "accessTypes", accessPath.accessType));
  }
  if (accessPath.decisionBy !== "UNKNOWN") {
    appendMeta(meta, readText(t, "serviceMap.accessPath.decisionBy", "Kes täpsustab või otsustab"), accessPathValueLabel(t, "decisionByValues", accessPath.decisionBy));
  }
  if (accessPath.requiresAssessment !== null) {
    appendMeta(meta, readText(t, "serviceMap.accessPath.requiresAssessment", "Võib vajada hindamist"), yesNoLabel(accessPath.requiresAssessment, t));
  }
  if (accessPath.requiresDecision !== null) {
    appendMeta(meta, readText(t, "serviceMap.accessPath.requiresDecision", "Võib vajada otsust"), yesNoLabel(accessPath.requiresDecision, t));
  }
  if (accessPath.requiresReferral !== null) {
    appendMeta(meta, readText(t, "serviceMap.accessPath.requiresReferral", "Võib vajada suunamist"), yesNoLabel(accessPath.requiresReferral, t));
  }
  /* Rida ilma sisuta („Allika seis: Teadmata") ei ütle midagi: jääb ära. */
  if (accessPath.sourceStatus !== "UNKNOWN") {
    appendMeta(meta, readText(t, "serviceMap.accessPath.sourceStatus", "Allika seis"), accessPathValueLabel(t, "sourceStatuses", accessPath.sourceStatus));
  }
  appendMeta(meta, readText(t, "serviceMap.accessPath.checkedAt", "Viimati kontrollitud"), accessPath.checkedAt);
  if (meta.childNodes.length) section.appendChild(meta);

  if (sourceUrl) {
    const actions = document.createElement("div");
    actions.className = "service-map-popup__actions";
    appendActionLink(actions, sourceUrl, readText(t, "serviceMap.accessPath.source", "Ametlik allikas"), {
      target: "_blank",
      rel: "noreferrer"
    });
    section.appendChild(actions);
  }

  appendText(
    section,
    "p",
    "service-map-popup__access-path-note",
    readText(t, "serviceMap.accessPath.notDecision", "See info ei ole ametlik hindamine, otsus ega teenuse määramine.")
  );

  parent.appendChild(section);
  return section;
}

/* A4 — avalik tegevusloa märgis teenusekaardil.
   Sisu tuleb serverist valmis kujul (`lib/mtr/statusText.js`): siin ei
   otsustata ei teksti ega tooni. `null` või sisemine märgis = silti ei ole,
   ja seda EI TOHI tõlgendada kummaski suunas. */
function appendLicenceBadge(parent, badge, t) {
  if (!badge || badge.visibility === "INTERNAL_ONLY" || !badge.key) return null;
  const block = document.createElement("div");
  block.className = "service-map-popup__licence";
  block.dataset.tone = badge.tone || "NEUTRAL";
  block.dataset.status = badge.status || "UNKNOWN";
  const label = typeof t === "function"
    ? t(badge.key, { date: formatLicenceDate(badge.params?.date), activity: badge.params?.activity || "" }, "")
    : "";
  /* Puuduv tõlge ei tohi jätta ekraanile tühja märgiseplokki, kus seisab
     ainult allikarida. */
  if (!String(label || "").trim()) return null;
  appendText(block, "p", "service-map-popup__licence-label", label);
  if (badge.caveatKey) {
    appendText(block, "p", "service-map-popup__licence-caveat", readText(t, badge.caveatKey, ""));
  }
  /* ALLIKAS tuleb märgiselt: „ei vaja luba" ei tulene MTR-ist, vaid
     vastavustabelist, ja vaade ei tohi seda ise valida. */
  if (badge.sourceKey) {
    appendText(block, "p", "service-map-popup__licence-source", readText(t, badge.sourceKey, ""));
  }
  parent.appendChild(block);
  return block;
}

function isKovContactEntry(entry) {
  const type = String(entry?.type || "").toUpperCase();
  return type === "KOV_SOCIAL_CONTACT" || type === "KOV_GENERAL_CONTACT";
}

function formatLicenceDate(value, locale = "et") {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(popupDateLocale(locale), { dateStyle: "long", timeZone: "Europe/Tallinn" }).format(date);
}

function appendServiceItems(parent, entry, t, onStartPreInquiry) {
  const services = (entry?.providerProfile?.serviceItems || [])
    .filter((service) => service?.mapVisible !== false && String(service?.status || "PUBLISHED").toUpperCase() === "PUBLISHED")
    .slice(0, 8);
  if (!services.length) return null;

  const section = document.createElement("div");
  section.className = "service-map-popup__services";
  appendText(
    section,
    "p",
    "service-map-popup__services-title",
    readText(t, "workspace_feature_pages.service_map.popup.services", "Teenused")
  );

  for (const service of services) {
    const item = document.createElement("article");
    item.className = "service-map-popup__service";
    appendText(item, "h4", "service-map-popup__service-title", service.name);
    appendText(item, "p", "service-map-popup__service-body", shortText(service.description, 180));
    const meta = [
      service.category,
      Array.isArray(service.targetGroups) ? service.targetGroups.join(", ") : "",
      service.serviceArea,
      feeLabel(service.feeType, t),
      service.priceDescription
    ].filter(Boolean).join(" | ");
    appendText(item, "p", "service-map-popup__service-meta", meta);
    const availability = serviceAvailabilityPresentation(t, service.availability);
    const availabilityBlock = document.createElement("div");
    availabilityBlock.className = "service-map-popup__availability";
    availabilityBlock.dataset.tone = availability.tone;
    appendText(
      availabilityBlock,
      "p",
      "service-map-popup__availability-status",
      `${availability.icon} ${availability.label}`
    );
    if (service.availability?.status === "waitlist" && availability.description) {
      appendText(
        availabilityBlock,
        "p",
        "service-map-popup__availability-wait",
        `${readText(t, "service_availability.wait_label", "Ligikaudne ooteaeg")}: ${availability.description}`
      );
    }
    appendText(availabilityBlock, "p", "service-map-popup__availability-age", availability.ageText);
    appendText(availabilityBlock, "p", "service-map-popup__availability-warning", availability.warning);
    item.appendChild(availabilityBlock);
    appendLicenceBadge(item, service.licenceBadge, t);
    const policy = (entry.serviceActions || []).find((action) => action.providerServiceId === service.id);
    if (policy?.platformAllowed || policy?.emailAllowed) {
      const actions = document.createElement("div");
      actions.className = "service-map-popup__actions";
      if (policy.platformAllowed) {
        appendActionButton(
          actions,
          readText(t, "workspace_feature_pages.service_map.popup.start_pre_inquiry", "Alusta pöördumist"),
          () => onStartPreInquiry?.(entry, policy)
        );
      }
      if (policy.emailAllowed && policy.email) {
        appendActionLink(
          actions,
          `mailto:${policy.email}`,
          readText(t, "workspace_feature_pages.service_map.popup.write", "Kirjuta"),
          { forceLocation: true }
        );
      }
      item.appendChild(actions);
    }
    section.appendChild(item);
  }

  parent.appendChild(section);
  return section;
}

function helpListingTypeLabel(entry, t) {
  if (entry?.type === "HELP_OFFER") {
    return readText(t, "workspace_feature_pages.service_map.popup.help_offer", "Abipakkumine");
  }
  return readText(t, "workspace_feature_pages.service_map.popup.help_request", "Abisoov");
}

function helpMapRegionText(entry) {
  return [
    entry?.regionLabel,
    entry?.serviceArea,
    entry?.municipalityName,
    entry?.county
  ].filter(Boolean)[0] || "";
}

function appendHelpListingActions(parent, entry, t, onConnectHelpEntry) {
  const actions = document.createElement("div");
  actions.className = "service-map-popup__actions";
  appendActionButton(
    actions,
    entry?.isOwn
      ? readText(t, "workspace_feature_pages.service_map.popup.own_listing", "Sinu kuulutus")
      : readText(t, "workspace_feature_pages.service_map.popup.connect", "Võta ühendust"),
    () => onConnectHelpEntry?.(entry),
    { disabled: entry?.isOwn }
  );
  parent.appendChild(actions);
  return actions;
}

function createHelpListingPopupContent(entry, t, onConnectHelpEntry) {
  const root = document.createElement("article");
  root.className = "service-map-popup service-map-popup--help";

  appendText(root, "p", "service-map-popup__eyebrow", helpListingTypeLabel(entry, t));
  appendText(root, "h3", "service-map-popup__title", entry.title);
  appendText(root, "p", "service-map-popup__body", popupDescription(entry));

  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.help_type", "Abi liik"), entry.categoryLabel || entry.helpTypeLabel);
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.region", "Piirkond"), helpMapRegionText(entry));
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.time", "Aeg"), entry.availabilityOrStart || entry.timeTypeLabel);
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.compensation", "Tasu või tingimus"), entry.compensationDetails || entry.helpTypeLabel);
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.target_groups", "Sihtrühm"), Array.isArray(entry.targetGroupLabels) ? entry.targetGroupLabels.join(", ") : "");
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.contact_mode", "Kontakt"), readText(t, "workspace_feature_pages.service_map.popup.platform_contact", "Platvormisisene"));
  appendText(root, "p", "service-map-popup__privacy-note", entry.privacyNote || readText(t, "workspace_feature_pages.service_map.popup.no_public_contacts", "Täpseid kontaktandmeid ei kuvata avalikult."));
  appendHelpListingActions(root, entry, t, onConnectHelpEntry);

  return root;
}

function createPopupContent(entry, t, onConnectHelpEntry, onStartPreInquiry, options = {}) {
  if (isHelpMapEntry(entry)) {
    return createHelpListingPopupContent(entry, t, onConnectHelpEntry);
  }

  const root = document.createElement("article");
  root.className = "service-map-popup";

  appendText(root, "h3", "service-map-popup__title", entry.title);
  appendText(root, "p", "service-map-popup__body", popupDescription(entry));

  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.address", "Aadress"), entry.address);
  /* Kui aadress juba nimetab omavalitsuse, ei korda piirkonnarida seda. */
  if (!addressNamesMunicipality(entry)) {
    appendMeta(
      root,
      readText(t, "workspace_feature_pages.service_map.popup.region", "Piirkond"),
      entryRegionText(entry)
    );
  }
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.phone", "Telefon"), entry.phone, servicePhoneHref(entry.phone));
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.email", "E-post"), entry.email, serviceEmailHref(entry.email));
  /* KOV-kontakti allikalehte kontrollitakse kord nädalas; kuupäev ütleb, kui
     värske see kontakt on. Teenuseosutaja kirjel on oma saadavuse ja loa read. */
  if (isKovContactEntry(entry)) {
    appendMeta(root, readText(t, "serviceMap.contactCheckedAt", "Kontakt kontrollitud"), formatLicenceDate(entry.checkedAt, options.locale));
  }
  appendServiceItems(root, entry, t, onStartPreInquiry);
  const accessSection = appendAccessPath(root, entry, t);

  const websiteUrl = safeWebsiteUrl(entry.website);
  /* Ligipääsutee plokil on oma allikalink. Kui plokki ei ole, on link siin
     tegevuste reas; sama aadressi kahe nime all ei näidata. */
  const sourceUrl = popupSourceLink({
    accessShown: Boolean(accessSection),
    sourceUrl: safeWebsiteUrl(entry?.accessPath?.sourceUrl || entry?.sourceUrl),
    websiteUrl
  });
  const hasServiceActions = Array.isArray(entry.serviceActions);
  if (websiteUrl || sourceUrl || entry.email || (!hasServiceActions && onStartPreInquiry)) {
    const actions = document.createElement("div");
    actions.className = "service-map-popup__actions";

    if (!hasServiceActions) {
      appendActionButton(
        actions,
        readText(t, "workspace_feature_pages.service_map.popup.start_pre_inquiry", "Alusta pöördumist"),
        () => onStartPreInquiry?.(entry, null)
      );
    }

    if (entry.email) {
      appendActionLink(
        actions,
        `mailto:${entry.email}`,
        readText(t, "workspace_feature_pages.service_map.popup.write", "Kirjuta"),
        { forceLocation: true }
      );
    }

    if (websiteUrl) {
      appendActionLink(
        actions,
        websiteUrl,
        readText(t, "workspace_feature_pages.service_map.popup.website", "Veeb"),
        { target: "_blank", rel: "noreferrer" }
      );
    }

    if (sourceUrl) {
      appendActionLink(actions, sourceUrl, readText(t, "serviceMap.accessPath.source", "Ametlik allikas"), {
        target: "_blank",
        rel: "noreferrer"
      });
    }

    root.appendChild(actions);
  }

  return root;
}

/* Üks rida rühma loendis: nimi ja roll nupuna, selle all telefon ja e-post.
   Tagastab nupu, et „tagasi" saaks fookuse samale reale tuua. */
function appendGroupedPopupContact(parent, entry, onOpen) {
  const item = document.createElement("article");
  item.className = "service-map-popup__contact";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "service-map-popup__contact-button";
  /* Tunnus on fookuse tagasitoomiseks pärast „tagasi" (vt `refreshPopup`). */
  button.dataset.entryId = String(entry?.id || "");
  keepFromMap(button);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpen?.(entry);
  });

  appendText(button, "span", "service-map-popup__contact-title", entry.title);
  appendText(button, "span", "service-map-popup__contact-description", popupDescription(entry));
  item.appendChild(button);

  appendContactMeta(item, entry);

  parent.appendChild(item);
  return button;
}

/* Mitu kontakti samas punktis (valla sotsiaalosakond).
 *
 * ÜKS VAADE KORRAGA: kontaktide loend VÕI üks avatud kontakt. Varem avanes
 * kontakt loendi sisse oma rea alla, nii et üheteistkümne kontaktiga paneel
 * kasvas mitme ekraani kõrguseks ja avatud kontakti nuppudeni tuli kerida
 * (kujundusaudit K13).
 *
 * Kumb vaade on ees, otsustab `groupPopupView` valiku ja komponendi käes oleva
 * märke järgi (`view.listForced`: inimene vajutas „tagasi"). See funktsioon
 * ISE VAADET EI VAHETA: „tagasi" ja sama kontakti uuesti avamine teatavad
 * komponendile (`view.onBack`, `view.onReopen`), kes laseb kaardil paneeli
 * uuesti ehitada. Nii mõõdab kaart paneeli iga vahetuse järel uuesti ja nihutab
 * ta nähtavale; kohapeal vahetades kasvas loend kaardi ülaservast välja.
 */
function createGroupedPopupContent(group, t, onSelectEntry, selectedEntryId, onConnectHelpEntry, onStartPreInquiry, view = {}) {
  if (!group || group.entries.length <= 1) {
    return createPopupContent(group?.primaryEntry || group?.entries?.[0] || {}, t, onConnectHelpEntry, onStartPreInquiry, { locale: view.locale });
  }

  const root = document.createElement("article");
  root.className = "service-map-popup service-map-popup--group";
  const shown = groupPopupView(group, selectedEntryId, view.listForced ? group.id : "");

  if (shown.view === "contact") {
    const detail = createPopupContent(shown.entry, t, onConnectHelpEntry, onStartPreInquiry, { locale: view.locale });
    detail.classList.add("service-map-popup__contact-detail");
    const back = document.createElement("button");
    back.type = "button";
    back.className = "service-map-popup__contact-back";
    back.textContent = `‹ ${readText(t, "workspace_feature_pages.service_map.popup.back_to_group", "Tagasi kontaktide juurde")}`;
    keepFromMap(back);
    back.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.onBack?.(shown.entry.id);
    });
    detail.insertBefore(back, detail.firstChild);
    root.appendChild(detail);
    return root;
  }

  const primaryEntry = group.primaryEntry || group.entries[0];
  const listView = document.createElement("div");
  listView.className = "service-map-popup__group-list";
  appendText(
    listView,
    "h3",
    "service-map-popup__title",
    readText(t, "workspace_feature_pages.service_map.popup.group_title", `${group.entries.length} kontakti`)
      .replace("{count}", String(group.entries.length))
  );
  appendMeta(listView, readText(t, "workspace_feature_pages.service_map.popup.address", "Aadress"), primaryEntry.address);
  if (!addressNamesMunicipality(primaryEntry)) {
    appendMeta(listView, readText(t, "workspace_feature_pages.service_map.popup.region", "Piirkond"), entryRegionText(primaryEntry));
  }

  const list = document.createElement("div");
  list.className = "service-map-popup__contacts";
  for (const entry of group.entries) {
    appendGroupedPopupContact(list, entry, (opened) => {
      /* Sama kontakti uuesti avamine (pärast „tagasi"): valik ei muutunud, nii
         et lehe olek paneeli ise uuesti ei joonistaks. */
      if (opened.id === selectedEntryId) view.onReopen?.(opened.id);
      else onSelectEntry?.(opened.id);
    });
  }
  listView.appendChild(list);
  root.appendChild(listView);

  return root;
}

function markerClassName(group, selected) {
  const entries = Array.isArray(group?.entries) ? group.entries : [];
  const allHelpRequests = entries.length > 0 && entries.every((entry) => entry?.type === "HELP_REQUEST");
  const allHelpOffers = entries.length > 0 && entries.every((entry) => entry?.type === "HELP_OFFER");
  const allProviders = entries.length > 0 && entries.every((entry) => entry?.type === "SERVICE_PROVIDER");
  const allKov = entries.length > 0 && entries.every((entry) => entry?.type !== "SERVICE_PROVIDER" && !isHelpMapEntry(entry));
  return [
    "service-map-leaflet__marker",
    allHelpRequests ? "service-map-leaflet__marker--help-request" : "",
    allHelpOffers ? "service-map-leaflet__marker--help-offer" : "",
    allProviders ? "service-map-leaflet__marker--provider" : "",
    allKov ? "service-map-leaflet__marker--kov" : "",
    !allHelpRequests && !allHelpOffers && !allProviders && !allKov ? "service-map-leaflet__marker--mixed" : "",
    entries.length > 1 ? "service-map-leaflet__marker--group" : "",
    selected ? "service-map-leaflet__marker--selected" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function markerLabelText(group) {
  const entries = Array.isArray(group?.entries) ? group.entries : [];
  const allHelpRequests = entries.length > 0 && entries.every((entry) => entry?.type === "HELP_REQUEST");
  const allHelpOffers = entries.length > 0 && entries.every((entry) => entry?.type === "HELP_OFFER");
  const allProviders = entries.length > 0 && entries.every((entry) => entry?.type === "SERVICE_PROVIDER");
  const allKov = entries.length > 0 && entries.every((entry) => entry?.type !== "SERVICE_PROVIDER" && !isHelpMapEntry(entry));

  if (allHelpRequests) return "?";
  if (allHelpOffers) return "+";
  if (allProviders) return "T";
  if (allKov) return "K";
  return "KT";
}

function markerHtml(group, selected) {
  const label = markerLabelText(group);
  return [
    `<span class="${markerClassName(group, selected)}">`,
    `<svg class="service-map-leaflet__marker-shape" viewBox="0 0 48 60" aria-hidden="true" focusable="false">`,
    `<path class="service-map-leaflet__marker-pin" fill-rule="evenodd" clip-rule="evenodd" d="M24 59C20.6 53.5 16.95 48.38 13.06 43.64C6.35 35.45 3 28.25 3 22.05C3 9.88 12.4 1 24 1C35.6 1 45 9.88 45 22.05C45 28.25 41.65 35.45 34.94 43.64C31.05 48.38 27.4 53.5 24 59ZM24 35.7A14.2 14.2 0 1 0 24 7.3A14.2 14.2 0 0 0 24 35.7Z" />`,
    `<circle class="service-map-leaflet__marker-hole" cx="24" cy="21.5" r="12.05" />`,
    `<text class="service-map-leaflet__marker-label" x="24" y="21.5" text-anchor="middle" dominant-baseline="central">${label}</text>`,
    `</svg>`,
    `</span>`
  ].join("");
}

function ensureStylesheet(href) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-service-map-leaflet="1"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.serviceMapLeaflet = "1";
  document.head.appendChild(link);
}

function loadLeafletFromPublicAssets() {
  if (typeof window === "undefined") return Promise.reject(new Error("Leaflet requires a browser environment."));
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  const scriptUrl = process.env.NEXT_PUBLIC_LEAFLET_SCRIPT_URL || DEFAULT_LEAFLET_SCRIPT_URL;
  const cssUrl = process.env.NEXT_PUBLIC_LEAFLET_CSS_URL || DEFAULT_LEAFLET_CSS_URL;
  ensureStylesheet(cssUrl);

  leafletLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-service-map-leaflet="1"][src="${scriptUrl}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Leaflet script failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.dataset.serviceMapLeaflet = "1";
    script.onload = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Leaflet global was not initialized."));
      }
    };
    script.onerror = () => reject(new Error("Leaflet script failed to load."));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

/* Laseb kaardil avatud paneeli uuesti ehitada (seotud funktsioon loeb valiku
   ja vaate värskelt), mõõta ja nähtavale nihutada. `focus`: kuhu fookus pärast
   läheb, sest vana sisu koos fookuses olnud nupuga kaob. */
function refreshPopup(marker, focus = null) {
  const popup = marker?.getPopup?.();
  if (!popup || !marker.isPopupOpen?.()) return;
  popup.update();
  if (!focus) return;
  const element = popup.getElement?.();
  if (!element) return;
  const target = focus.back
    ? element.querySelector(".service-map-popup__contact-back")
    : [...element.querySelectorAll(".service-map-popup__contact-button")].find((button) => button.dataset.entryId === String(focus.entryId || ""));
  target?.focus?.({ preventScroll: false });
}

export default function ServiceMapLeaflet({
  entries = [],
  selectedEntryId = "",
  onSelectEntry,
  onConnectHelpEntry,
  onStartPreInquiry,
  locale = "et",
  t
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const markerRefs = useRef(new Map());
  const markerGroupRefs = useRef(new Map());
  const popupOpenFrameRef = useRef(0);
  const selectedEntryIdRef = useRef(selectedEntryId);
  const onSelectEntryRef = useRef(onSelectEntry);
  const onConnectHelpEntryRef = useRef(onConnectHelpEntry);
  const onStartPreInquiryRef = useRef(onStartPreInquiry);
  const tRef = useRef(t);
  const localeRef = useRef(locale);
  /* Rühm, mille paneelis inimene vajutas „tagasi": seal on ees loend, kuigi
     valik püsib. Uus valik tühjendab selle. */
  const groupListRef = useRef("");
  const lastSelectedRef = useRef(selectedEntryId);
  const [leaflet, setLeaflet] = useState(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    selectedEntryIdRef.current = selectedEntryId;
  }, [selectedEntryId]);

  useEffect(() => {
    onSelectEntryRef.current = onSelectEntry;
  }, [onSelectEntry]);

  useEffect(() => {
    onConnectHelpEntryRef.current = onConnectHelpEntry;
  }, [onConnectHelpEntry]);

  useEffect(() => {
    onStartPreInquiryRef.current = onStartPreInquiry;
  }, [onStartPreInquiry]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;
    let resizeFrame = 0;
    let mapContainer = null;
    const markers = markerRefs.current;
    const markerGroups = markerGroupRefs.current;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;
      mapContainer = containerRef.current;

      try {
        const L = await loadLeafletFromPublicAssets();
        if (cancelled || !mapContainer) return;

        const map = L.map(mapContainer, {
          center: [58.75, 25.2],
          zoom: SERVICE_MAP_MIN_ZOOM,
          minZoom: SERVICE_MAP_MIN_ZOOM,
          maxZoom: 18,
          maxBounds: ESTONIA_BOUNDS,
          maxBoundsViscosity: 1,
          zoomControl: true,
          attributionControl: false,
          worldCopyJump: false,
          fadeAnimation: false
        });

        const tileLayer = L.tileLayer(DEFAULT_TILE_URL, {
          attribution: DEFAULT_ATTRIBUTION,
          minZoom: SERVICE_MAP_MIN_ZOOM,
          maxZoom: 18,
          tms: true,
          noWrap: true,
          updateWhenIdle: true,
          keepBuffer: 3
        }).addTo(map);
        tileLayer.on("tileerror", () => {
          if (!cancelled) setMapError(readText(tRef.current, "workspace_feature_pages.service_map.errors.tiles_failed", "Kaardipõhi ei ole praegu saadaval. Tulemuste loend jääb kasutatavaks."));
        });
        L.control.attribution({ prefix: false }).addTo(map);

        map.fitBounds(ESTONIA_FIT_BOUNDS, { padding: [12, 12] });
        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setLeaflet(L);
        setReady(true);

        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = 0;
            if (
              cancelled ||
              mapRef.current !== map ||
              !mapContainer ||
              !map._container ||
              !map._mapPane
            ) {
              return;
            }
            map.invalidateSize();
          });
        });
        resizeObserver.observe(mapContainer);
      } catch (error) {
        if (!cancelled) {
          setMapError(error?.message || readText(tRef.current, "workspace_feature_pages.service_map.errors.map_failed", "Kaarti ei saanud laadida."));
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (resizeFrame) {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = 0;
      }
      if (popupOpenFrameRef.current) {
        window.cancelAnimationFrame(popupOpenFrameRef.current);
        popupOpenFrameRef.current = 0;
      }
      markers.clear();
      markerGroups.clear();
      markerLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.closePopup?.();
        mapRef.current.off?.();
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (mapContainer) {
        mapContainer.replaceChildren();
        mapContainer.classList.remove("leaflet-container", "leaflet-touch", "leaflet-retina", "leaflet-fade-anim");
        mapContainer.removeAttribute("tabindex");
        mapContainer.removeAttribute("style");
      }
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !mapRef.current || !markerLayerRef.current) return;

    if (popupOpenFrameRef.current) {
      window.cancelAnimationFrame(popupOpenFrameRef.current);
      popupOpenFrameRef.current = 0;
    }
    mapRef.current.closePopup?.();
    markerLayerRef.current.clearLayers();
    markerRefs.current.clear();
    markerGroupRefs.current.clear();

    const bounds = [];
    const groups = groupedEntriesByCoordinates(entries);
    for (const group of groups) {
      const selected = group.entries.some((entry) => entry.id === selectedEntryIdRef.current);

      const icon = leaflet.divIcon({
        className: "",
        html: markerHtml(group, selected),
        iconSize: [42, 50],
        iconAnchor: [21, 49],
        popupAnchor: [0, -46]
      });

      const marker = leaflet.marker(group.coordinates, {
        icon,
        keyboard: true,
        title: group.entries.length > 1
          ? readText(t, "workspace_feature_pages.service_map.marker_group_title", `${group.entries.length} kontakti`)
              .replace("{count}", String(group.entries.length))
          : group.primaryEntry?.title || ""
      });

      /* Paneeli sisu ehitab ALATI see funktsioon: kaart kutsub teda igal
         avamisel ja igal `update()` kutsel ning ta loeb valiku ja vaate
         värskelt. Valmis ehitatud sõlme kaardile ei anta: kaart jätaks selle
         meelde ja näitaks järgmisel avamisel vana kontakti. */
      marker.bindPopup(() => {
        const popup = marker.getPopup?.();
        /* Vaba äär vasakul sõltub kaardi laiusest (suumi nupud); kaart loeb
           selle kohe pärast sisu ehitamist, kui ta paneeli nähtavale nihutab. */
        if (popup) popup.options.autoPanPaddingTopLeft = popupTopLeftPadding(mapRef.current?.getSize?.().x);
        return createGroupedPopupContent(
          group,
          tRef.current,
          onSelectEntryRef.current,
          selectedEntryIdRef.current,
          onConnectHelpEntryRef.current,
          onStartPreInquiryRef.current,
          {
            locale: localeRef.current,
            listForced: groupListRef.current === group.id,
            onBack: (entryId) => {
              groupListRef.current = group.id;
              refreshPopup(marker, { entryId });
            },
            onReopen: () => {
              groupListRef.current = "";
              refreshPopup(marker, { back: true });
            }
          }
        );
      }, {
        className: [
          "service-map-leaflet__popup",
          group.entries.length > 1 ? "service-map-leaflet__popup--group" : "service-map-leaflet__popup--single"
        ].join(" "),
        maxWidth: group.entries.length > 1 ? 460 : 296,
        minWidth: group.entries.length > 1 ? 320 : 216,
        offset: [0, -10],
        autoPan: true,
        keepInView: true,
        /* Juhtriba on kaardi KOHAL, mitte kaardi peal, ja legend peidab end
           avatud paneeli ajaks (workspace.css). Vanad varud (128 px ülal, 84 px
           all) pärinesid ajast, kui riba hõljus kaardi peal: 346 px kõrguses
           kaardialas jäi paneelile nendega 134 px ja ta ei mahtunud kunagi ära.
           Paneeli enda kõrgus on seotud kaardiala kõrgusega samas failis. */
        autoPanPaddingTopLeft: popupTopLeftPadding(mapRef.current?.getSize?.().x),
        autoPanPaddingBottomRight: [POPUP_EDGE_PADDING, POPUP_EDGE_PADDING]
      });
      marker.on("click", () => {
        if (group.entries.length === 1) {
          onSelectEntryRef.current?.(group.primaryEntry?.id);
        }
      });
      marker.addTo(markerLayerRef.current);
      markerGroupRefs.current.set(group.id, marker);
      for (const entry of group.entries) {
        markerRefs.current.set(entry.id, marker);
      }
      bounds.push(group.coordinates);
    }

    if (bounds.length === 1) {
      mapRef.current.setView(bounds[0], Math.max(mapRef.current.getZoom(), 11), { animate: true });
    } else if (bounds.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: [46, 46], maxZoom: 11 });
    } else {
      mapRef.current.fitBounds(ESTONIA_FIT_BOUNDS, { padding: [12, 12] });
    }
  }, [entries, leaflet, t]);

  useEffect(() => {
    if (!leaflet || !mapRef.current || !markerLayerRef.current) return;

    if (popupOpenFrameRef.current) {
      window.cancelAnimationFrame(popupOpenFrameRef.current);
      popupOpenFrameRef.current = 0;
    }

    const groups = groupedEntriesByCoordinates(entries);
    for (const group of groups) {
      const marker = markerGroupRefs.current.get(group.id);
      if (!marker) continue;
      marker.setIcon(
        leaflet.divIcon({
          className: "",
          html: markerHtml(group, group.entries.some((entry) => entry.id === selectedEntryId)),
          iconSize: [42, 50],
          iconAnchor: [21, 49],
          popupAnchor: [0, -46]
        })
      );
    }

    if (!selectedEntryId) {
      lastSelectedRef.current = "";
      groupListRef.current = "";
      mapRef.current.closePopup?.();
      return;
    }

    const selectedMarker = markerRefs.current.get(selectedEntryId);
    const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
    const selectedCoordinates = entryCoordinates(selectedEntry);
    if (selectedMarker && selectedCoordinates) {
      const selectedGroup = groupForEntryId(entries, selectedEntryId);
      /* Uus valik toob valitud kontakti ette; sama valikuga kordus (kirjed või
         keel muutusid) jätab inimese valitud vaate alles. */
      if (lastSelectedRef.current !== selectedEntryId) {
        lastSelectedRef.current = selectedEntryId;
        groupListRef.current = "";
      }
      if (selectedMarker.isPopupOpen?.() && selectedGroup) {
        /* Kui valik tehti paneeli seest, oli fookus seal: pärast uuesti
           ehitamist läheb see „tagasi" nupule, mitte ei kao lehe algusesse. */
        const element = selectedMarker.getPopup?.()?.getElement?.();
        const hadFocus = Boolean(element && element.contains(document.activeElement));
        refreshPopup(selectedMarker, hadFocus ? { back: true } : null);
        return;
      }

      mapRef.current.flyTo(selectedCoordinates, Math.max(mapRef.current.getZoom(), 11), { duration: 0.45 });
      popupOpenFrameRef.current = window.requestAnimationFrame(() => {
        popupOpenFrameRef.current = 0;
        mapRef.current?.closePopup?.();
        if (markerRefs.current.get(selectedEntryId) === selectedMarker) {
          selectedMarker.openPopup();
        }
      });
    }

    return () => {
      if (popupOpenFrameRef.current) {
        window.cancelAnimationFrame(popupOpenFrameRef.current);
        popupOpenFrameRef.current = 0;
      }
    };
  }, [entries, leaflet, selectedEntryId, t]);

  return (
    <div className={`service-map-leaflet-shell ${styles.shell}`}>
      <div
        ref={containerRef}
        className="service-map-leaflet"
        role="application"
        aria-label={readText(t, "workspace_feature_pages.service_map.map_label", "Teenusekaart")}
      />
      <div
        className="service-map-leaflet__legend"
        aria-label={readText(t, "workspace_feature_pages.service_map.marker_legend", "Kaardimarkerite tüübid")}
      >
        <span className="service-map-leaflet__legend-item">
          <span
            className="service-map-leaflet__legend-marker"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markerHtml({ entries: [{ type: "KOV_SOCIAL_CONTACT" }] }, false) }}
          />
          <span>{readText(t, "workspace_feature_pages.service_map.marker_kov", "KOV")}</span>
        </span>
        <span className="service-map-leaflet__legend-item">
          <span
            className="service-map-leaflet__legend-marker"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markerHtml({ entries: [{ type: "SERVICE_PROVIDER" }] }, false) }}
          />
          <span>{readText(t, "workspace_feature_pages.service_map.marker_provider", "Teenuseosutaja")}</span>
        </span>
        <span className="service-map-leaflet__legend-item">
          <span
            className="service-map-leaflet__legend-marker"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markerHtml({ entries: [{ type: "HELP_REQUEST" }] }, false) }}
          />
          <span>{readText(t, "workspace_feature_pages.service_map.marker_help_request", "Abisoov")}</span>
        </span>
        <span className="service-map-leaflet__legend-item">
          <span
            className="service-map-leaflet__legend-marker"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markerHtml({ entries: [{ type: "HELP_OFFER" }] }, false) }}
          />
          <span>{readText(t, "workspace_feature_pages.service_map.marker_help_offer", "Abipakkumine")}</span>
        </span>
      </div>
      {!ready || mapError ? (
        <div className="service-map-leaflet__status">
          {mapError || readText(t, "workspace_feature_pages.service_map.loading_map", "Laen Eesti kaarti...")}
        </div>
      ) : null}
    </div>
  );
}
