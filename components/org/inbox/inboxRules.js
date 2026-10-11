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

import { OrganizationInboxStatus, canTransitionInboxStatus, isTerminalInboxStatus } from "@/lib/org/constants";

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
 * Mis töö tegevused on võimalikud. LEHT PAKUB AINULT SEDA, MIDA SERVER SELLES SEISUS LUBAB:
 * nupp, mille vajutus saab keeldumise, on lubadus, mida ei ole.
 *  - määrata saab see, kellel on töö määramise õigus, ja ainult vastutajata kirjet, mille
 *    seisust viib siire „määratuks" (`assignWork`);
 *  - vastu võtta või tagasi lükata saab AINULT määratud inimene ise (juht ei saa
 *    töötaja eest vastutust võtta) ja ainult vastust ootavat määramist;
 *  - üle anda saab määraja või vastutaja ise;
 *  - sulgeda saab KOORDINAATOR, mitte töö määraja (`transitionInboxItem`), ja ainult kirjet,
 *    mille seisust viib siire „suletuks": täna kirjet, millel on vastutaja. Kas inimene on
 *    selle kirje koordinaator, ütleb server kirje küljes (`item.isCoordinator`);
 *  - töö töötajalt tagasi võtta saab samuti koordinaator ja ainult kirjel, millel on
 *    vastutaja: käsitsi „ootab määramist" lõpetab seal elava määramise. Vastutajata kirjel
 *    muudaks sama päring ainult seisu sõna, seda leht ei paku;
 *  - pöördumise tagasi lükata saab koordinaator kirjel, mille seisust viib siire „tagasi
 *    lükatuks": täna kirjel, millel ei ole vastutajat (ka pärast töötaja tagasilükkamist või
 *    töö tagasivõtmist). See on vastutajata pöördumise lõpetamise tee (omaniku otsus
 *    11.10.2026); vastutajaga töö lõpetab „sulge".
 * Seisud küsitakse samalt seisutabelilt, millelt server (`lib/org/constants.js`), mitte
 * siinsest teisest loendist. Lõpetatud kirjel (suletud, tagasi lükatud, saatja tagasi võetud),
 * kirjutuskaitstud organisatsioonis ja tagasi võetud pöördumisel ei ole ühtegi tegevust.
 * Serveri pool, kus iga pakutud tegevus ka päriselt tehakse:
 * `tests/org-inbox-manual-status.test.mjs`.
 */
export function workActions(item, { context, canAssign = false } = {}) {
  const writable = context?.writable !== false;
  const withheld = Boolean(item?.sourceWithheldReason);
  const status = item?.status || "";
  const assignment = item?.assignment || null;
  const mine = Boolean(assignment) && assignment.membershipId === context?.membership?.id;
  const open = writable && !withheld && !isTerminalInboxStatus(status);
  const coordinator = Boolean(item?.isCoordinator);
  return {
    assign: open && Boolean(canAssign) && !assignment && canTransitionInboxStatus(status, OrganizationInboxStatus.ASSIGNED),
    respond: open && mine && assignment?.status === "PENDING",
    handOver: open && Boolean(assignment) && (Boolean(canAssign) || mine),
    takeBack: open && coordinator && Boolean(assignment) && canTransitionInboxStatus(status, OrganizationInboxStatus.ASSIGNMENT_PENDING),
    close: open && coordinator && canTransitionInboxStatus(status, OrganizationInboxStatus.CLOSED),
    rejectItem: open && coordinator && canTransitionInboxStatus(status, OrganizationInboxStatus.REJECTED)
  };
}

/** Kas kirjega saab üldse midagi teha (kas töö vaade on olemas). */
export function hasWork(actions) {
  return Boolean(actions?.assign || actions?.respond || actions?.handOver || actions?.takeBack || actions?.close || actions?.rejectItem);
}

/** Avatud pöördumise vaated lahtritena. */
export function itemTabs(actions) {
  return ["package", ...(hasWork(actions) ? ["work"] : [])];
}
