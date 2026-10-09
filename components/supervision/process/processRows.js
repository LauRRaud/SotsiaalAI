/**
 * Supervisiooni protsessi laua osad, read, sildid ja reeglid ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Sama põhjus mis `../entry/entryRows.js`-il ja
 * `components/casework/caseViews.js`-il: kuni osa seis ja rea sisu sündisid
 * JSX-failis, ei saanud testida, mida plaat ütleb, milline nupp real on ja mis
 * päringusse läheb. Siin on puhtad funktsioonid; lehed
 * (`../SupervisionProcessPage.jsx`, `../SupervisionSharePage.jsx`,
 * `../SupervisionClosePage.jsx`) ja osade hoidjad (`../*Panel.jsx`) hoiavad
 * andmeid ja päringuid, vaated (`./*Views.jsx`) ainult joonistavad.
 *
 * TOORES KOOD EI JÕUA EKRAANILE. Vana leht trükkis osaleja, kontraktiversiooni
 * ja kokkuvõtte seisu otse serveri väärtusena (`INVITED`, `SUPERSEDED`,
 * `PENDING_APPROVAL`). Siin on serveri väärtused loendis ja igal on sõna
 * kataloogis; tundmatu väärtus annab tühja sildi (märki siis ei joonistata).
 * Loendeid hoiab serveriga koos `tests/supervision-process-views.test.mjs`.
 *
 * ÕIGUSED TULEVAD SERVERILT. Mida vaataja teha saab, ütleb protsessi vastuse
 * `capabilities`; siin ei tuletata õigust rollist. Rolli loetakse ainult seal,
 * kus server ise rolli järgi otsustab ja lipp seda ei kanna (kontrakti
 * kinnitamine on ainult kinnitamata osaleja tegu).
 */

import { localizePath } from "@/lib/localizePath";

import { dayText, excerpt, processHref, roleLabel, statusLabel, typeLabel } from "../entry/entryRows";
import { SUPERVISION_AREAS } from "../supervisionClient";

/* --- Serveri väärtused ---------------------------------------------------- */

/** `SupervisionContractStatus` (prisma/schema.prisma). */
export const CONTRACT_STATUSES = Object.freeze(["DRAFT", "ACTIVE", "SUPERSEDED"]);
/** `SupervisionParticipationStatus` (prisma/schema.prisma). */
export const PARTICIPATION_STATUSES = Object.freeze(["INVITED", "ACCEPTED", "DECLINED", "LEFT", "WITHDRAWN"]);
/** `SupervisionPrivateItemKind` (prisma/schema.prisma). */
export const PRIVATE_ITEM_KINDS = Object.freeze(["PREP_TOPIC", "PRIVATE_NOTE", "CLOSING_REFLECTION"]);
/** `SupervisionTopicAudience` (prisma/schema.prisma). */
export const TOPIC_AUDIENCES = Object.freeze(["SUPERVISOR_ONLY", "PROCESS"]);
/** `SupervisionMeetingStatus` (prisma/schema.prisma). */
export const MEETING_STATUSES = Object.freeze(["PLANNED", "HELD", "CANCELLED"]);
/** `SupervisionSummaryStatus` (prisma/schema.prisma). Kõrvale jäetud kokkuvõtet server kellelegi ei anna. */
export const SUMMARY_STATUSES = Object.freeze(["DRAFT", "PENDING_APPROVAL", "APPROVED", "DISCARDED"]);

const SUPERVISOR_ROLE = "SV";
const STALE_ROLE = "OS_STALE";
const CLOSED = "CLOSED";
const HANDOFF = "WELLBEING_HANDOFF";

const PROCESS_TONES = Object.freeze({ DRAFT: "wait", ACTIVE: "ok", CLOSED: "quiet" });
const CONTRACT_TONES = Object.freeze({ DRAFT: "wait", ACTIVE: "ok", SUPERSEDED: "quiet" });
const PARTICIPATION_TONES = Object.freeze({ INVITED: "wait", ACCEPTED: "ok", DECLINED: "quiet", LEFT: "quiet", WITHDRAWN: "quiet" });
const MEETING_TONES = Object.freeze({ PLANNED: "wait", HELD: "ok", CANCELLED: "quiet" });
const SUMMARY_TONES = Object.freeze({ DRAFT: "quiet", PENDING_APPROVAL: "wait", APPROVED: "ok", DISCARDED: "quiet" });
/* Kohtumise seisu sõnad on kataloogis vanade võtmete all (`supervision.meetings.*`). */
const MEETING_WORD_KEYS = Object.freeze({ PLANNED: "planned", HELD: "held", CANCELLED: "cancelled" });

const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => String(value ?? "").trim();

/** Kataloogi sõna serveri väärtusele; tundmatu väärtus annab tühja sõne, mitte võtme. */
function word(t, base, known, value) {
  const code = String(value || "");
  return known.includes(code) ? t(`${base}.${code}`) : "";
}

export const contractStatusLabel = (status, t) => word(t, "supervision.process.contract.versionStatus", CONTRACT_STATUSES, status);
export const participationLabel = (status, t) => word(t, "supervision.process.participants.status", PARTICIPATION_STATUSES, status);
export const privateKindLabel = (kind, t) => (PRIVATE_ITEM_KINDS.includes(String(kind || "")) ? t(`supervision.eeskamber.kind_${kind}`) : "");
export const audienceLabel = (audience, t) => (TOPIC_AUDIENCES.includes(String(audience || "")) ? t(`supervision.share.audience_${audience}`) : "");
export const meetingStatusLabel = (status, t) => (MEETING_WORD_KEYS[status] ? t(`supervision.meetings.${MEETING_WORD_KEYS[status]}`) : "");
export const summaryStatusLabel = (status, t) => word(t, "supervision.process.summaries.status", SUMMARY_STATUSES, status);

/** Kuupäev ja kellaaeg lugeja keeles; vigane või puuduv väärtus annab tühja sõne. */
export function timeText(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/* --- Laua osad ------------------------------------------------------------ */

/**
 * Osade võtmed. Viis esimest ankrut on vana lehe sakkide omad ja jäävad
 * muutmata (`?ala=`): neid sihivad teavitused ja „Jätka siit"
 * (lib/supervision/notifications.js). Uued osad said oma ankru samas keeles.
 */
export const PART = Object.freeze({
  PROCESS: "protsess",
  CONTRACT: SUPERVISION_AREAS.KONTRAKT,
  PARTICIPANTS: "osalejad",
  ANTECHAMBER: SUPERVISION_AREAS.EESKAMBER,
  TOPICS: "teemad",
  MEETINGS: SUPERVISION_AREAS.KOHTUMISED,
  SUMMARIES: SUPERVISION_AREAS.KOKKUVOTTED,
  CABINET: SUPERVISION_AREAS.KAPP,
  CLOSE: "sulgemine",
  LEAVE: "lahkumine",
  CLOSED: "suletud"
});

/** Kõik osad, mis laual olla võivad; nimed on kataloogis `supervision.process.views.<võti>`. */
export const PART_KEYS = Object.freeze([
  PART.CLOSED,
  PART.PROCESS,
  PART.CONTRACT,
  PART.PARTICIPANTS,
  PART.ANTECHAMBER,
  PART.TOPICS,
  PART.MEETINGS,
  PART.SUMMARIES,
  PART.CABINET,
  PART.CLOSE,
  PART.LEAVE
]);

/* Tekst või loend võib olla pikk: nende järgi lava ühist kõrgust ei võeta. */
const FREE_PARTS = new Set([
  PART.PROCESS,
  PART.CONTRACT,
  PART.PARTICIPANTS,
  PART.ANTECHAMBER,
  PART.TOPICS,
  PART.MEETINGS,
  PART.SUMMARIES,
  PART.CABINET
]);

export const isClosed = (process) => process?.status === CLOSED;

/**
 * Selle vaataja osad selles protsessis.
 *
 * Suletud protsessis seisab ees osa „Suletud" (mis kustus, mis jäi, minu pakk)
 * ja jagatud teemade osa ei ole: sulgemine kustutab need. Sulgemise osa on
 * superviisoril, lahkumise osa osalejal; mõlema otsustab serveri lipp.
 */
export function processPartKeys(process) {
  const closed = isClosed(process);
  const capabilities = process?.capabilities || {};
  return PART_KEYS.filter((key) => {
    if (key === PART.CLOSED) return closed;
    if (key === PART.TOPICS) return !closed;
    if (key === PART.CLOSE) return Boolean(capabilities.canClose);
    if (key === PART.LEAVE) return Boolean(capabilities.canLeave);
    return true;
  });
}

/** `?ala=` väärtus → osa võti. Tundmatu või puuduv väärtus tähendab kõigi osade vaadet. */
export function partFromSearch(value, keys = PART_KEYS) {
  const key = text(value).toLowerCase();
  return key && keys.includes(key) ? key : "";
}

/**
 * Avatud osa pärast seda, kui osa `key` teatas, kas ta on ees (`active`).
 *
 * Lava ütleb sammu vahetust ainult siis, kui number muutub; kõigi osade
 * vaatesse minekut ta ei teata. Seepärast teatab iga osa ise. Kui osa läheb
 * eest ära ja ükski teine ette ei tule, on ees kõigi osade vaade (tühi võti).
 * Teise osa lahkumise teade ei tohi äsja ette tulnud osa maha võtta: teadete
 * järjekord ühe vahetuse sees ei ole kindel.
 */
export function markedPart(current, key, active) {
  if (active) return key;
  return current === key ? "" : current;
}

/* Teed on lokaalineutraalsed nagu avalehtedel (`localizePath` eemaldab keeleprefiksi). */
export const partHref = (processId, part, params = {}) => {
  const query = new URLSearchParams();
  if (part) query.set("ala", part);
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, String(value));
  }
  const tail = query.toString();
  return tail ? `${processHref(processId)}?${tail}` : processHref(processId);
};
export const shareHref = (processId, itemId) =>
  localizePath(`/supervisioon/${encodeURIComponent(String(processId))}/jaga?item=${encodeURIComponent(String(itemId))}`);
export const closeHref = (processId) => localizePath(`/supervisioon/${encodeURIComponent(String(processId))}/sulge`);

/**
 * Aadressiriba päring pärast osa vahetust: `ala` on avatud osa, kõigi osade
 * vaates seda ei ole. Otselingi `summary` kuulub kokkuvõtete osa juurde ja
 * kaob, kui inimene liigub mujale. Muud päringuosad jäävad puutumata.
 */
export function searchWithPart(search, part) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  if (part) params.set("ala", part);
  else params.delete("ala");
  if (part !== PART.SUMMARIES) params.delete("summary");
  const tail = params.toString();
  return tail ? `?${tail}` : "";
}

/* 409 vastused, mille põhjus ei ole kellegi teise muudatus, vaid protsessi seis. */
const CONFLICT_REASONS = Object.freeze(["supervision.errors.already_closed", "supervision.errors.contract_not_accepted"]);

/**
 * Lause lava kohale, kui server vastab 409.
 *
 * Vana leht ütles iga 409 peale „Keegi muutis seda vahepeal". Server annab 409
 * ka siis, kui protsess on juba suletud või kehtiv kontraktiversioon on
 * kinnitamata: neil kahel juhul öeldakse põhjus välja. Muu 409 peale jääb vana
 * lause; värske seis laetakse igal juhul.
 */
export function conflictNotice(payload, t) {
  const key = String(payload?.messageKey || "");
  return t(CONFLICT_REASONS.includes(key) ? key : "supervision.common.conflictReload");
}

/** Liitunud osalejate arv: sama arv, mille pealt server kokkuvõtte kinnitatuks loeb. */
export function acceptedCount(process) {
  return list(process?.participants).filter((row) => row?.status === "ACCEPTED").length;
}

/**
 * Kas vaataja peab kehtiva kontraktiversiooni veel kinnitama.
 *
 * Vana leht küsis „on osalus ja kinnitust ei ole" ja näitas kinnitamise nuppu
 * ka lahkunud osalejale, kelle päringu server tagasi lükkab (404). Kinnitada
 * saab ainult liitunud osaleja, kellel kehtiva versiooni kinnitus puudub.
 */
export function needsContractAcceptance(process) {
  return process?.viewerRole === STALE_ROLE && Boolean(process?.activeContract) && !isClosed(process);
}

/** Lava kohal: milline protsess on lahti, vaataja roll ja protsessi seis. */
export function processHead(process, { t }) {
  const role = roleLabel(process?.viewerRole, t);
  const status = statusLabel(process?.status, t);
  return {
    title: text(process?.title) || t("supervision.home.untitled"),
    chips: [
      role ? { key: "role", text: role, tone: "quiet", prefix: t("supervision.home.roleLabel") } : null,
      status ? { key: "status", text: status, tone: PROCESS_TONES[process?.status] || "quiet" } : null
    ].filter(Boolean)
  };
}

/**
 * Osa „Protsess": faktid ja eesmärk.
 *
 * Vana leht eesmärki ega kavandatud kohtumiste arvu ei näidanud, kuigi loomise
 * vorm ütleb, et eesmärki näevad protsessi liikmed. Sulgemine kustutab
 * eesmärgi (lib/supervision/closure.js), seepärast ütleb suletud protsess seda.
 */
export function processFacts(process, { t }) {
  const goal = text(process?.goal);
  const count = Number(process?.plannedMeetingCount);
  return [
    { key: "type", label: t("supervision.create.typeLabel"), value: typeLabel(process?.type, t) },
    { key: "supervisor", label: t("supervision.roles.SV"), value: text(process?.supervisorName) },
    { key: "status", label: t("supervision.process.facts.status"), value: statusLabel(process?.status, t) },
    { key: "role", label: t("supervision.home.roleLabel"), value: roleLabel(process?.viewerRole, t) },
    {
      key: "meetings",
      label: t("supervision.create.meetingsLabel"),
      value: Number.isInteger(count) && count > 0 ? String(count) : ""
    },
    {
      key: "goal",
      label: t("supervision.create.views.goal.title"),
      value: goal || t(isClosed(process) ? "supervision.process.facts.goalClosed" : "supervision.process.facts.goalNone"),
      missing: !goal,
      long: true
    }
  ].filter((fact) => fact.value);
}

/* --- Kontrakt -------------------------------------------------------------- */

/** Kehtiv kontrakt ja see, mida vaataja sellega teha saab. */
export function contractView(process, { t, locale }) {
  const active = process?.activeContract || null;
  const since = active ? dayText(active.activatedAt, locale) : "";
  return {
    active: active
      ? {
          id: String(active.id),
          version: t("supervision.contract.versionN", { n: active.versionNumber }),
          since: since ? t("supervision.process.contract.inForceSince", { date: since }) : "",
          body: String(active.body || "")
        }
      : null,
    needsAcceptance: needsContractAcceptance(process),
    canManage: Boolean(process?.capabilities?.canManageContract),
    hasVersions: list(process?.contractVersions).length > 0
  };
}

/**
 * Kontraktiversioonide read (ainult superviisorile; teistele server ajalugu ei anna).
 *
 * Aktiveerida saab mustandit, mille number on kehtivast suurem: server lubab
 * liikuda ainult edasi (lib/supervision/service.js, `CONTRACT_VERSION_NOT_FORWARD`).
 * Vana leht pakkus nuppu igale mustandile ja vanema mustandi nupp andis alati vea.
 */
export function versionRows(process, { t, locale }) {
  const activeNumber = Number(process?.activeContract?.versionNumber) || 0;
  const canManage = Boolean(process?.capabilities?.canManageContract);
  return list(process?.contractVersions)
    .filter((row) => row && row.id)
    .map((row) => {
      const date = dayText(row.activatedAt || row.createdAt, locale);
      return {
        id: String(row.id),
        title: t("supervision.contract.versionN", { n: row.versionNumber }),
        statusText: contractStatusLabel(row.status, t),
        tone: CONTRACT_TONES[row.status] || "quiet",
        date: date
          ? t(row.activatedAt ? "supervision.process.contract.inForceSince" : "supervision.process.contract.createdOn", { date })
          : "",
        canActivate: canManage && row.status === "DRAFT" && Number(row.versionNumber) > activeNumber
      };
    })
    .reverse();
}

/* --- Osalejad -------------------------------------------------------------- */

/**
 * Osalejate osa juhis. Superviisor näeb kõiki osalusi (ka vastamata ja tagasi
 * võetud kutseid), teised liikmed ainult liitunuid ja lahkunuid: selle piiri
 * seab server ja juhis ütleb, mida vaataja ees näeb.
 */
export function participantsLead(process, t) {
  return t(process?.viewerRole === SUPERVISOR_ROLE ? "supervision.process.participants.leadSupervisor" : "supervision.process.participants.leadMember");
}

/**
 * Osalejate read. Kutse saab tagasi võtta ainult superviisor ja ainult
 * vastamata kutselt.
 */
export function participantRows(process, { t }) {
  const canInvite = Boolean(process?.capabilities?.canInvite);
  return list(process?.participants)
    .filter((row) => row && row.id)
    .map((row) => ({
      id: String(row.id),
      name: text(row.name) || t("supervision.process.participants.unnamed"),
      statusText: participationLabel(row.status, t),
      tone: PARTICIPATION_TONES[row.status] || "quiet",
      canWithdraw: canInvite && row.status === "INVITED"
    }));
}

/* --- Eeskamber ------------------------------------------------------------- */

/**
 * Jagatud teemade tunnused, mida vaataja näeb. Eeskambri kirje, mille jagatud
 * teemat nende hulgas ei ole, on tagasi võetud: oma jagatud teemat näeb autor
 * alati, kuni see on jagatud.
 */
function visibleTopicIds(process) {
  return new Set(list(process?.topics).map((topic) => String(topic?.id || "")).filter(Boolean));
}

/** `shared`, `withdrawn` või tühi: kas eeskambri kirjest on tehtud jagatud teema. */
export function sharedState(item, process) {
  if (!item?.sharedTopicId) return "";
  if (isClosed(process)) return "shared";
  return visibleTopicIds(process).has(String(item.sharedTopicId)) ? "shared" : "withdrawn";
}

function privateItemBase(item, process, { t }) {
  const shared = sharedState(item, process);
  const title = text(item.title);
  return {
    id: String(item.id),
    title: title || excerpt(item.body, 80),
    hasTitle: Boolean(title),
    kindText: privateKindLabel(item.kind, t),
    shared,
    sharedText: shared === "shared" ? t("supervision.eeskamber.shared") : shared === "withdrawn" ? t("supervision.process.antechamber.shareWithdrawn") : ""
  };
}

/** Eeskambri loendi read. */
export function privateItemRows(items, process, { t }) {
  return list(items)
    .filter((item) => item && item.id)
    .map((item) => privateItemBase(item, process, { t }));
}

/**
 * Avatud eeskambri kirje: tekst tervikuna ja tegevused.
 *
 * Jagada saab kirjet, millest jagatud teemat ei ole tehtud (ka tagasi võetud
 * jagamise järel server uut jagamist ei luba: lib/supervision/topics.js,
 * `ALREADY_SHARED`).
 */
export function privateItemView(item, process, { t }) {
  if (!item?.id) return null;
  const capabilities = process?.capabilities || {};
  return {
    ...privateItemBase(item, process, { t }),
    heading: text(item.title),
    body: String(item.body || ""),
    version: item.version,
    fromWellbeing: item.sourceKind === HANDOFF ? t("supervision.process.antechamber.fromWellbeing") : "",
    /* Tagasi võetud jagamise järel nuppu „Jaga teadlikult" ei ole: lause ütleb, miks. */
    withdrawnNote: sharedState(item, process) === "withdrawn" ? t("supervision.process.antechamber.withdrawnNote") : "",
    canWrite: Boolean(capabilities.canManagePrivateItems),
    canShare: Boolean(capabilities.canShareTopic) && !item.sharedTopicId
  };
}

/**
 * Uue mustandi liigid kaartidena: nimi ja üks lause selle kohta, milleks liik on.
 * Vana vorm pakkus liike rippvalikus ilma selgituseta.
 */
export function privateKindOptions(t) {
  return PRIVATE_ITEM_KINDS.map((kind) => ({
    value: kind,
    label: privateKindLabel(kind, t),
    description: t(`supervision.process.antechamber.kindHint.${kind}`)
  }));
}

/**
 * Mida eeskambri osa näitab: loendit, avatud kirjet, muutmise vormi või uut
 * mustandit (`new` on liigi valik, `write` tekst). Kirje, mida enam ei ole
 * (kustutati teises aknas), ja vorm, milleks õigust ei ole, ei jää tühja
 * vaatena ette.
 */
export function antechamberMode({ mode, canWrite, hasItem, hasEditing }) {
  if (mode === "new" || mode === "write") return canWrite ? mode : "list";
  if (mode === "list" || !hasItem) return "list";
  if (mode === "edit") return canWrite && hasEditing ? "edit" : "item";
  return "item";
}

/* --- Jagatud teemad --------------------------------------------------------- */

/** Privaatsusmärgi liik ja arv jagamise sihtrühma järgi (`../PrivacyBadge.jsx`). */
export function audiencePrivacy(process, audience) {
  return audience === "PROCESS" ? { scope: "process", count: acceptedCount(process) } : { scope: "supervisor", count: 0 };
}

function topicAuthor(topic, process, { t }) {
  const mine =
    topic.authorType === "SUPERVISOR"
      ? process?.viewerRole === SUPERVISOR_ROLE
      : Boolean(topic.authorParticipationId) && topic.authorParticipationId === process?.myParticipation?.id;
  if (mine) return { mine, authorText: t("supervision.process.topics.byYou") };
  if (topic.authorType === "SUPERVISOR") return { mine, authorText: t("supervision.process.topics.bySupervisor") };
  if (topic.authorType === "PARTICIPANT") {
    const author = list(process?.participants).find((row) => row?.id === topic.authorParticipationId);
    const name = text(author?.name);
    return { mine, authorText: name ? t("supervision.process.topics.byName", { name }) : t("supervision.process.topics.byParticipant") };
  }
  return { mine, authorText: t("supervision.process.topics.byDeleted") };
}

/**
 * Jagatud teemad, mida server sellele vaatajale annab (kõigile jagatud teemad
 * ning ainult superviisorile jagatud teemad autorile ja superviisorile).
 *
 * Vana leht jagatud teemasid ei näidanud: jagamise järel ei näinud jagatut
 * keegi, ja jagamise eelvaate lubatud tagasivõtmiseks ei olnud nuppu. Tagasi
 * võtta saab ainult autor ja ainult avatud protsessis
 * (lib/supervision/topics.js `withdrawTopic`).
 */
export function topicRows(process, { t, locale }) {
  const open = !isClosed(process);
  return list(process?.topics)
    .filter((topic) => topic && topic.id)
    .map((topic) => {
      const { mine, authorText } = topicAuthor(topic, process, { t });
      const date = dayText(topic.sharedAt, locale);
      const sharedOn = date ? t("supervision.process.topics.sharedOn", { date }) : "";
      return {
        id: String(topic.id),
        title: text(topic.title) || excerpt(topic.body, 80),
        /* Rea teine rida: kes jagas ja millal. */
        sub: [authorText, sharedOn].filter(Boolean).join(" · "),
        body: String(topic.body || ""),
        audienceText: audienceLabel(topic.audience, t),
        privacy: audiencePrivacy(process, topic.audience),
        fromWellbeing: topic.sourceKind === HANDOFF ? t("supervision.process.antechamber.fromWellbeing") : "",
        version: topic.version,
        canWithdraw: mine && open
      };
    });
}

/* --- Kohtumised -------------------------------------------------------------- */

/** Kohtumiste read. Toimunuks saab märkida kohtumist, mis seda veel ei ole (toimunud on lõplik). */
export function meetingRows(process, { t, locale }) {
  const canPlan = Boolean(process?.capabilities?.canPlanMeeting);
  return list(process?.meetings)
    .filter((meeting) => meeting && meeting.id)
    .map((meeting) => {
      const planned = timeText(meeting.plannedAt, locale);
      const held = timeText(meeting.heldAt, locale);
      const note = String(meeting.note || "");
      return {
        id: String(meeting.id),
        seq: meeting.seq,
        title: t("supervision.meetings.meetingN", { n: meeting.seq }),
        statusText: meetingStatusLabel(meeting.status, t),
        tone: MEETING_TONES[meeting.status] || "quiet",
        planned,
        held,
        /* Rea teine rida: toimumise aeg, selle puudumisel kavandatud aeg. */
        sub: held || planned || t("supervision.process.meetings.noTime"),
        note,
        hasNote: Boolean(note.trim()),
        version: meeting.version,
        status: String(meeting.status || ""),
        plannedAtInput: plannedAtInput(meeting.plannedAt),
        canEditNote: canPlan,
        canMarkHeld: canPlan && meeting.status !== "HELD",
        /* Kavandatud kohtumise aega saab muuta ja kohtumise tühistada (server
           lubab mõlemat sama PATCH-teega); toimunud ja tühistatud kohtumisel
           neid tegusid ei ole. */
        canChange: canPlan && meeting.status === "PLANNED"
      };
    });
}

/** Mida kohtumiste osa näitab: loendit, avatud kohtumist, töömärkme vormi või uue kohtumise vormi. */
export function meetingsMode({ mode, canPlan, hasMeeting, canChange = false }) {
  if (mode === "plan") return canPlan ? "plan" : "list";
  if (mode === "list" || !hasMeeting) return "list";
  if (mode === "time") return canChange ? "time" : "meeting";
  if (mode === "note") return canPlan ? "note" : "meeting";
  return "meeting";
}

/**
 * Kavandatud aeg väljalt (`datetime-local`) päringusse. Tühi väli tähendab
 * kohtumist ilma ajata (server lubab). Loetamatu väärtus on viga, mis öeldakse
 * välja: vana leht andis selle otse `toISOString()`-ile, mis viskab, ja nupp ei
 * teinud siis midagi.
 */
export function plannedAtValue(input) {
  const raw = text(input);
  if (!raw) return { ok: true, value: null };
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? { ok: false, value: null } : { ok: true, value: date.toISOString() };
}

/** Kavandatud aeg serverist (ISO) välja (`datetime-local`, kohalik aeg); puuduv või loetamatu on tühi väli. */
export function plannedAtInput(iso) {
  const raw = text(iso);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Kohtumiste plaadi rida: järgmine kavandatud aeg või toimunute ja kavandatute
 * arv. Suletud protsessis „järgmist" kohtumist ei ole: plaat ütleb ainult arvud.
 */
export function meetingsSummary(process, { t, locale, now = Date.now() }) {
  const meetings = list(process?.meetings).filter(Boolean);
  if (!meetings.length) return { state: "empty", summary: t("supervision.meetings.empty") };
  const upcoming = isClosed(process)
    ? []
    : meetings
        .filter((meeting) => meeting.status === "PLANNED" && meeting.plannedAt)
        .map((meeting) => new Date(meeting.plannedAt).getTime())
        .filter((time) => Number.isFinite(time) && time >= now)
        .sort((a, b) => a - b);
  if (upcoming.length) {
    return { state: "done", summary: t("supervision.process.tiles.nextMeeting", { time: timeText(upcoming[0], locale) }) };
  }
  return {
    state: "done",
    summary: t("supervision.process.tiles.meetingsCount", {
      held: meetings.filter((meeting) => meeting.status === "HELD").length,
      planned: meetings.filter((meeting) => meeting.status === "PLANNED").length
    })
  };
}

/* --- Kokkuvõtted -------------------------------------------------------------- */

function summaryTitle(summary, process, { t }) {
  if (summary.kind === "FINAL") return t("supervision.summaries.final");
  const meeting = list(process?.meetings).find((row) => row?.id === summary.meetingId);
  return meeting ? t("supervision.process.summaries.meetingN", { n: meeting.seq }) : t("supervision.summaries.meeting");
}

/**
 * Kokkuvõtete read ja avatud kokkuvõtte tegevused.
 *
 * `privacy`: mustandit näeb ainult superviisor (`draft`), kinnitatud kokkuvõte
 * on püsiv (`persistent`). Need on samad märgid, mis vanal lehel.
 * `approvedByMe`: osaleja, kes on juba kinnitanud, ei näe kinnitamise nuppu
 * teist korda (vana leht näitas seda edasi).
 */
export function summaryRows(process, { t, locale }) {
  const capabilities = process?.capabilities || {};
  const canCreate = Boolean(capabilities.canCreateSummary);
  const canApprove = Boolean(capabilities.canApproveSummary);
  const total = acceptedCount(process);
  const myParticipationId = process?.myParticipation?.id || "";
  return list(process?.summaries)
    .filter((summary) => summary && summary.id)
    .map((summary) => {
      const draft = summary.status === "DRAFT";
      const pending = summary.status === "PENDING_APPROVAL";
      const approved = summary.status === "APPROVED";
      const done = list(summary.approvals).length;
      const approvedByMe = Boolean(myParticipationId) && list(summary.approvals).some((row) => row?.participationId === myParticipationId);
      const approvedOn = approved ? dayText(summary.approvedAt, locale) : "";
      const waiting = pending ? t("supervision.summaries.waitingApprovals", { done, total }) : "";
      return {
        id: String(summary.id),
        title: summaryTitle(summary, process, { t }),
        statusText: waiting || summaryStatusLabel(summary.status, t),
        tone: SUMMARY_TONES[summary.status] || "quiet",
        body: String(summary.body || ""),
        version: summary.version,
        privacy: draft ? "draft" : approved ? "persistent" : "",
        waiting,
        meta: approvedOn ? t("supervision.outcome.approvedOn", { date: approvedOn }) : "",
        approvedByMe: pending && approvedByMe,
        canEdit: canCreate && draft,
        canSubmit: canCreate && draft,
        canDiscard: canCreate && (draft || pending),
        discardKind: draft ? "draft" : "pending",
        canApprove: canApprove && pending && !approvedByMe
      };
    });
}

/**
 * Kokkuvõtete osa juhis: superviisorile, kes mustandit näeb; osalejale, millal
 * kokkuvõte kinnitatuks loetakse. Suletud protsessis on alles ainult
 * kinnitatud kokkuvõtted ja juhist ei ole.
 */
export function summariesLead(process, t) {
  if (isClosed(process)) return "";
  return t(process?.viewerRole === SUPERVISOR_ROLE ? "supervision.process.summaries.leadSupervisor" : "supervision.process.summaries.leadMember");
}

/**
 * Mille kohta saab uue kokkuvõtte teha.
 *
 * Server lubab ühe lõpukokkuvõtte ja ühe kokkuvõtte kohtumise kohta (kõrvale
 * jäetud ei loe; lib/supervision/summaries.js). Vana vorm pakkus alati mõlemat
 * liiki ja kõiki kohtumisi ning hõivatud valik andis üldise vealause.
 * Superviisor näeb kõiki kokkuvõtteid peale kõrvale jäetute, seega on hõivatus
 * protsessi vastusest teada.
 */
export function newSummaryChoices(process, { t }) {
  const summaries = list(process?.summaries).filter(Boolean);
  const finalTaken = summaries.some((summary) => summary.kind === "FINAL");
  const takenMeetings = new Set(summaries.filter((summary) => summary.kind === "MEETING").map((summary) => summary.meetingId));
  const meetings = list(process?.meetings)
    .filter((meeting) => meeting && meeting.id && !takenMeetings.has(meeting.id))
    .map((meeting) => ({ value: String(meeting.id), label: t("supervision.meetings.meetingN", { n: meeting.seq }) }));
  const kinds = [
    finalTaken ? null : { value: "FINAL", label: t("supervision.summaries.final") },
    meetings.length ? { value: "MEETING", label: t("supervision.summaries.meeting") } : null
  ].filter(Boolean);
  return { kinds, meetings, any: kinds.length > 0 };
}

/**
 * Mida kokkuvõtete osa näitab. Kokkuvõte, mida enam ei ole (jäeti kõrvale), ja
 * mustand, mis saadeti vahepeal kinnitamisele, ei jää muutmise vormina ette.
 */
export function summariesMode({ mode, canCreate, anyChoice, hasTarget, hasSummary, canEdit, hasEditing }) {
  /* Uus kokkuvõte: `new` on valik, mille kohta see on; `write` on tekst ja eeldab tehtud valikut. */
  if (mode === "new" || mode === "write") {
    if (!canCreate || !anyChoice) return "list";
    return mode === "write" && hasTarget ? "write" : "new";
  }
  if (mode === "list" || !hasSummary) return "list";
  if (mode === "edit") return canEdit && hasEditing ? "edit" : "summary";
  return "summary";
}

/**
 * Uue kokkuvõtte nimi, kui valik on tehtud („Lõpukokkuvõte", „Kohtumise 2
 * kokkuvõte"); tühi sõne, kui liik või kohtumine on veel valimata.
 */
export function newSummaryTitle(process, { kind, meetingId }, t) {
  if (kind === "FINAL") return summaryTitle({ kind }, process, { t });
  if (kind === "MEETING" && meetingId) return summaryTitle({ kind, meetingId }, process, { t });
  return "";
}

/** Uue kokkuvõtte päringu keha või `null`, kui midagi on puudu. */
export function summaryDraft({ kind, meetingId, body }) {
  const content = text(body);
  if (!content) return null;
  if (kind === "MEETING") return meetingId ? { kind: "MEETING", meetingId, body: content } : null;
  return kind === "FINAL" ? { kind: "FINAL", body: content } : null;
}

function summariesSummary(process, { t }) {
  const rows = list(process?.summaries).filter(Boolean);
  if (!rows.length) return { state: "empty", summary: t("supervision.summaries.empty") };
  const count = (status) => rows.filter((row) => row.status === status).length;
  const myParticipationId = process?.myParticipation?.id || "";
  const waitsMe =
    Boolean(process?.capabilities?.canApproveSummary) &&
    rows.some((row) => row.status === "PENDING_APPROVAL" && !list(row.approvals).some((approval) => approval?.participationId === myParticipationId));
  if (waitsMe) return { state: "done", summary: t("supervision.process.tiles.summaryWaitsYou") };
  if (count("PENDING_APPROVAL")) return { state: "done", summary: t("supervision.process.tiles.summariesPending", { count: count("PENDING_APPROVAL") }) };
  if (count("DRAFT")) return { state: "done", summary: t("supervision.process.tiles.summariesDraft", { count: count("DRAFT") }) };
  return { state: "done", summary: t("supervision.process.tiles.approvedSummaries", { count: count("APPROVED") }) };
}

/* --- Kapp ------------------------------------------------------------------------ */

/** Kapi read: kehtiv kontrakt ja iga kinnitatud kokkuvõte. Üks rida on üks tekst. */
export function cabinetRows(process, { t, locale }) {
  const rows = [];
  if (process?.activeContract) {
    rows.push({
      id: "contract",
      title: t("supervision.outcome.contract"),
      meta: t("supervision.contract.versionN", { n: process.activeContract.versionNumber }),
      body: String(process.activeContract.body || "")
    });
  }
  for (const summary of list(process?.summaries)) {
    if (!summary || summary.status !== "APPROVED") continue;
    const date = dayText(summary.approvedAt, locale);
    rows.push({
      id: `summary-${summary.id}`,
      title: summaryTitle(summary, process, { t }),
      meta: date ? t("supervision.outcome.approvedOn", { date }) : "",
      body: String(summary.body || "")
    });
  }
  return rows;
}

/* --- Suletud protsess --------------------------------------------------------------- */

/** Suletud protsessi faktid: millal suleti, mis kustus ja koondarvud. Ainult arvud ja kuupäevad. */
export function closureFacts(process, { t, locale }) {
  const closure = process?.closure || null;
  if (!closure) return [];
  const closedOn = dayText(closure.closedAt, locale);
  const purge = closure.purgeReport || null;
  const facts = closure.facts || null;
  return [
    closedOn ? { key: "closedOn", text: t("supervision.process.tiles.closedOn", { date: closedOn }) } : null,
    purge
      ? {
          key: "purged",
          text: t("supervision.closed.purged", {
            topics: purge.sharedTopics ?? 0,
            drafts: purge.draftSummaries ?? 0,
            notes: purge.meetingNotes ?? 0
          })
        }
      : null,
    facts
      ? { key: "meetings", text: t("supervision.process.end.factMeetings", { held: facts.meetingsHeld ?? 0, planned: facts.meetingsPlanned ?? 0 }) }
      : null,
    facts ? { key: "participants", text: t("supervision.process.end.factParticipants", { count: facts.participantCount ?? 0 }) } : null,
    facts ? { key: "summaries", text: t("supervision.process.tiles.approvedSummaries", { count: facts.approvedSummaryCount ?? 0 }) } : null
  ].filter(Boolean);
}

/* --- Plaadid --------------------------------------------------------------------------- */

function listTile(rows, { t, emptyText }) {
  if (!rows.length) return { state: "empty", summary: emptyText };
  return { state: "done", summary: rows.length > 1 ? `${rows[0].title} ${t("supervision.home.moreRows")}` : rows[0].title };
}

const TILES = {
  [PART.CLOSED]({ process, t, locale }) {
    const date = dayText(process?.closure?.closedAt, locale);
    return { state: "done", summary: date ? t("supervision.process.tiles.closedOn", { date }) : statusLabel(CLOSED, t) };
  },
  [PART.PROCESS]({ process, t }) {
    const supervisor =
      process?.viewerRole !== SUPERVISOR_ROLE && process?.supervisorName ? t("supervision.home.supervisor", { name: process.supervisorName }) : "";
    return { state: "done", summary: [typeLabel(process?.type, t), supervisor].filter(Boolean).join(" · ") };
  },
  [PART.CONTRACT]({ process, t }) {
    const active = process?.activeContract;
    if (!active) return { state: "empty", summary: t("supervision.contract.noActive") };
    return {
      state: "done",
      summary: t(needsContractAcceptance(process) ? "supervision.process.tiles.contractPending" : "supervision.process.tiles.contractActive", {
        n: active.versionNumber
      })
    };
  },
  [PART.PARTICIPANTS]({ process, t }) {
    const rows = list(process?.participants).filter(Boolean);
    const joined = rows.filter((row) => row.status === "ACCEPTED").length;
    const invited = rows.filter((row) => row.status === "INVITED").length;
    if (!joined && !invited) return { state: "empty", summary: t("supervision.process.participants.empty") };
    return {
      state: "done",
      summary: [
        t("supervision.process.tiles.joined", { count: joined }),
        invited ? t("supervision.process.tiles.invited", { count: invited }) : ""
      ]
        .filter(Boolean)
        .join(" · ")
    };
  },
  /* Eeskamber tuleb omaette päringust: plaat ei väida, et see on tühi, enne kui loend on kohal. */
  [PART.ANTECHAMBER]({ process, privateItems, t }) {
    if (privateItems?.status === "loading") return { state: "empty", summary: t("supervision.common.loading") };
    if (privateItems?.status === "error") return { state: "empty", summary: privateItems.error || t("supervision.errors.load_failed") };
    return listTile(privateItemRows(privateItems?.data, process, { t }), { t, emptyText: t("supervision.process.antechamber.emptyReadOnly") });
  },
  [PART.TOPICS]({ process, t, locale }) {
    return listTile(topicRows(process, { t, locale }), { t, emptyText: t("supervision.process.topics.empty") });
  },
  [PART.MEETINGS]({ process, t, locale, now }) {
    return meetingsSummary(process, { t, locale, now });
  },
  [PART.SUMMARIES]({ process, t }) {
    return summariesSummary(process, { t });
  },
  [PART.CABINET]({ process, t }) {
    const approved = list(process?.summaries).filter((summary) => summary?.status === "APPROVED").length;
    if (!process?.activeContract && !approved) return { state: "empty", summary: t("supervision.kapp.empty") };
    return {
      state: "done",
      summary: [
        process?.activeContract ? t("supervision.process.views.kontrakt.title") : "",
        approved ? t("supervision.process.tiles.approvedSummaries", { count: approved }) : ""
      ]
        .filter(Boolean)
        .join(" · ")
    };
  },
  [PART.CLOSE]({ t }) {
    return { state: "empty", summary: t("supervision.process.tiles.close") };
  },
  [PART.LEAVE]({ t }) {
    return { state: "empty", summary: t("supervision.process.tiles.leave") };
  }
};

/**
 * Protsessi osad lava jaoks: nimi, lühinimi kiirmenüüsse, seis sõnadega kõigi
 * osade vaate plaadile ja see, kas osas on midagi (`done`) või mitte (`empty`).
 *
 * @param {{ process: object, privateItems?: { status: string, data: unknown, error: string }, t: Function, locale?: string, now?: number }} input
 */
export function processParts({ process, privateItems = null, t, locale, now = Date.now() }) {
  return processPartKeys(process).map((key) => {
    const { state, summary } = TILES[key]({ process, privateItems, t, locale, now });
    return {
      key,
      label: t(`supervision.process.views.${key}.title`),
      short: t(`supervision.process.views.${key}.short`),
      state,
      summary: summary || undefined,
      free: FREE_PARTS.has(key)
    };
  });
}

/* --- Jagamise eelvaade ---------------------------------------------------------------------- */

/** Jagamise sammud (`../SupervisionSharePage.jsx`); nimed on kataloogis `supervision.share.views.<võti>`. */
export const SHARE_STEP_KEYS = Object.freeze(["content", "audience", "confirm"]);
export const SHARE_AUDIENCE_DEFAULT = "SUPERVISOR_ONLY";

/**
 * Pealkiri, mis jagamisel serverisse läheb. Server nõuab pealkirja; pealkirjata
 * eeskambri kirjel on see sisu algus. Tuletus on ÜHES kohas ja eelvaade näitab
 * täpselt seda väärtust.
 */
export function shareTitleOf(item) {
  if (!item) return "";
  return item.title || String(item.body || "").slice(0, 200);
}

/** Kes näevad teemat pärast jagamist: nimeliselt, mitte „osalejad" üldiselt. */
export function shareAudienceNames(process, audience) {
  if (!process) return [];
  const supervisor = process.supervisorName ? [process.supervisorName] : [];
  if (audience !== "PROCESS") return supervisor;
  const members = list(process.participants)
    .filter((row) => row?.status === "ACCEPTED" && row.name)
    .map((row) => row.name);
  return [...supervisor, ...members];
}

/** Jagamise päringu keha: täpselt need väljad, mida eelvaade näitab. */
export function shareBody(item, audience) {
  return { title: shareTitleOf(item), body: item.body, audience, sourcePrivateItemId: item.id };
}

/* --- Sulgemise eelvaade ---------------------------------------------------------------------- */

/** Sulgemise sammud (`../SupervisionClosePage.jsx`); nimed on kataloogis `supervision.close.views.<võti>`. */
export const CLOSE_STEP_KEYS = Object.freeze(["effect", "title", "close"]);
export const CLOSE_TITLE_MAX = 200;

/** Mis sulgemisel kustub ja mis jääb: kaks loendit serveri eelvaate arvudega. */
export function closeEffect(preview, { t }) {
  const gone = preview?.willDelete || {};
  const kept = preview?.willKeep || {};
  const counted = (key, value) => `${t(key)}: ${value ?? 0}`;
  return {
    deleted: [
      { key: "sharedTopics", text: counted("supervision.close.sharedTopics", gone.sharedTopics) },
      { key: "draftSummaries", text: counted("supervision.close.draftSummaries", gone.draftSummaries) },
      { key: "meetingNotes", text: counted("supervision.close.meetingNotes", gone.meetingNotes) }
    ],
    kept: [
      { key: "approvedSummaries", text: counted("supervision.close.approvedSummaries", kept.approvedSummaries) },
      { key: "meetings", text: counted("supervision.close.meetingFacts", kept.meetings) },
      { key: "contractVersions", text: t("supervision.close.contractVersions", { count: kept.contractVersions ?? 0 }) },
      { key: "contractAcceptances", text: t("supervision.close.contractAcceptances", { count: kept.contractAcceptances ?? 0 }) },
      { key: "auditEvents", text: t("supervision.close.auditTrail", { count: kept.auditEvents ?? 0 }) },
      { key: "closureFacts", text: t("supervision.close.closureFacts") },
      { key: "privateItems", text: t("supervision.close.privateItems") },
      { key: "personalOutcomes", text: t("supervision.close.personalOutcomes", { count: kept.personalOutcomes ?? 0 }) }
    ]
  };
}

/**
 * Kinnitamist ootavad kokkuvõtted, mis sulgemist takistavad: rida viib otse
 * kokkuvõtte juurde. Vanal lehel oli iga kokkuvõtte kohta sama sildiga nupp.
 */
export function pendingSummaryRows(pendingIds, { processId, process = null, t }) {
  const titled = new Map(summaryRows(process, { t }).map((row) => [row.id, row.title]));
  return list(pendingIds)
    .filter(Boolean)
    .map((id) => ({
      id: String(id),
      href: partHref(processId, PART.SUMMARIES, { summary: id }),
      title: titled.get(String(id)) || t("supervision.close.pendingOne"),
      sub: "",
      chips: [],
      date: ""
    }));
}

/** Üldistatud pealkiri sulgemise päringusse; tühikutest pealkiri on puuduv pealkiri. */
export function closeTitle(value) {
  const title = text(value);
  return { ok: Boolean(title), title };
}
