/**
 * Supervisiooni avalehtede read, sildid ja kontrollid ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Sama põhjus mis `components/casework/workbenchRows.js`-il:
 * kuni read sündisid JSX-failis, ei saanud testida, mida rida näitab ja kuhu
 * ta viib. Siin on puhtad funktsioonid; lehed (`../SupervisionHomePage.jsx`,
 * `../SupervisionCreatePage.jsx`, `../SupervisionOutcomePage.jsx`) hoiavad
 * andmeid ja päringuid ning vaated ainult joonistavad.
 *
 * TOORES KOOD EI JÕUA EKRAANILE. Vana leht pani sildi kokku kujul
 * `supervision.roles.${viewerRole}`: tundmatu väärtuse korral trükiti võti
 * ise. Siin on serveri väärtused loendis ja tundmatu väärtus annab tühja sildi
 * (märki siis ei joonistata). Loendeid hoiab serveriga koos
 * `tests/supervision-entry-views.test.mjs`.
 */

import { localizePath } from "@/lib/localizePath";

/** Vaataja roll protsessis (`VIEWER_ROLES`, lib/supervision/serializers.js). */
export const VIEWER_ROLES = Object.freeze(["SV", "OS", "OS_STALE", "KUT", "LAHK"]);
/** `SupervisionProcessStatus` (prisma/schema.prisma). */
export const PROCESS_STATUSES = Object.freeze(["DRAFT", "ACTIVE", "CLOSED"]);
/** `SupervisionProcessType` (prisma/schema.prisma). */
export const PROCESS_TYPES = Object.freeze(["INDIVIDUAL", "GROUP"]);
/** `SupervisionSummaryKind` (prisma/schema.prisma). */
export const SUMMARY_KINDS = Object.freeze(["MEETING", "FINAL"]);

/** Laua osad (`../SupervisionHomePage.jsx`); iga osa nimi on kataloogis `supervision.home.views.<võti>`. */
export const HOME_PART_KEYS = Object.freeze(["processes", "invites", "outcomes"]);

/** Kutsutu sammud (`../SupervisionInvitedCard.jsx`); nimed on kataloogis `supervision.invited.views.<võti>`. */
export const INVITED_STEP_KEYS = Object.freeze(["invite", "contract", "answer"]);

const INVITED_ROLE = "KUT";
const SUPERVISOR_ROLE = "SV";
const STATUS_TONES = Object.freeze({ DRAFT: "wait", ACTIVE: "ok", CLOSED: "quiet" });

function word(t, group, known, value) {
  const code = String(value || "");
  return known.includes(code) ? t(`supervision.${group}.${code}`) : "";
}

export const roleLabel = (role, t) => word(t, "roles", VIEWER_ROLES, role);
export const statusLabel = (status, t) => word(t, "status", PROCESS_STATUSES, status);
export const typeLabel = (type, t) => word(t, "type", PROCESS_TYPES, type);

/** Kuupäev lugeja keeles; vigane või puuduv väärtus annab tühja sõne, mitte vea. */
export function dayText(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }).format(date);
}

/** Pika teksti algus plaadile: tühikud kokku, lõpp kärbitud. */
export function excerpt(value, max = 110) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/* Teed on lokaalineutraalsed (`localizePath` eemaldab keeleprefiksi; keel on küpsises). */
export const processHref = (id) => localizePath(`/supervisioon/${encodeURIComponent(String(id))}`);
export const outcomeHref = (id) => localizePath(`/supervisioon/valjundid/${encodeURIComponent(String(id))}`);
export const SUPERVISION_HOME_HREF = localizePath("/supervisioon");
export const SUPERVISION_CREATE_HREF = localizePath("/supervisioon/uus");
export const SUPERVISION_OUTCOMES_HREF = localizePath("/supervisioon/valjundid");

/**
 * Loendi vastus kaheks: protsessid, kus olen liige, ja kutsed, millele ma ei
 * ole vastanud. Kutse ei ole veel „minu protsess": kutsutu näeb ainult
 * kontrakti. Vanal lehel seisis kutse teiste kaartide vahel ja erines neist
 * ühe märgiga.
 */
export function splitProcesses(processes) {
  const list = (Array.isArray(processes) ? processes : []).filter((row) => row && row.id);
  return {
    mine: list.filter((row) => row.viewerRole !== INVITED_ROLE),
    invites: list.filter((row) => row.viewerRole === INVITED_ROLE)
  };
}

/**
 * Protsess või kutse → loendi rida.
 *
 * Superviisori nime näidatakse ainult siis, kui see ei ole lugeja ise: oma
 * nimi igal real ei ütle midagi, roll on märgil kirjas.
 *
 * @param {unknown[]} processes
 * @param {{ t: Function, locale?: string }} context
 */
export function processRows(processes, { t, locale }) {
  return (Array.isArray(processes) ? processes : [])
    .filter((row) => row && row.id)
    .map((row) => {
      const invited = row.viewerRole === INVITED_ROLE;
      const role = roleLabel(row.viewerRole, t);
      const status = invited ? "" : statusLabel(row.status, t);
      const supervisor =
        row.viewerRole !== SUPERVISOR_ROLE && row.supervisorName
          ? t("supervision.home.supervisor", { name: row.supervisorName })
          : "";
      return {
        id: String(row.id),
        href: processHref(row.id),
        title: String(row.title || "").trim() || t("supervision.home.untitled"),
        sub: [typeLabel(row.type, t), supervisor].filter(Boolean).join(" · "),
        chips: [
          role ? { key: "role", text: role, tone: invited ? "wait" : "quiet", prefix: t("supervision.home.roleLabel") } : null,
          status ? { key: "status", text: status, tone: STATUS_TONES[row.status] || "quiet" } : null
        ].filter(Boolean),
        date: dayText(row.lastActivityAt, locale)
      };
    });
}

/** Isiklik pakk → loendi rida. */
export function outcomeRows(outcomes, { t, locale }) {
  return (Array.isArray(outcomes) ? outcomes : [])
    .filter((row) => row && row.id)
    .map((row) => ({
      id: String(row.id),
      href: outcomeHref(row.id),
      title: String(row.processTitleGeneralized || "").trim() || t("supervision.outcome.untitled"),
      sub: "",
      chips: [],
      date: dayText(row.createdAt, locale)
    }));
}

/**
 * Laua plaadi teine rida: esimene rida või tühjuse põhjus. Arvu siin ei ole:
 * plaat ütleb, mis seal on, mitte mitu.
 */
export function tileSummary({ rows, emptyText = "", moreText = "" }) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return emptyText;
  return list.length > 1 && moreText ? `${list[0].title} ${moreText}` : list[0].title;
}

/* --- Uus protsess --------------------------------------------------------- */

export const MEETING_COUNT_DEFAULT = 5;
export const MEETING_COUNT_MIN = 1;
export const MEETING_COUNT_MAX = 100;
export const TITLE_MAX = 200;
export const GOAL_MAX = 20000;

/**
 * Kavandatud kohtumiste arv väljalt. Tühi väli tähendab vaikimisi viit (sama
 * mis serveris). Vana leht toetus ühise vormi väljakontrollile (min, max) ja
 * saatis `Number(x) || 5`. Sammudeks jagatud vormil ühist saatmishetke ei
 * ole, seega on kontroll siin ja viga öeldakse välja enne saatmist.
 */
export function parseMeetingCount(value) {
  const text = String(value ?? "").trim();
  if (!text) return { ok: true, value: MEETING_COUNT_DEFAULT };
  if (!/^\d{1,3}$/.test(text)) return { ok: false, value: null };
  const count = Number(text);
  if (count < MEETING_COUNT_MIN || count > MEETING_COUNT_MAX) return { ok: false, value: null };
  return { ok: true, value: count };
}

/** Uue protsessi sammud (`../SupervisionCreatePage.jsx`); nimed on kataloogis `supervision.create.views.<võti>`. */
export const CREATE_STEP_KEYS = Object.freeze(["type", "title", "goal", "create"]);

/**
 * Vormi seis → päringu keha ja see, mis on puudu.
 *
 * TÜÜPI EI VALITA INIMESE EEST. Vana vorm algas valikuga „Individuaalne" ja
 * tüüpi ei saa pärast loomist muuta (protsessi muutmine seda välja ei luba):
 * grupi superviisor, kes rippvalikust mööda vaatas, sai vale tüübiga protsessi.
 *
 * @param {{ type?: string, title?: string, goal?: string, plannedMeetingCount?: string }} form
 * @returns {{ ok: boolean, problems: { type: boolean, title: boolean, meetings: boolean }, firstProblemStep: string, payload: object|null }}
 */
export function createDraft(form) {
  const type = PROCESS_TYPES.includes(form?.type) ? form.type : "";
  const title = String(form?.title || "").trim();
  const meetings = parseMeetingCount(form?.plannedMeetingCount);
  const problems = { type: !type, title: !title, meetings: !meetings.ok };
  /* Samm, kuhu inimene viia, kui ta vajutab „Loo protsess" ja midagi on puudu. */
  const firstProblemStep = problems.type ? "type" : problems.title || problems.meetings ? "title" : "";
  if (firstProblemStep) return { ok: false, problems, firstProblemStep, payload: null };
  return {
    ok: true,
    problems,
    firstProblemStep,
    payload: {
      type,
      title,
      goal: String(form?.goal || "").trim() || null,
      plannedMeetingCount: meetings.value
    }
  };
}

/**
 * Kas loomine lükati tagasi superviisori õiguse puudumise pärast?
 *
 * Vana leht pidas IGA 403 vastust õiguse puudumiseks. Server annab 403 ka
 * siis, kui roll ei sobi (`supervision.errors.role_forbidden`), ja siis oli
 * selgitus „pöördu administraatori poole" vale. Õiguse selgitus kuvatakse
 * ainult selle ühe võtme peale; muu vastus läheb tavalise vealausena.
 */
export function isGrantRequired({ status, payload }) {
  return status === 403 && payload?.messageKey === "supervision.errors.grant_required";
}

/* --- Isiklik pakk --------------------------------------------------------- */

/**
 * Paki sisu → osad: kinnitatud kontrakt ja iga kinnitatud kokkuvõte omaette.
 *
 * Üks osa on üks tekst. Kohtumise kokkuvõtteid võib olla mitu: nende nimes on
 * järjekord pakis („2/5"), mitte kohtumise number, sest pakk kohtumise numbrit
 * ei kanna ja kõigil kohtumistel ei pruugi kinnitatud kokkuvõtet olla.
 *
 * @param {{ content?: object|null }|null} outcome
 * @param {{ t: Function, locale?: string }} context
 */
export function packParts(outcome, { t, locale }) {
  const content = outcome?.content && typeof outcome.content === "object" ? outcome.content : {};
  const parts = [];

  const contract = typeof content.lastAcceptedContractBody === "string" ? content.lastAcceptedContractBody : "";
  if (contract.trim()) {
    parts.push({
      key: "contract",
      kind: "contract",
      label: t("supervision.outcome.views.contract.title"),
      short: t("supervision.outcome.views.contract.short"),
      meta: "",
      body: contract
    });
  }

  const summaries = (Array.isArray(content.approvedSummaries) ? content.approvedSummaries : []).filter(
    (row) => row && typeof row.body === "string" && row.body.trim()
  );
  const meetingTotal = summaries.filter((row) => row.kind !== "FINAL").length;
  let meetingIndex = 0;
  summaries.forEach((row, index) => {
    const final = row.kind === "FINAL";
    const approved = dayText(row.approvedAt, locale);
    const meta = approved ? t("supervision.outcome.approvedOn", { date: approved }) : "";
    if (!final) meetingIndex += 1;
    const numbered = !final && meetingTotal > 1;
    const group = final ? "final" : numbered ? "meetingNth" : "meeting";
    const vars = numbered ? { n: meetingIndex, total: meetingTotal } : undefined;
    parts.push({
      key: `summary-${index}`,
      kind: final ? "final" : "meeting",
      label: t(`supervision.outcome.views.${group}.title`, vars),
      short: t(`supervision.outcome.views.${group}.short`, vars),
      meta,
      body: row.body
    });
  });

  return parts.map((part) => ({
    ...part,
    /* Igas osas on tekst: plaat on selge. Osa võib olla pikk lugemine, tema
       järgi ühist kõrgust ei võeta. */
    state: "done",
    free: true,
    summary: [part.meta, excerpt(part.body)].filter(Boolean).join(" · ")
  }));
}

/** Kas pakis on kokkuvõtteid (kontrakt üksi ei ole kokkuvõte). */
export const hasSummaries = (parts) => parts.some((part) => part.kind !== "contract");
