"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeServiceMapAccessPath, serviceMapAccessPathHasDetails } from "@/lib/serviceMap/accessPath";

const ESTONIA_BOUNDS = [
  [57.45, 21.35],
  [59.95, 28.35]
];

const ESTONIA_FIT_BOUNDS = [
  [57.52, 21.55],
  [59.85, 28.22]
];

const DEFAULT_TILE_URL =
  "https://tiles.maaamet.ee/tm/tms/1.0.0/hallkaart@GMC/{z}/{x}/{y}.png&ASUTUS=SOTSIAALAI&KESKKOND=LIVE&IS=TEENUSEKAART";

const DEFAULT_ATTRIBUTION = "Maa- ja Ruumiamet";
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

function appendMeta(parent, label, value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const row = document.createElement("p");
  row.className = "service-map-popup__meta";

  const labelElement = document.createElement("span");
  labelElement.className = "service-map-popup__label";
  labelElement.textContent = label;
  row.appendChild(labelElement);

  const valueElement = document.createElement("span");
  valueElement.textContent = text;
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

function accessPathValueLabel(t, group, value) {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  return readText(t, `serviceMap.accessPath.${group}.${normalized}`, normalized);
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
      readText(t, "serviceMap.healthContact.notMedicalPlatform", "SotsiaalAI ei anna meditsiinilist hinnangut, diagnoosi ega ravisoovitust.")
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
  appendMeta(meta, readText(t, "serviceMap.accessPath.sourceStatus", "Allika seis"), accessPathValueLabel(t, "sourceStatuses", accessPath.sourceStatus));
  appendMeta(meta, readText(t, "serviceMap.accessPath.checkedAt", "Viimati kontrollitud"), accessPath.checkedAt);
  if (meta.childNodes.length) section.appendChild(meta);

  const sourceUrl = safeWebsiteUrl(accessPath.sourceUrl || entry?.sourceUrl);
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

function appendServiceItems(parent, entry, t) {
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

function createPopupContent(entry, t, onConnectHelpEntry) {
  if (isHelpMapEntry(entry)) {
    return createHelpListingPopupContent(entry, t, onConnectHelpEntry);
  }

  const root = document.createElement("article");
  root.className = "service-map-popup";

  appendText(root, "h3", "service-map-popup__title", entry.title);
  appendText(root, "p", "service-map-popup__body", popupDescription(entry));

  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.address", "Aadress"), entry.address);
  appendMeta(
    root,
    readText(t, "workspace_feature_pages.service_map.popup.region", "Piirkond"),
    entryRegionText(entry)
  );
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.phone", "Telefon"), entry.phone);
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.email", "E-post"), entry.email);
  appendServiceItems(root, entry, t);
  appendAccessPath(root, entry, t);

  const websiteUrl = safeWebsiteUrl(entry.website);
  if (websiteUrl || entry.email) {
    const actions = document.createElement("div");
    actions.className = "service-map-popup__actions";

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

    root.appendChild(actions);
  }

  return root;
}

function appendGroupedPopupContact(parent, entry, t, onSelectEntry, selectedEntryId, onConnectHelpEntry) {
  const item = document.createElement("article");
  item.className = "service-map-popup__contact";
  if (entry?.id === selectedEntryId) item.dataset.selected = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "service-map-popup__contact-button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectEntry?.(entry.id);
  });

  appendText(button, "span", "service-map-popup__contact-title", entry.title);
  appendText(button, "span", "service-map-popup__contact-description", popupDescription(entry));
  item.appendChild(button);

  appendContactMeta(item, entry);

  const websiteUrl = safeWebsiteUrl(entry.website);
  if (isHelpMapEntry(entry) && !entry?.isOwn) {
    const actions = document.createElement("div");
    actions.className = "service-map-popup__actions service-map-popup__contact-actions";
    appendActionButton(
      actions,
      readText(t, "workspace_feature_pages.service_map.popup.connect", "Võta ühendust"),
      () => onConnectHelpEntry?.(entry)
    );
    item.appendChild(actions);
  } else if (entry.email || websiteUrl) {
    const actions = document.createElement("div");
    actions.className = "service-map-popup__actions service-map-popup__contact-actions";

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

    item.appendChild(actions);
  }

  parent.appendChild(item);
  return item;
}

function createGroupedPopupContent(group, t, onSelectEntry, selectedEntryId, onConnectHelpEntry) {
  if (!group || group.entries.length <= 1) {
    return createPopupContent(group?.primaryEntry || group?.entries?.[0] || {}, t, onConnectHelpEntry);
  }

  const root = document.createElement("article");
  root.className = "service-map-popup service-map-popup--group";
  const primaryEntry = group.primaryEntry || group.entries[0];

  appendText(
    root,
    "h3",
    "service-map-popup__title",
    readText(t, "workspace_feature_pages.service_map.popup.group_title", `${group.entries.length} kontakti`)
      .replace("{count}", String(group.entries.length))
  );
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.address", "Aadress"), primaryEntry.address);
  appendMeta(root, readText(t, "workspace_feature_pages.service_map.popup.region", "Piirkond"), entryRegionText(primaryEntry));

  const list = document.createElement("div");
  list.className = "service-map-popup__contacts";
  for (const entry of group.entries) {
    appendGroupedPopupContact(list, entry, t, onSelectEntry, selectedEntryId, onConnectHelpEntry);
  }
  root.appendChild(list);

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

export default function ServiceMapLeaflet({
  entries = [],
  selectedEntryId = "",
  onSelectEntry,
  onConnectHelpEntry,
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
  const tRef = useRef(t);
  const [leaflet, setLeaflet] = useState(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    tRef.current = t;
  }, [t]);

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

        L.tileLayer(process.env.NEXT_PUBLIC_SERVICE_MAP_TILE_URL || DEFAULT_TILE_URL, {
          attribution: process.env.NEXT_PUBLIC_SERVICE_MAP_ATTRIBUTION || DEFAULT_ATTRIBUTION,
          minZoom: SERVICE_MAP_MIN_ZOOM,
          maxZoom: 18,
          tms: true,
          noWrap: true,
          updateWhenIdle: true,
          keepBuffer: 3
        }).addTo(map);
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

      marker.bindPopup(() => createGroupedPopupContent(
        group,
        tRef.current,
        onSelectEntryRef.current,
        selectedEntryIdRef.current,
        onConnectHelpEntryRef.current
      ), {
        className: [
          "service-map-leaflet__popup",
          group.entries.length > 1 ? "service-map-leaflet__popup--group" : "service-map-leaflet__popup--single"
        ].join(" "),
        maxWidth: group.entries.length > 1 ? 460 : 296,
        minWidth: group.entries.length > 1 ? 320 : 216,
        offset: [0, -10],
        autoPan: true,
        keepInView: true,
        autoPanPaddingTopLeft: [28, 128],
        autoPanPaddingBottomRight: [28, 84]
      });
      marker.on("click", () => {
        onSelectEntryRef.current?.(group.primaryEntry?.id);
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
      mapRef.current.closePopup?.();
      return;
    }

    const selectedMarker = markerRefs.current.get(selectedEntryId);
    const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
    const selectedCoordinates = entryCoordinates(selectedEntry);
    if (selectedMarker && selectedCoordinates) {
      const selectedGroup = groupForEntryId(entries, selectedEntryId);
      if (selectedMarker.isPopupOpen?.() && selectedGroup) {
        selectedMarker.setPopupContent(createGroupedPopupContent(
          selectedGroup,
          tRef.current,
          onSelectEntryRef.current,
          selectedEntryId,
          onConnectHelpEntryRef.current
        ));
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
    <div className="service-map-leaflet-shell">
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
