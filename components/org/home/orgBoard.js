/**
 * Organisatsioonide avalehe (`/org`) reeglid ilma joonistamiseta: loendi read,
 * kutsete read, mis loend on ees, loomise sammud ja see, mis loomiseks puudu on.
 *
 * MIKS OMAETTE FAIL. Lehe otsused on siin puhaste funktsioonidena, et neid saaks
 * testida käitumise, mitte lähteteksti järgi (`tests/org-home-views.test.mjs`).
 * Leht (`app/org/OrgHomeClient.jsx`) hoiab olekut ja teeb päringu, vaated
 * (`./OrgHomeViews.jsx`) ainult joonistavad.
 */

import { CAPABILITY_TEMPLATES, ORGANIZATION_LEGAL_KINDS } from "@/lib/org/constants";

/** Loomise sammud lehe järjekorras. Loend on kindel: samm ei teki ega kao kirjutamise ajal. */
export const CREATE_STEPS = Object.freeze(["name", "kind", "confirm"]);

/** Serveri piirid (`lib/org/organizations.js`): nimi 200 märki, registrikood 40. */
export const NAME_LIMIT = 200;
export const REGISTRY_CODE_LIMIT = 40;

/* Teine vajutus samal nupul ei tule topeltklõpsust; kinnituse ootus aegub. */
export const PRESS_GAP_MS = 400;
export const CONFIRM_MS = 8000;

export function pressTooSoon(since, now = Date.now()) {
  return Boolean(since) && now - since < PRESS_GAP_MS;
}

/**
 * Tühi loomise vorm. Liik on alguses VALIMATA: vana vorm pakkus ette „Kohalik
 * omavalitsus" ja tähelepanematu looja sai omavalitsuse, mida ta ei mõelnud.
 */
export const EMPTY_FORM = Object.freeze({ displayName: "", legalKind: "", legalName: "", registryCode: "" });

function text(value) {
  return typeof value === "string" ? value : "";
}

/** ISO hetk → `15.10.2026` inimese enda ajavööndis. Vigane väärtus annab tühja sõne. */
export function dayOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/* ---------- Loend -------------------------------------------------------------- */

/**
 * Organisatsiooni rida: nimi, selle all asutuse liik ja inimese koht (ametinimetus,
 * kui see on kirjas). Seis on märgina ainult siis, kui see EI ole „aktiivne":
 * sõna, mis seisab igal real, ei ütle midagi. Peatatud organisatsioon on
 * tähelepanu vajav seis.
 */
export function orgRow(organization, { t }) {
  const status = String(organization?.status || "").toUpperCase();
  const parts = [
    organization?.legalKind ? t(`org.legalKind.${organization.legalKind}`) : "",
    organization?.seatRole ? t(`org.seatRole.${organization.seatRole}`) : "",
    text(organization?.jobTitle).trim()
  ].filter(Boolean);
  return {
    id: String(organization?.id || ""),
    title: text(organization?.displayName).trim(),
    sub: parts.join(" · "),
    chip: status && status !== "ACTIVE" ? t(`org.status.${status}`) : "",
    attention: status === "SUSPENDED"
  };
}

/**
 * Kutse rida: kes kutsub, selle all pakutav koht, üksus ja rollimall, paremal
 * kehtivuse lõpp. Kutset siit vastu võtta ei saa: liitumise link on kutsuja käes
 * (ta saadab selle ise) ja liikmesus tekib alles lingi lehel antud kinnitusega.
 */
export function inviteRow(invite, { t }) {
  const template = CAPABILITY_TEMPLATES[invite?.capabilityTemplate];
  const parts = [
    invite?.seatRole ? t(`org.seatRole.${invite.seatRole}`) : "",
    text(invite?.unitName).trim(),
    template ? t(template.labelKey) : ""
  ].filter(Boolean);
  const day = dayOf(invite?.expiresAt);
  return {
    id: String(invite?.id || ""),
    title: text(invite?.organizationName).trim() || t("org.home.invites.unnamed"),
    sub: parts.join(" · "),
    until: day ? t("org.home.invites.until", { date: day }) : "",
    /* Loetamatu kuupäev jääb tühjaks (`day` on siis tühi), mitte ei viska viga. */
    expiresAt: day ? new Date(invite.expiresAt).toISOString() : ""
  };
}

/**
 * Milline loend on ees. Inimese valik kehtib, kuni selles loendis midagi on;
 * tühja loendit ei näidata. Valikulahtrid on olemas ainult siis, kui mõlemas
 * loendis on midagi. Kui inimene ei kuulu kuhugi, aga talle on kutse, on ees
 * kutsed (muidu jääks kutse tühja lehe taha).
 */
export function boardShown({ organizations = 0, invites = 0 } = {}, wanted = "orgs") {
  const hasOrgs = organizations > 0;
  const hasInvites = invites > 0;
  let shown = wanted === "invites" ? "invites" : "orgs";
  if (shown === "orgs" && !hasOrgs && hasInvites) shown = "invites";
  if (shown === "invites" && !hasInvites) shown = "orgs";
  return { shown, choice: hasOrgs && hasInvites, empty: !hasOrgs && !hasInvites };
}

/* ---------- Loomine ------------------------------------------------------------ */

export function legalKindOptions(t) {
  return ORGANIZATION_LEGAL_KINDS.map((kind) => ({ value: kind, label: t(`org.legalKind.${kind}`) }));
}

/** Kas vormi on midagi kirjutatud või valitud (loobumine küsib siis teist vajutust). */
export function createDirty(form) {
  return ["displayName", "legalKind", "legalName", "registryCode"].some((key) => text(form?.[key]).trim() !== "");
}

/**
 * Mis loomiseks puudu on: `{ key, step }` või null. Nimi ja liik on kohustuslikud
 * (server keeldub ilma nendeta); juriidiline nimi ja registrikood võivad jääda
 * hilisemaks (need saab lisada organisatsiooni seadetes).
 */
export function createProblem(form) {
  if (!text(form?.displayName).trim()) return { key: "org.home.create.need_name", step: "name" };
  if (!ORGANIZATION_LEGAL_KINDS.includes(form?.legalKind)) return { key: "org.home.create.need_kind", step: "kind" };
  return null;
}

/**
 * Sammu numbri heledus kiirmenüüs: tühi, pooleli või tehtud. Nime vaade on
 * tehtud, kui organisatsiooni nimi on kirjas (juriidiline nimi ja registrikood
 * on vabatahtlikud); ainult nende täitmine jätab vaate pooleli.
 */
export function createStepStates(form) {
  const named = text(form?.displayName).trim() !== "";
  const extra = text(form?.legalName).trim() !== "" || text(form?.registryCode).trim() !== "";
  return {
    name: named ? "done" : extra ? "partial" : "empty",
    kind: ORGANIZATION_LEGAL_KINDS.includes(form?.legalKind) ? "done" : "empty",
    confirm: "empty"
  };
}

/** Viivitus enne iseliikumist: inimene näeb, et tema valik märgiti. */
export const AUTO_ADVANCE_MS = 420;

/**
 * Kas liigi valik viib vaate ise edasi. Ainult esimene valik (vastamata vaade
 * sai vastuse) ja ainult siis, kui see tehti vajutusega: nooleklahv valib
 * raadionuppudel järgmise variandi ja kui see vaate ära viiks, ei jõuaks
 * klaviatuuriga kunagi kolmanda variandini.
 */
export function kindAdvances(previousKind, nextKind, { byArrow = false } = {}) {
  if (byArrow) return false;
  return !ORGANIZATION_LEGAL_KINDS.includes(previousKind) && ORGANIZATION_LEGAL_KINDS.includes(nextKind);
}

/**
 * Viimase vaate kokkuvõte: mis läheb kirja. Tühjaks jäetud vabatahtlik väli
 * ütleb seda sõnaga, mitte tühja reaga.
 */
export function createSummary(form, { t }) {
  const missing = t("org.home.create.missing");
  return [
    { key: "displayName", label: t("org.create.displayName"), value: text(form?.displayName).trim() },
    { key: "legalKind", label: t("org.create.legalKindLabel"), value: ORGANIZATION_LEGAL_KINDS.includes(form?.legalKind) ? t(`org.legalKind.${form.legalKind}`) : "" },
    { key: "legalName", label: t("org.create.legalName"), value: text(form?.legalName).trim() || missing, quiet: !text(form?.legalName).trim() },
    { key: "registryCode", label: t("org.create.registryCode"), value: text(form?.registryCode).trim() || missing, quiet: !text(form?.registryCode).trim() }
  ];
}

/**
 * Sama sisuga uus katse kasutab sama toimingu võtit (server tunneb korduse ära
 * ega loo teist organisatsiooni); muudetud sisu saab uue võtme.
 */
export function createFingerprint(form) {
  return JSON.stringify({
    displayName: text(form?.displayName),
    legalKind: text(form?.legalKind),
    legalName: text(form?.legalName),
    registryCode: text(form?.registryCode)
  });
}
