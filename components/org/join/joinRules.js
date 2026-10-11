/**
 * Kutse (`/org/liitu`) ja tasutud ligipääsu pakkumise (`/org/toetus`) lehtede
 * reeglid ilma joonistamiseta: mis seisus leht on ja mis ridadena eelvaade
 * inimesele ette loetakse.
 *
 * Mõlemad lehed on kaheastmelised (arenduskava §5.5): eelvaade ei muuda midagi,
 * nõustumine on eraldi tegu. Lehed (`../OrgJoinClient.jsx`,
 * `../OrgSponsorshipClient.jsx`) hoiavad olekut ja teevad päringud, vaated
 * (`./JoinViews.jsx`) joonistavad. Test: `tests/org-join-views.test.mjs`.
 */

import { CAPABILITY_TEMPLATES } from "@/lib/org/constants";

import { dayOf } from "../orgRules.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Lehe seis:
 *  - "no_token": lingil ei ole võtit (vana leht jäi siis tühjaks);
 *  - "leaving":  nõustumine õnnestus, järgmine leht avaneb (nupud on lukus);
 *  - "done":     inimene keeldus või pakkumine on vastu võetud;
 *  - "preview":  eelvaade on ees;
 *  - "failed":   eelvaadet ei saadud (võti ei kehti, on aegunud või teisele aadressile);
 *  - "waiting":  eelvaadet alles küsitakse.
 */
export function joinState({ token, preview, done, error, leaving } = {}) {
  if (!text(token)) return "no_token";
  if (leaving) return "leaving";
  if (done) return "done";
  if (preview) return "preview";
  if (error) return "failed";
  return "waiting";
}

/**
 * Kutse eelvaate read: asutuse liik, pakutav koht, ametinimetus, üksus, roll,
 * õigused ja kehtivuse lõpp. Tühi rida jääb välja (vana leht näitas üksuseta
 * kutsel kriipsu). Õiguste rida on alati olemas: kui haldusõigusi ei anta,
 * ütleb rida seda sõnadega.
 */
export function inviteFacts(preview, { t }) {
  const capabilities = Array.isArray(preview?.capabilities) ? preview.capabilities : [];
  /* Tundmatu rollimall jääb välja: toorest sisemist nime ei näidata. */
  const template = CAPABILITY_TEMPLATES[preview?.capabilityTemplate];
  return [
    { key: "kind", label: t("org.overview.legalKind"), value: preview?.organization?.legalKind ? t(`org.legalKind.${preview.organization.legalKind}`) : "" },
    { key: "seat", label: t("org.join.seat"), value: preview?.seatRole ? t(`org.seatRole.${preview.seatRole}`) : "" },
    { key: "jobTitle", label: t("org.join.job_title"), value: text(preview?.jobTitle) },
    { key: "unit", label: t("org.invites.unit"), value: text(preview?.unit?.name) },
    { key: "role", label: t("org.join.role"), value: template ? t(template.labelKey) : "" },
    {
      key: "capabilities",
      label: t("org.members.capabilities"),
      value: capabilities.length ? capabilities.map((capability) => t(`org.capability.${capability}`)).join(", ") : t("org.join.no_capabilities"),
      quiet: !capabilities.length
    },
    { key: "expires", label: t("org.invites.expiresAt"), value: dayOf(preview?.expiresAt) }
  ].filter((row) => row.value);
}

/** Kes kutsub või pakub. Nimeta organisatsioon saab üldnime, mitte tühja koha. */
export function organizationName(preview, { t }) {
  return text(preview?.organization?.displayName) || t("org.home.invites.unnamed");
}

/** Kutsuja pandud nimi ühe sõnena või tühi, kui nime kaasas ei ole. */
export function offeredName(preview) {
  const first = text(preview?.name?.firstName);
  const last = text(preview?.name?.lastName);
  return first && last ? `${first} ${last}` : "";
}

/** Kuutasu inimese keeles: sendid → `7,99 €`. Vigane summa annab tühja sõne. */
export function priceText(preview, locale = "et") {
  const raw = preview?.unitPriceCents;
  /* Puuduv summa ei ole null eurot (`Number(null)` on 0). */
  if (raw === null || raw === undefined || raw === "") return "";
  const cents = Number(raw);
  if (!Number.isFinite(cents) || cents < 0) return "";
  try {
    return new Intl.NumberFormat(locale || "et", { style: "currency", currency: preview?.currency || "EUR", minimumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return "";
  }
}

/** Tasutud ligipääsu pakkumise read: kes maksab ja kui palju kuus. */
export function offerFacts(preview, { t, locale }) {
  return [
    { key: "payer", label: t("org.sponsorship.payer"), value: organizationName(preview, { t }) },
    { key: "price", label: t("org.sponsorship.price"), value: priceText(preview, locale) }
  ].filter((row) => row.value);
}
