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

import { INBOX_CLOSING_NOTE_LIMIT, OrganizationInboxStatus, canTransitionInboxStatus, isTerminalInboxStatus } from "@/lib/org/constants";

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
 * Määramata kirje on tähelepanu vajav. Lõpetatud kirjel (vaade „Lõpetatud") ei ole vastutajat
 * ega tähelepanu märki: selle asemel seisab, millal töö lõppes.
 */
export function inboxRow(item, { t }) {
  const assignment = item?.assignment || null;
  const finished = isFinishedItem(item);
  const assignee = finished
    ? stampOf(item?.closedAt)
      ? t("org.inbox.finished_at", { date: stampOf(item.closedAt) })
      : ""
    : assignment
      ? afterName(personName(assignment) || t("org.inbox.unnamed_worker"), assignment.status ? t(`org.workStatus.${assignment.status}`) : "")
      : t("org.inbox.unassigned");
  return {
    id: String(item?.id || ""),
    title: stampOf(item?.receivedAt),
    sub: [text(item?.unit?.name), assignee, !finished && item?.dueOn ? `${t("org.inbox.dueOn")} ${dueLabel(item, { t })}` : ""].filter(Boolean).join(" · "),
    urgency: text(item?.urgencyDeclaredBySender),
    chip: shownItemStatus(item) ? t(`org.inboxStatus.${shownItemStatus(item)}`) : "",
    /* Loetamatu aeg jääb tühjaks, mitte ei viska viga. */
    receivedAt: stampOf(item?.receivedAt) ? new Date(item.receivedAt).toISOString() : "",
    attention: !finished && (!assignment || Boolean(item?.overdue))
  };
}

/** Kas kirjega on töö lõppenud (suletud, tagasi lükatud või saatja tagasi võetud). */
export function isFinishedItem(item) {
  return isTerminalInboxStatus(item?.status || "");
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

/**
 * Avatud pöördumise read: seis, vastutaja, saabumise aeg ja saatja märge kiireloomulisusest.
 * Lõpetatud kirjel vastutajat ei ole (elav määramine lõppes koos tööga): „Määramata" oleks
 * seal vale. Selle asemel seisab, millal töö lõppes.
 */
/** Tähtaeg kujul PP.KK.AAAA; möödunud tähtaja järel „üle tähtaja". */
export function dueLabel(item, { t }) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(item?.dueOn || ""));
  if (!match) return "";
  const day = `${match[3]}.${match[2]}.${match[1]}`;
  return item?.overdue ? `${day} · ${t("org.inbox.overdue")}` : day;
}

export function itemFacts(item, members, { t }) {
  const finished = isFinishedItem(item);
  return [
    { key: "status", label: t("org.inbox.status"), value: shownItemStatus(item) ? t(`org.inboxStatus.${shownItemStatus(item)}`) : "" },
    { key: "assignee", label: t("org.inbox.assignee"), value: finished ? "" : assigneeLabel(item, members, { t }) },
    { key: "received", label: t("org.inbox.receivedAt"), value: stampOf(item?.receivedAt) },
    { key: "closed", label: t("org.inbox.closedAt"), value: finished ? stampOf(item?.closedAt) : "" },
    /* Asutuse töö tähtaeg (Eesti kalendripäev); möödunud tähtaeg on kirjas. */
    { key: "due", label: t("org.inbox.dueOn"), value: !finished && item?.dueOn ? dueLabel(item, { t }) : "" },
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
 * Selgitus, mille asutus töö lõpetamisel pöördujale kirjutas (tagasilükkamisel kohustuslik,
 * sulgemisel soovi korral). See ei ole saatja paketi osa ja seisab lehel eraldi. Tühi, kui
 * selgitust ei ole.
 */
export function closingNoteOf(item) {
  return isFinishedItem(item) ? text(item?.closedReason) : "";
}

/**
 * Kas lehel on lause „Sinu avamine on pöördujale nähtav…". Lõpetatud kirjel see enam midagi
 * ei ütle (tagasi võtta ei ole midagi) ja tagasi võetud pöördumist ei avatudki.
 */
export function showsOpenedNotice(item) {
  return !item?.sourceWithheldReason && !isFinishedItem(item);
}

/* --- Töö lõpetamine: selgitus pöördujale ---------------------------------------------
   Sulgemine ja pöördumise tagasilükkamine avavad töö vaates väikese vormi: selgitus
   pöördujale ja mis juhtub. Tagasilükkamisel on selgitus kohustuslik (server keeldub ilma
   selleta: tagasilükkamine ei ole kunagi paljas „ei"), sulgemisel soovi korral. */

export const CLOSING_NOTE_LIMIT = INBOX_CLOSING_NOTE_LIMIT;

/** `kind` → mis võtmetega vorm räägib ja kas selgitus on kohustuslik. */
export const ENDINGS = Object.freeze({
  close: Object.freeze({ required: false, question: "org.inbox.close_question", hint: "org.inbox.close_hint", note: "org.inbox.close_note", submit: "org.inbox.close" }),
  rejectItem: Object.freeze({ required: true, question: "org.inbox.reject_item_question", hint: "org.inbox.reject_item_hint", note: "org.inbox.reject_item_note", submit: "org.inbox.reject_item" })
});

/** Mis lõpetamise vorm on ees: ainult see, mille tegevus on selles seisus võimalik. */
export function activeEnding(kind, actions) {
  return ENDINGS[kind] && actions?.[kind] ? kind : "";
}

/** Miks vormi veel saata ei saa: tühi sõne, kui saab. Võti: `org.inbox.<võti>`. */
export function endingProblem(kind, value) {
  return ENDINGS[kind]?.required && !text(value) ? "reason_first" : "";
}

/** Selgitus nii, nagu see serverisse läheb: kärbitud; tühja ei saadeta. */
export function endingReason(value) {
  return text(value).slice(0, CLOSING_NOTE_LIMIT) || undefined;
}

/* --- Laua loend: töös ja lõpetatud --------------------------------------------------- */

export const INBOX_GROUPS = Object.freeze(["open", "finished"]);

/** Laua lehe aadress: lõpetatud pöördumiste rühm on aadressis, et kirje lehelt saaks sinna tagasi. */
export function inboxPagePath(organizationId, group = "open") {
  return `/org/${organizationId}/vastuvott${group === "finished" ? "?lopetatud=1" : ""}`;
}

/** Mis rühmast kirje pärit on (kuhu „Tagasi loendisse" viib). */
export function groupOfItem(item) {
  return isFinishedItem(item) ? "finished" : "open";
}

/** Loendi päring: rühm „lõpetatud" küsib ainult lõpetatud kirjed, `cursor` järgmise lehe. */
export function inboxListPath(organizationId, { group = "open", cursor = "" } = {}) {
  const query = [group === "finished" ? "closed=1" : "", cursor ? `cursor=${encodeURIComponent(cursor)}` : ""].filter(Boolean).join("&");
  return `/api/org/${organizationId}/inbox${query ? `?${query}` : ""}`;
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
    rejectItem: open && coordinator && canTransitionInboxStatus(status, OrganizationInboxStatus.REJECTED),
    /* Töö tähtaja paneb koordinaator lahtisele kirjele (server: setInboxItemDueDate). */
    setDue: open && coordinator
  };
}

/** Kas kirjega saab üldse midagi teha (kas töö vaade on olemas). */
export function hasWork(actions) {
  return Boolean(actions?.assign || actions?.respond || actions?.handOver || actions?.takeBack || actions?.close || actions?.rejectItem || actions?.setDue);
}

/** Avatud pöördumise vaated lahtritena. */
export function itemTabs(actions) {
  return ["package", ...(hasWork(actions) ? ["work"] : [])];
}
