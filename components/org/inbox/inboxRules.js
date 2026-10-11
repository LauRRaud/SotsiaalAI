/**
 * Vastuvõtu osa (`/org/<id>/vastuvott` ja `/org/<id>/vastuvott/<kirje>`) reeglid
 * ilma joonistamiseta: loendi rida, avatud pöördumise read ja mis töö tegevused
 * on sellel inimesel selle kirjega võimalikud.
 *
 * LOEND EI KANNA LÄHTEOBJEKTI SISU: ainult seisu, üksust ja vastutajat. Sisu
 * avaneb ühe kirje avamisel, mis on eraldi teadlik samm ja mis märgib
 * pöördujale nähtava avamise aja. Tühi loend ei tähenda „viga" ega „pole
 * õigust": õiguseta liige näeb sama tühja lauda kui organisatsioon, kuhu pole
 * veel keegi pöördunud.
 *
 * Lehed (`../OrgInboxClient.jsx`, `../OrgInboxItemClient.jsx`) hoiavad olekut ja
 * teevad päringud, vaated (`./InboxViews.jsx`) joonistavad.
 * Test: `tests/org-work-views.test.mjs`.
 */

import { stampOf } from "../orgRules.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Inimese nimi või tühi sõne. Sisemist ID-d nime asemel ei näidata. */
export function personName(person) {
  return [text(person?.firstName), text(person?.lastName)].filter(Boolean).join(" ");
}

/**
 * Loendi rida: millal pöördumine saabus (loend sisu ei kanna, nii et aeg on see,
 * mille järgi rida ära tunda), selle all üksus ja vastutaja (nimi ja kas ta on
 * töö vastu võtnud); paremal saatja enda märge kiireloomulisusest ja seis.
 * Määramata kirje on tähelepanu vajav.
 */
export function inboxRow(item, { t }) {
  const assignment = item?.assignment || null;
  const assignee = assignment
    ? afterName(personName(assignment) || t("org.inbox.unnamed_worker"), assignment.status ? t(`org.workStatus.${assignment.status}`) : "")
    : t("org.inbox.unassigned");
  return {
    id: String(item?.id || ""),
    title: stampOf(item?.receivedAt),
    sub: [text(item?.unit?.name), assignee].filter(Boolean).join(" · "),
    urgency: text(item?.urgencyDeclaredBySender),
    chip: shownItemStatus(item) ? t(`org.inboxStatus.${shownItemStatus(item)}`) : "",
    /* Loetamatu aeg jääb tühjaks, mitte ei viska viga. */
    receivedAt: stampOf(item?.receivedAt) ? new Date(item.receivedAt).toISOString() : "",
    attention: !assignment
  };
}

/** Nime järel koma taga algab seisu sõna väikese tähega („Jaan Kask, ootab vastust"). */
function afterName(name, status) {
  if (!name) return status;
  return [name, status ? status.charAt(0).toLocaleLowerCase() + status.slice(1) : ""].filter(Boolean).join(", ");
}

/**
 * Kirje seis, nagu see inimesele paistab. Töö üleandmisel viib server kirje ise seisu
 * „määratud" (`handOverWork`, `inboxStatusAfterHandOver` failis `lib/org`), seega uutel
 * ridadel see reegel midagi ei muuda.
 *
 * Reegel jääb alles ridade pärast, mis anti üle enne seda parandust: need on serveris
 * seisus „vastu võetud", kuigi uus vastutaja ei ole veel vastanud, ja lehel seisaks muidu
 * kõrvuti „Vastu võetud" ja „Ootab vastust". Selline rida saab serveris õige seisu kohe,
 * kui uus vastutaja vastab või töö antakse uuesti üle.
 */
export function shownItemStatus(item) {
  const status = item?.status || "";
  return status === "ACCEPTED" && item?.assignment?.status === "PENDING" ? "ASSIGNED" : status;
}

/** Töötajate valikud (määramine, üleandmine). Nimeta liige saab üldnime, mitte sisemise ID. */
export function workerOptions(members, { t, exclude = "" } = {}) {
  return (Array.isArray(members) ? members : [])
    .filter((member) => member?.membershipId && member.membershipId !== exclude)
    .map((member) => ({ value: member.membershipId, label: personName(member.person) || text(member.jobTitle) || t("org.inbox.unnamed_worker") }));
}

/** Vastutaja nimi liikmete loendist (kui see on inimesele nähtav). */
export function assigneeLabel(item, members, { t }) {
  const assignment = item?.assignment || null;
  if (!assignment) return t("org.inbox.unassigned");
  const member = (Array.isArray(members) ? members : []).find((entry) => entry.membershipId === assignment.membershipId);
  const name = personName(member?.person);
  const status = assignment.status ? t(`org.workStatus.${assignment.status}`) : "";
  return afterName(name, status);
}

/** Avatud pöördumise read: seis, vastutaja, saabumise aeg ja saatja märge kiireloomulisusest. */
export function itemFacts(item, members, { t }) {
  return [
    { key: "status", label: t("org.inbox.status"), value: shownItemStatus(item) ? t(`org.inboxStatus.${shownItemStatus(item)}`) : "" },
    { key: "assignee", label: t("org.inbox.assignee"), value: assigneeLabel(item, members, { t }) },
    { key: "received", label: t("org.inbox.receivedAt"), value: stampOf(item?.receivedAt) },
    { key: "urgency", label: t("org.inbox.urgency"), value: text(item?.urgencyDeclaredBySender) }
  ].filter((row) => row.value);
}

/**
 * Saatja kinnitatud paketi osad: teema, olukord ja pöördumise tekst (saatja
 * muudetud tekst, kui see on, muidu koostatud mustand). Tühi osa jääb välja.
 */
export function sourceParts(item, { t }) {
  const source = item?.source || {};
  return [
    { key: "topic", label: t("org.inbox.topic"), value: text(source.topic) },
    { key: "situation", label: t("org.inbox.situation"), value: text(source.situation), long: true },
    { key: "draft", label: t("org.inbox.draft"), value: text(source.userEditedDraft) || text(source.generatedDraft), long: true }
  ].filter((part) => part.value);
}

/**
 * Mis töö tegevused on võimalikud.
 *  - määrata saab see, kellel on töö määramise õigus, ja ainult vastutajata kirjet;
 *  - vastu võtta või tagasi lükata saab AINULT määratud inimene ise (juht ei saa
 *    töötaja eest vastutust võtta) ja ainult vastust ootavat määramist;
 *  - üle anda saab määraja või vastutaja ise;
 *  - sulgeda saab töö määraja.
 * Kirjutuskaitstud organisatsioonis ja tagasi võetud pöördumisel ei ole ühtegi:
 * tühi vorm annaks lubaduse, mida server niikuinii tagasi lükkab.
 */
export function workActions(item, { context, canAssign = false } = {}) {
  const writable = context?.writable !== false;
  const withheld = Boolean(item?.sourceWithheldReason);
  const assignment = item?.assignment || null;
  const mine = Boolean(assignment) && assignment.membershipId === context?.membership?.id;
  const open = writable && !withheld;
  return {
    assign: open && Boolean(canAssign) && !assignment,
    respond: open && mine && assignment?.status === "PENDING",
    handOver: open && Boolean(assignment) && (Boolean(canAssign) || mine),
    close: open && Boolean(canAssign)
  };
}

/** Kas kirjega saab üldse midagi teha (kas töö vaade on olemas). */
export function hasWork(actions) {
  return Boolean(actions?.assign || actions?.respond || actions?.handOver || actions?.close);
}

/** Avatud pöördumise vaated lahtritena. */
export function itemTabs(actions) {
  return ["package", ...(hasWork(actions) ? ["work"] : [])];
}
