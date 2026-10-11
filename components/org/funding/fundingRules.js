/**
 * Rahastuse osa (`/org/<id>/arveldus`) reeglid ilma joonistamiseta: kohaplaani
 * rida ja read, kellele saab koha anda, uue plaani vorm ja pöördujate tasutud
 * ligipääsu read.
 *
 * MIDA SIIN EI OLE JA EI TULE: ühegi inimese kasutussagedust, vestluste arvu,
 * aktiivsusaega ega tootlikkust. Organisatsioon näeb, KELLE eest ta maksab,
 * mitte seda, mida see inimene teeb (arenduskava §5.6, §7.4).
 *
 * Leht (`../OrgFundingClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./FundingViews.jsx`) joonistavad. Test: `tests/org-funding-views.test.mjs`.
 */

import { CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS, ORGANIZATION_SEAT_ROLES, SEAT_ROLE_REFERENCE_PRICE_CENTS } from "@/lib/org/constants";

/** Osa vaated lahtritena. */
export const FUNDING_TABS = Object.freeze(["plans", "sponsorships"]);

/** Tühi uue plaani vorm: spetsialisti koht ja üks koht, nagu vanal vormil. */
export const EMPTY_PLAN = Object.freeze({ seatRole: "SOCIAL_WORKER", seatLimit: "1" });

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Sendid → `12,99 €`. Puuduv või vigane summa annab tühja sõne (mitte null eurot). */
export function moneyText(cents, locale = "et") {
  if (cents === null || cents === undefined || cents === "") return "";
  const amount = Number(cents);
  if (!Number.isFinite(amount) || amount < 0) return "";
  try {
    return new Intl.NumberFormat(locale || "et", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(amount / 100);
  } catch {
    return "";
  }
}

/** Inimese nimi; nimeta inimese puhul e-post. Sisemist ID-d ei näidata. */
export function seatPersonName(person, { t }) {
  return [text(person?.firstName), text(person?.lastName)].filter(Boolean).join(" ") || text(person?.email) || t("org.inbox.unnamed_worker");
}

/**
 * Kohaplaani rida: mis kohad, selle all mitu on hõivatud ja mitu vaba ning
 * ühikuhind. Seis on märgina ainult siis, kui plaan EI ole aktiivne.
 */
export function planRow(plan, { t, locale }) {
  const status = String(plan?.status || "").toUpperCase();
  return {
    id: String(plan?.id || ""),
    title: plan?.seatRole ? t(`org.seatRole.${plan.seatRole}`) : "",
    sub: [
      t("org.funding.used_of", { used: Number(plan?.usedSeats) || 0, limit: Number(plan?.seatLimit) || 0 }),
      t("org.funding.free_count", { count: Number(plan?.freeSeats) || 0 }),
      moneyText(plan?.unitPriceCents, locale)
    ]
      .filter(Boolean)
      .join(" · "),
    chip: status && status !== "ACTIVE" ? t(`org.seatPlanStatus.${status}`) : ""
  };
}

/**
 * Avatud plaani read: kohad (hõivatud ja vabad ühel real), hind (koos põhjusega,
 * kui hind erineb võrdlushinnast) ja alus. Seis on real ainult siis, kui plaan EI
 * ole aktiivne.
 */
export function planFacts(plan, { t, locale }) {
  const status = String(plan?.status || "").toUpperCase();
  return [
    {
      key: "seats",
      label: t("org.funding.seatLimit"),
      value: `${t("org.funding.used_of", { used: Number(plan?.usedSeats) || 0, limit: Number(plan?.seatLimit) || 0 })}, ${t("org.funding.free_count", { count: Number(plan?.freeSeats) || 0 })}`
    },
    { key: "price", label: t("org.funding.price"), value: moneyText(plan?.unitPriceCents, locale) },
    { key: "reason", label: t("org.funding.priceReason"), value: text(plan?.priceReason) },
    { key: "source", label: t("org.funding.source"), value: plan?.source ? t(`org.seatPlanSource.${plan.source}`) : "" },
    { key: "status", label: t("org.funding.status"), value: status && status !== "ACTIVE" ? t(`org.seatPlanStatus.${status}`) : "" }
  ].filter((row) => row.value);
}

/** Inimesed, kellel on selle plaani koht. */
export function seatedPeople(plan, { t }) {
  return (Array.isArray(plan?.assignments) ? plan.assignments : []).map((assignment) => ({ id: String(assignment.id), label: seatPersonName(assignment.person, { t }) }));
}

/**
 * Kellele saab selle plaani koha anda: sama rolliga aktiivsed liikmed, kellel
 * kohta veel ei ole. Koht on liikmesuse kohta ÜKS, seega arvestatakse kõiki
 * plaane, mitte ainult seda: server keelduks, aga inimesele näeks see välja nagu
 * viga tema toimingus.
 */
export function assignableMembers(plan, seatPlans, members, { t }) {
  const seated = new Set((Array.isArray(seatPlans) ? seatPlans : []).flatMap((item) => (item.assignments || []).map((assignment) => assignment.membershipId)));
  return (Array.isArray(members) ? members : [])
    .filter((member) => member.seatRole === plan?.seatRole && member.status === "ACTIVE" && !seated.has(member.membershipId))
    .map((member) => ({ value: member.membershipId, label: seatPersonName(member.person, { t }) }));
}

/** Mis avatud plaaniga teha saab: kirjutuskaitstud organisatsioonis ja lõppenud plaaniga mitte midagi. */
export function planActions(plan, { writable = true } = {}) {
  const open = Boolean(writable) && plan?.status === "ACTIVE";
  return { assign: open && (Number(plan?.freeSeats) || 0) > 0, release: Boolean(writable), end: open };
}

export function seatRoleOptions(t) {
  return ORGANIZATION_SEAT_ROLES.map((role) => ({ value: role, label: t(`org.seatRole.${role}`) }));
}

/** Uue plaani kohtade arv numbrina või null, kui see ei ole täisarv nullist ülespoole. */
export function seatLimitOf(form) {
  const raw = text(String(form?.seatLimit ?? ""));
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** Mis plaani lisamiseks puudu on: võti või tühi sõne. */
export function planProblemKey(form) {
  return seatLimitOf(form) === null ? "org.funding.need_limit" : "";
}

/** Koha võrdlushind selle rolli jaoks. */
export function seatReferencePrice(seatRole, locale) {
  return moneyText(SEAT_ROLE_REFERENCE_PRICE_CENTS[seatRole], locale);
}

/** Pöörduja tasutud ligipääsu võrdlushind. */
export function sponsorshipReferencePrice(locale) {
  return moneyText(CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS, locale);
}

/**
 * Tasutud ligipääsu rida: kelle eest makstakse ja kui palju. Seis on märgina
 * ainult siis, kui pakkumine EI ole ootel; tühistada saab ainult ootel pakkumist.
 */
export function sponsorshipRow(row, { t, locale, writable = true } = {}) {
  const status = String(row?.status || "").toUpperCase();
  return {
    id: String(row?.id || ""),
    title: text(row?.email),
    sub: moneyText(row?.unitPriceCents, locale),
    chip: status && status !== "PENDING" ? t(`org.invites.statuses.${status}`) : "",
    canRevoke: Boolean(writable) && status === "PENDING"
  };
}

/** Lihtne e-posti kuju kontroll enne saatmist; päris kontrolli teeb server. */
export function emailLooksRight(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

/** Tasutud ligipääsu link, mida näidatakse ainult üks kord. */
export function sponsorshipLink(origin, token) {
  return `${origin}/org/toetus?token=${encodeURIComponent(token)}`;
}

/** Milline vaade on ees: inimese valik, kui see on päris vaade. */
export function shownFundingTab(wanted) {
  return FUNDING_TABS.includes(wanted) ? wanted : "plans";
}
