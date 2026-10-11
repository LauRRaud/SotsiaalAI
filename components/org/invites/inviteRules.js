/**
 * Kutsete osa (`/org/<id>/kutsed`) reeglid ilma joonistamiseta: loendi rida,
 * kutse loomise sammud, mis malle see kutsuja tohib pakkuda ja mis loomiseks
 * puudu on.
 *
 * Leht (`../OrgInvitesClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./InvitesViews.jsx`) joonistavad. Test: `tests/org-invites-views.test.mjs`.
 */

import { CAPABILITY_TEMPLATE_KEYS, CAPABILITY_TEMPLATES, ORGANIZATION_SEAT_ROLES, OWNER_ONLY_INVITE_TEMPLATES, isTemplateOffered } from "@/lib/org/constants";

import { dayOf } from "../orgRules.js";

/** Kutse loomise sammud lehe järjekorras. Loend on kindel: samm ei teki ega kao kirjutamise ajal. */
export const INVITE_STEPS = Object.freeze(["who", "role", "unit", "send"]);

/** Ametinimetuse piir (server lõikab sama koha pealt). */
export const JOB_TITLE_LIMIT = 200;

/** Viivitus enne iseliikumist: inimene näeb, et tema valik märgiti. */
export const AUTO_ADVANCE_MS = 420;

/**
 * Tühi kutse. Koht ja roll on vaikimisi need, mida kutsutakse kõige sagedamini
 * (spetsialisti koht, tavaline liige): nii oli ka vanal vormil.
 */
export const EMPTY_INVITE = Object.freeze({
  email: "",
  firstName: "",
  lastName: "",
  jobTitle: "",
  seatRole: "SOCIAL_WORKER",
  templateKey: "MEMBER",
  primaryUnitId: ""
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/* ---------- Loend -------------------------------------------------------------- */

/**
 * Loendi rida: kellele kutse läks (nimi, kui see pandi kaasa, muidu e-post),
 * selle all e-post (kui nimi on ees), koht, roll ja üksus; paremal kehtivuse
 * lõpp. Seis on märgina ainult siis, kui kutse EI ole ootel (toorest seisu
 * nime, nagu vanal lehel, ei näidata).
 */
export function inviteListRow(invite, { t }) {
  const name = text(invite?.firstName) && text(invite?.lastName) ? `${text(invite.firstName)} ${text(invite.lastName)}` : "";
  const template = CAPABILITY_TEMPLATES[invite?.capabilityTemplate];
  const status = String(invite?.status || "").toUpperCase();
  const day = dayOf(invite?.expiresAt);
  const parts = [
    name ? text(invite?.email) : "",
    text(invite?.jobTitle) || (invite?.seatRole ? t(`org.seatRole.${invite.seatRole}`) : ""),
    template ? t(template.labelKey) : "",
    text(invite?.primaryUnit?.name)
  ].filter(Boolean);
  return {
    id: String(invite?.id || ""),
    title: name || text(invite?.email),
    sub: parts.join(" · "),
    chip: status && status !== "PENDING" ? t(`org.invites.statuses.${status}`) : "",
    until: status === "PENDING" && day ? t("org.home.invites.until", { date: day }) : "",
    expiresAt: day ? new Date(invite.expiresAt).toISOString() : "",
    canRevoke: status === "PENDING"
  };
}

/* ---------- Loomine ------------------------------------------------------------ */

/**
 * Mallid, mida see kutsuja tohib pakkuda: omaniku mallid ainult omanikule ja
 * mooduliga seotud mall ainult siis, kui moodul on aktiivne. Server kontrollib
 * omaniku nõuet ise uuesti.
 */
export function offeredTemplates(context) {
  const isOwner = (context?.capabilities || []).some((grant) => grant?.capability === "ORG_OWNER");
  return CAPABILITY_TEMPLATE_KEYS.filter(
    (key) => (isOwner || !OWNER_ONLY_INVITE_TEMPLATES.includes(key)) && isTemplateOffered(key, context?.activeModules || [])
  );
}

export function seatOptions(t) {
  return ORGANIZATION_SEAT_ROLES.map((role) => ({ value: role, label: t(`org.seatRole.${role}`) }));
}

export function templateOptions(context, t) {
  return offeredTemplates(context).map((key) => ({ value: key, label: t(CAPABILITY_TEMPLATES[key].labelKey) }));
}

/** Üksuse valikud: „üksuseta" ja organisatsiooni üksused. */
export function unitOptions(units, t) {
  return [{ value: "", label: t("org.invites.no_unit") }, ...(Array.isArray(units) ? units : []).map((unit) => ({ value: unit.id, label: unit.name }))];
}

/** Kas see rollimall kehtib ühe üksuse piires (siis on üksus kohustuslik). */
export function templateNeedsUnit(templateKey) {
  return CAPABILITY_TEMPLATES[templateKey]?.scope === "UNIT";
}

/** Nimi läheb kaasa tervikuna: ainult ees- või ainult perekonnanimega kutset server vastu ei võta. */
export function nameHalf(form) {
  return Boolean(text(form?.firstName)) !== Boolean(text(form?.lastName));
}

/** Kas vormi on midagi kirjutatud või vaikevalikut muudetud (loobumine küsib siis teist vajutust). */
export function inviteDirty(form) {
  return Object.keys(EMPTY_INVITE).some((key) => text(form?.[key]) !== EMPTY_INVITE[key]);
}

/** Lihtne e-posti kuju kontroll enne saatmist; päris kontrolli teeb server. */
export function emailLooksRight(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

/**
 * Mis kutse loomiseks puudu on: `{ key, step }` või null. E-post on kohustuslik,
 * nimi tervikuna või üldse mitte, ja üksusega piiratud roll vajab üksust
 * (vanal vormil hoidis seda kinni ainult hall nupp, ilma põhjust ütlemata).
 */
export function inviteProblem(form) {
  if (!emailLooksRight(form?.email)) return { key: "org.invites.need_email", step: "who" };
  if (nameHalf(form)) return { key: "org.errors.invite_name_incomplete", step: "who" };
  if (templateNeedsUnit(form?.templateKey) && !text(form?.primaryUnitId)) return { key: "org.invites.need_unit", step: "unit" };
  return null;
}

/** Sammu numbri heledus kiirmenüüs. Roll ja üksus on vaikevalikuga: need on kohe „tehtud". */
export function inviteStepStates(form) {
  const who = emailLooksRight(form?.email) && !nameHalf(form);
  return {
    who: who ? "done" : text(form?.email) || text(form?.firstName) || text(form?.lastName) || text(form?.jobTitle) ? "partial" : "empty",
    role: "done",
    unit: templateNeedsUnit(form?.templateKey) && !text(form?.primaryUnitId) ? "empty" : "done",
    send: "empty"
  };
}

/** Viimase vaate kokkuvõte: kellele, mis koht, roll ja üksus. Tühi vabatahtlik rida jääb välja. */
export function inviteSummary(form, units, { t }) {
  const template = CAPABILITY_TEMPLATES[form?.templateKey];
  const unit = (Array.isArray(units) ? units : []).find((item) => item.id === form?.primaryUnitId);
  const name = text(form?.firstName) && text(form?.lastName) ? `${text(form.firstName)} ${text(form.lastName)}` : "";
  return [
    { key: "email", label: t("org.invites.email"), value: text(form?.email) },
    { key: "name", label: t("org.invites.name"), value: name },
    { key: "jobTitle", label: t("org.join.job_title"), value: text(form?.jobTitle) },
    { key: "seat", label: t("org.join.seat"), value: form?.seatRole ? t(`org.seatRole.${form.seatRole}`) : "" },
    { key: "role", label: t("org.join.role"), value: template ? t(template.labelKey) : "" },
    { key: "unit", label: t("org.invites.unit"), value: text(unit?.name) || t("org.invites.no_unit"), quiet: !unit }
  ].filter((row) => row.value);
}

/** Kutse link, mida näidatakse ainult üks kord. */
export function inviteLink(origin, token) {
  return `${origin}/org/liitu?token=${encodeURIComponent(token)}`;
}
