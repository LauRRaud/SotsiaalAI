/**
 * Organisatsiooni laua (`/org/<id>`) reeglid ilma joonistamiseta: mis plaadid
 * laual on ja mis järjekorras, mis lause ütleb inimese koha ja mis ridadena
 * seisab osa „Minu koht".
 *
 * Leht (`../OrgOverviewClient.jsx`) hoiab olekut, vaated (`./DeskViews.jsx`)
 * joonistavad. Kes mis osa näeb, otsustab `../orgParts.js` (sama loend, mida
 * kasutas vana lingirida). Test: `tests/org-desk-views.test.mjs`.
 */

import { visibleOrgParts } from "../orgParts.js";

/**
 * Plaatide järjekord laual: igapäevane töö ees, inimesed keskel, haldus lõpus.
 * Vana lingirida oli tekkimise järjekorras (struktuur enne vastuvõttu).
 */
export const DESK_ORDER = Object.freeze([
  "inbox",
  "home_care",
  "dispatch",
  "service_reports",
  "support",
  "members",
  "invites",
  "structure",
  "profile",
  "funding",
  "audit",
  "settings"
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Laua plaadid: iga osa, mida see liige näeb, nime ja ühe reaga, mis ütleb,
 * mis seal on. Viimane plaat on alati „Minu koht" (`place`): see ei ole omaette
 * marsruut, vaid laua enda teine vaade (`href` puudub).
 */
export function deskTiles(context, { t }) {
  const organizationId = context?.organization?.id || "";
  const rank = (key) => {
    const index = DESK_ORDER.indexOf(key);
    return index < 0 ? DESK_ORDER.length : index;
  };
  const tiles = visibleOrgParts(organizationId, context)
    .filter((part) => part.key !== "overview")
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((part) => ({ key: part.key, href: part.href, name: t(`org.nav.${part.key}`), line: t(`org.desk.lines.${part.key}`) }));
  return [...tiles, { key: "place", href: "", name: t("org.desk.place.name"), line: t("org.desk.lines.place") }];
}

/** Inimese põhiüksuse nimi (või esimese üksuse oma, kui põhiüksust ei ole märgitud). */
export function primaryUnitName(context) {
  const units = Array.isArray(context?.units) ? context.units : [];
  return text((units.find((unit) => unit?.isPrimary) || units[0])?.name);
}

/**
 * Üks rida laua ülaservas: mis kohal inimene siin on. Ametinimetus, kui see on
 * kirjas, muidu koha liik; siis põhiüksus.
 */
export function seatLine(context, { t }) {
  const seatRole = context?.membership?.seatRole;
  return [text(context?.membership?.jobTitle) || (seatRole ? t(`org.seatRole.${seatRole}`) : ""), primaryUnitName(context)].filter(Boolean).join(" · ");
}

/**
 * Miks muudatusi teha ei saa: võti või tühi sõne. Kaks eri põhjust ja neid ei
 * tohi ühte teatesse valada: mustand ootab identiteedikontrolli (tavaline samm),
 * peatamine on platvormi sekkumine. Sama tekst mõlemale ütleks uuele
 * organisatsioonile, et temaga on midagi valesti.
 */
export function deskNoticeKey(context) {
  if (context?.writable !== false) return "";
  const status = context?.organization?.status;
  if (status === "SUSPENDED") return "org.overview.readOnlyNotice";
  /* Mustandit ei ole veel kontrolli saadetud: omanikule öeldakse, kus seda teha
     (vana leht ütles ka mustandi kohta „ootab identiteedikontrolli" ja jättis
     looja ootama kontrolli, mida keegi ei olnud küsinud). */
  if (status === "DRAFT" && hasCapability(context, "ORG_OWNER")) return "org.desk.draft_notice";
  return "org.overview.pendingNotice";
}

/** Kas inimesel on see õigus (ükskõik mis ulatuses). */
export function hasCapability(context, capability) {
  return (Array.isArray(context?.capabilities) ? context.capabilities : []).some((grant) => grant?.capability === capability);
}

/** Seisu märk laua ülaservas: ainult siis, kui organisatsioon ei ole aktiivne. */
export function deskChip(context, { t }) {
  const status = String(context?.organization?.status || "").toUpperCase();
  return status && status !== "ACTIVE" ? { text: t(`org.status.${status}`), attention: status === "SUSPENDED" } : null;
}

/**
 * Õiguse nimi koos ulatusega. Kogu organisatsiooni õigus on lihtsalt nimi;
 * üksusega piiratud õigusel on sulgudes üksuse nimi (kui inimene sinna kuulub)
 * või sõna „üksus".
 */
export function capabilityLabel(grant, units, { t }) {
  const name = t(`org.capability.${grant?.capability}`);
  if (grant?.scopeType !== "UNIT") return name;
  const unit = (Array.isArray(units) ? units : []).find((item) => item?.id && item.id === grant.scopeUnitId);
  return `${name} (${text(unit?.name) || t("org.scope.UNIT")})`;
}

/**
 * Osa „Minu koht" read: seis, asutuse liik, inimese roll, kes ligipääsu
 * rahastab, üksused, õigused ja aktiivsed moodulid. Põhiüksus on öeldud
 * sõnaga (vana leht märkis selle tärniga, mida ekraanilugeja ei seletanud).
 */
export function placeFacts(context, { t }) {
  const organization = context?.organization || {};
  const units = Array.isArray(context?.units) ? context.units : [];
  const capabilities = Array.isArray(context?.capabilities) ? context.capabilities : [];
  const modules = Array.isArray(context?.activeModules) ? context.activeModules : [];
  const seatRole = context?.membership?.seatRole;
  return [
    { key: "status", label: t("org.overview.status"), value: organization.status ? t(`org.status.${organization.status}`) : "" },
    { key: "kind", label: t("org.overview.legalKind"), value: organization.legalKind ? t(`org.legalKind.${organization.legalKind}`) : "" },
    { key: "seat", label: t("org.overview.seatRole"), value: seatRole ? t(`org.seatRole.${seatRole}`) : "" },
    { key: "jobTitle", label: t("org.join.job_title"), value: text(context?.membership?.jobTitle) },
    { key: "payer", label: t("org.payer.label"), value: context?.payerSource ? t(`org.payer.${context.payerSource}`) : "" },
    {
      key: "units",
      label: t("org.overview.yourUnits"),
      value: units.length
        ? units.map((unit) => (unit.isPrimary && units.length > 1 ? t("org.desk.place.primary_unit", { name: unit.name }) : unit.name)).join(", ")
        : t("org.overview.noUnits"),
      quiet: !units.length
    },
    {
      key: "capabilities",
      label: t("org.overview.yourCapabilities"),
      value: capabilities.length ? capabilities.map((grant) => capabilityLabel(grant, units, { t })).join(", ") : t("org.overview.noCapabilities"),
      quiet: !capabilities.length
    },
    {
      key: "modules",
      label: t("org.overview.activeModules"),
      value: modules.length ? modules.map((moduleKey) => t(`org.module.${moduleKey}`)).join(", ") : t("org.overview.noModules"),
      quiet: !modules.length
    }
  ].filter((row) => row.value);
}
