/**
 * Mentorlussuhte lehe read ja otsused ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Suhte leht pani varem kõik kokku joonistamise käigus: seisu
 * sõna tehti serveri koodist (`mentoring.meeting_status.${status}`) ja tundmatu
 * kood jõudis ekraanile toore võtmena; nupp „Jaga mentorile” pakuti ka lõppenud
 * suhtes, kus server keeldub; automaatselt lõppenud suhte kohta ütles leht, et
 * selle lõpetas teine pool. Siin on need otsused puhaste funktsioonidena, mida
 * saab testida ilma brauserita (`tests/mentoring-relation-views.test.mjs`).
 * Leht (`../MentoringRelationPage.jsx`) hoiab andmeid ja päringuid, vaated
 * (`./RelationViews.jsx`) ainult joonistavad.
 *
 * SEISU SÕNA TULEB LOENDIST. Iga kood, mida server võib saata, on siin
 * nimeliselt kirjas koos oma sõna võtme ja tooniga. Koodi, mida loendis ei ole,
 * ei trükita: tühi märk on parem kui toores võti ekraanil.
 *
 * ÕIGUSED ON SERVERI OMAD (`relation.can`, `canShare`, `canRecall`). Siin
 * kitsendatakse neid ainult seal, kus serveri lipp lubab rohkem kui serveri
 * tegevus: jagada saab ainult käimas või pausil suhtes.
 */

import { MENTORING_LIMITS } from "@/lib/mentoring/constants";
import { localDateTimeToIso } from "@/lib/mentoring/time";

import { statusWord } from "../entry/entryRows";

/** Suhte osad lava jaoks: sama järjekord mis ekraanil. */
export const RELATION_PART_KEYS = Object.freeze(["goal", "agreement", "meetings", "summaries", "preparation", "notes", "state"]);

/** Tekstide pikim lubatud pikkus (`normalizeText` serveris). */
export const TEXT_LIMIT = MENTORING_LIMITS.MAX_TEXT;

/**
 * Nii palju ridu annab server ühe suhte kohta (`getMentoringRelation`). Kui
 * loend on täpselt nii pikk, võib vanemaid kirjeid olla veel: leht ütleb seda.
 */
export const LIST_CAPS = Object.freeze({ meetings: 100, summaries: 100, notes: 100, preparations: 50 });

/** Tööheaolu väljundi eelvaade on serveris lõigatud nii pikaks. */
export const CANDIDATE_PREVIEW_LENGTH = 400;

/** Põhjused, mille inimene saab suhet lõpetades valida. */
export const CLOSE_REASON_CHOICES = Object.freeze(["completed", "changed_mentor", "other"]);
/** Kõik põhjused, millel on kataloogis sõna (`MENTORING_CLOSE_REASONS`). */
export const CLOSE_REASON_WORDS = Object.freeze(["completed", "not_started", "changed_mentor", "inactive", "account_deleted", "other"]);
/** Põhjused, millega suhte lõpetab platvorm ise, mitte kumbki pool. */
export const TIMER_CLOSE_REASONS = Object.freeze(["not_started", "inactive", "account_deleted"]);

export const MEETING_MODES = Object.freeze(["EXTERNAL", "PLATFORM_ROOM"]);

export const EMPTY_MEETING = Object.freeze({ occurredAt: "", mode: "EXTERNAL", roomId: "", topicSummary: "" });

/** Kood → sõna võti ja märgi toon. */
export const RELATION_WORDS = Object.freeze({
  meeting_status: Object.freeze({
    PLANNED: { key: "planned", tone: "wait" },
    HELD: { key: "held", tone: "ok" },
    CANCELLED: { key: "cancelled", tone: "quiet" }
  }),
  meeting_mode: Object.freeze({
    EXTERNAL: { key: "external", tone: "quiet" },
    PLATFORM_ROOM: { key: "platform_room", tone: "quiet" }
  }),
  summary_status: Object.freeze({
    DRAFT: { key: "draft", tone: "quiet" },
    PENDING_CONFIRM: { key: "pending_confirm", tone: "wait" },
    CONFIRMED: { key: "confirmed", tone: "ok" },
    DISCARDED: { key: "discarded", tone: "quiet" }
  })
});

const list = (value) => (Array.isArray(value) ? value : []);
const code = (value) => String(value || "").toUpperCase();

/**
 * Seisu sõna ja toon. Tundmatu kood annab tühja teksti, mitte toore koodi.
 *
 * @param {"meeting_status"|"meeting_mode"|"summary_status"} kind
 * @param {unknown} value serveri kood (nt `PENDING_CONFIRM`)
 * @param {(key: string, vars?: object) => string} t
 * @returns {{ text: string, tone: string }}
 */
export function relationWord(kind, value, t) {
  const entry = RELATION_WORDS[kind]?.[code(value)];
  if (!entry) return { text: "", tone: "quiet" };
  return { text: t(`mentoring.${kind}.${entry.key}`), tone: entry.tone };
}

/** Lõpetamise põhjus sõnana; tundmatu põhjus jääb tühjaks. */
export function closeReasonText(value, t) {
  const key = String(value || "");
  return CLOSE_REASON_WORDS.includes(key) ? t(`mentoring.close_reason.${key}`) : "";
}

/** Rea algus ühe lausena: reavahetused tühikuks, pikk tekst lõigatud. */
export function excerpt(value, max = 90) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function isClosed(relation) {
  return code(relation?.status) === "CLOSED";
}

/** Käimas või pausil: seisud, kus server lubab kokkuvõtteid ja jagamist. */
export function isRunning(relation) {
  return ["ACTIVE", "PAUSED"].includes(code(relation?.status));
}

/** Teise poole nimi; kustutatud või nimeta kasutaja saab sõna. */
export function otherPartyName(relation, t) {
  const other = relation?.position === "mentor" ? relation?.mentee : relation?.mentor;
  return other?.name || t("mentoring.labels.deleted_user");
}

/** Lehe päis: kes on teine pool, suhte seis ja lõppenud suhte põhjus. */
export function relationHead(relation, t) {
  const name = otherPartyName(relation, t);
  const word = statusWord("relation_status", relation?.status, t);
  return {
    who: relation?.position === "mentor" ? t("mentoring.home.relation_as_mentor", { name }) : t("mentoring.home.relation_as_mentee", { name }),
    chip: word,
    reason: isClosed(relation) ? closeReasonText(relation?.closeReasonKey, t) : ""
  };
}

/** Mitu kohtumist on toimunud, mitu kokkuvõtet kinnitatud ja millal viimati midagi tehti. */
export function progressLine(relation, { t, formatDate }) {
  return t("mentoring.relation.progress_line", {
    meetings: list(relation?.meetings).filter((meeting) => code(meeting?.status) === "HELD").length,
    summaries: list(relation?.summaries).filter((summary) => code(summary?.status) === "CONFIRMED").length,
    date: formatDate(relation?.lastActivityAt) || t("mentoring.labels.unknown_time")
  });
}

/**
 * Kes suhte lõpetas. Platvorm lõpetab suhte ise, kui kokkulepet ei kinnitata,
 * suhe soikub või konto kustutatakse: siis lõpetajat ei ole ja lause „teine
 * pool lõpetas” oleks vale.
 */
export function closedLine(relation, { t, formatDate }) {
  const date = formatDate(relation?.closedAt) || t("mentoring.labels.unknown_time");
  if (relation?.closedByMe) return t("mentoring.relation.views.state.ended_by_me", { date });
  if (TIMER_CLOSE_REASONS.includes(String(relation?.closeReasonKey || ""))) {
    return t("mentoring.relation.views.state.ended_by_timer", { date });
  }
  return t("mentoring.relation.views.state.ended_by_other", { name: otherPartyName(relation, t), date });
}

/** Kas eesmärkide väljal on midagi, mida serveris ei ole (tühikud ei loe). */
export function goalDirty(draft, saved) {
  return String(draft || "").trim() !== String(saved || "").trim();
}

/**
 * Kokkuleppe seis: tekst, versioon, kumbki kinnitus ja see, mida selles seisus
 * teha saab. `summary` on rida ülevaate plaadile.
 */
export function agreementModel(relation, t) {
  const text = String(relation?.agreementText || "");
  const hasText = Boolean(text.trim());
  const mine = relation?.myAgreementAccepted === true;
  const other = relation?.otherAgreementAccepted === true;
  return {
    hasText,
    text,
    version: hasText ? t("mentoring.relation.agreement_version", { version: relation?.agreementVersion ?? 1 }) : "",
    mine: mine
      ? { text: t("mentoring.relation.views.agreement.mine_yes"), tone: "ok" }
      : { text: t("mentoring.relation.views.agreement.mine_no"), tone: "wait" },
    other: other
      ? { text: t("mentoring.relation.views.agreement.other_yes"), tone: "ok" }
      : { text: t("mentoring.relation.views.agreement.other_no"), tone: "quiet" },
    canAccept: hasText && relation?.can?.acceptAgreement === true,
    canPropose: relation?.can?.proposeAgreement === true,
    summary: !hasText
      ? t("mentoring.relation.views.agreement.summary_none")
      : !mine
        ? t("mentoring.relation.views.agreement.summary_mine")
        : !other
          ? t("mentoring.relation.views.agreement.summary_other")
          : t("mentoring.relation.views.agreement.summary_both")
  };
}

/**
 * Kohtumiste read. Plaanitud kohtumise saab märkida toimunuks või tühistada
 * (`canAct`), lõppenud suhtes enam mitte; `roomId` annab tee ruumi.
 */
export function meetingRows(meetings, { t, formatDate, closed = false }) {
  return list(meetings)
    .filter((meeting) => meeting?.id)
    .map((meeting) => {
      const status = relationWord("meeting_status", meeting.status, t);
      return {
        id: String(meeting.id),
        title: formatDate(meeting.occurredAt) || t("mentoring.labels.unknown_time"),
        text: excerpt(meeting.topicSummary),
        topic: String(meeting.topicSummary || ""),
        chip: status.text,
        tone: status.tone,
        time: relationWord("meeting_mode", meeting.mode, t).text,
        status: code(meeting.status),
        planned: code(meeting.status) === "PLANNED",
        canAct: !closed && code(meeting.status) === "PLANNED",
        roomId: meeting.roomId ? String(meeting.roomId) : "",
        version: meeting.version
      };
    });
}

/** Uue kohtumise vorm → päringu sisu, või `null`, kui aeg või ruum on puudu. */
export function meetingBody(form) {
  const occurredAt = localDateTimeToIso(form?.occurredAt);
  const mode = MEETING_MODES.includes(form?.mode) ? form.mode : "EXTERNAL";
  const roomId = String(form?.roomId || "").trim();
  if (!occurredAt || (mode === "PLATFORM_ROOM" && !roomId)) return null;
  return { occurredAt, mode, roomId: mode === "PLATFORM_ROOM" ? roomId : null, topicSummary: String(form?.topicSummary || "") };
}

/**
 * Kokkuvõtete read: pooleli (mustand, kinnituse ootel) ees, kinnitatud taga.
 * Kõrvale jäetud kokkuvõtet ei näidata. Lõppenud suhtes tegevusi ei ole: seal
 * saab kinnitatud kokkuvõtteid ainult lugeda.
 */
export function summaryRows(summaries, { t, formatDay, closed = false }) {
  const rows = list(summaries)
    .filter((summary) => summary?.id && ["DRAFT", "PENDING_CONFIRM", "CONFIRMED"].includes(code(summary.status)))
    .map((summary) => {
      const status = code(summary.status);
      const pending = status === "PENDING_CONFIRM";
      const word = relationWord("summary_status", status, t);
      const mineConfirmed = summary.myConfirmation === true;
      const superseded = Boolean(summary.supersededById);
      return {
        id: String(summary.id),
        text: String(summary.content || ""),
        chip: pending
          ? mineConfirmed
            ? t("mentoring.relation.summary_waiting_other")
            : t("mentoring.relation.views.summaries.chip_confirm")
          : word.text,
        tone: pending ? (mineConfirmed ? "quiet" : "wait") : word.tone,
        extra: superseded ? t("mentoring.relation.summary_superseded") : "",
        time: status === "CONFIRMED" ? formatDay(summary.confirmedAt) : "",
        status,
        version: summary.version,
        working: status !== "CONFIRMED",
        needsMe: !closed && pending && !mineConfirmed,
        canSubmit: !closed && status === "DRAFT" && summary.createdByMe === true,
        othersDraft: !closed && status === "DRAFT" && summary.createdByMe !== true,
        canConfirm: !closed && pending && !mineConfirmed,
        canDiscard: !closed && status !== "CONFIRMED",
        canCorrect: !closed && status === "CONFIRMED" && !superseded
      };
    });
  return [...rows.filter((row) => row.working), ...rows.filter((row) => !row.working)];
}

/**
 * Ettevalmistuste read. Oma ettevalmistus (mentee) näitab teksti ja seda, kas
 * mentor seda näeb. Mentorile jagatud ettevalmistus on kinni, kuni ta selle
 * avab: server ei saada teksti enne avamist.
 */
export function preparationRows(preparations, { t, formatDate, position, running = false }) {
  return list(preparations)
    .filter((preparation) => preparation?.id)
    .map((preparation) => {
      const id = String(preparation.id);
      if (preparation.own) {
        const shared = Boolean(preparation.sharedAt) && !preparation.recalledAt;
        const opened = shared && Boolean(preparation.openedAt);
        return {
          id,
          own: true,
          sealed: false,
          text: String(preparation.content || ""),
          chip: opened
            ? t("mentoring.relation.views.preparation.chip_opened")
            : shared
              ? t("mentoring.relation.views.preparation.chip_shared")
              : t("mentoring.relation.views.preparation.chip_private"),
          tone: opened ? "ok" : shared ? "wait" : "quiet",
          statusLine: opened
            ? t("mentoring.relation.preparation_opened", { date: formatDate(preparation.openedAt) })
            : shared
              ? t("mentoring.relation.preparation_shared", { date: formatDate(preparation.sharedAt) })
              : t("mentoring.relation.preparation_private"),
          /* Serveri lipp `canShare` ei vaata suhte seisu, jagamine aga vaatab. */
          canShare: running && preparation.canShare === true,
          canRecall: preparation.canRecall === true,
          canOpen: false
        };
      }
      const opened = Boolean(preparation.openedAt);
      return {
        id,
        own: false,
        sealed: !opened,
        text: opened ? String(preparation.sharedContent || "") : t("mentoring.relation.preparation_new_from_mentee"),
        chip: opened ? t("mentoring.relation.views.preparation.chip_opened") : t("mentoring.relation.views.preparation.chip_new"),
        tone: opened ? "quiet" : "wait",
        statusLine: opened
          ? t("mentoring.relation.views.preparation.opened_by_you", { date: formatDate(preparation.openedAt) })
          : t("mentoring.relation.views.preparation.shared_to_you", { date: formatDate(preparation.sharedAt) }),
        canShare: false,
        canRecall: false,
        canOpen: !opened && position === "mentor"
      };
    });
}

/** Tööheaolu väljundid, mida mentee saab suhtesse tuua. `cut`: näha on ainult algus. */
export function candidateRows(candidates) {
  return list(candidates)
    .filter((candidate) => candidate?.id)
    .map((candidate) => {
      const text = String(candidate.preview || "");
      return { id: String(candidate.id), text, updatedAt: candidate.updatedAt, cut: text.length >= CANDIDATE_PREVIEW_LENGTH };
    });
}

/** Minu märkmed: tekst ja viimase muutmise päev. */
export function noteRows(notes, { formatDay }) {
  return list(notes)
    .filter((note) => note?.id)
    .map((note) => ({ id: String(note.id), text: String(note.content || ""), time: formatDay(note.updatedAt) }));
}

/**
 * Lõpetamise ülevaade: mis säilib ja mis kustub. Arvud tulevad serverist
 * (`previewMentoringClose`). Eesmärkide rida on ainult siis, kui eesmärgid on
 * kirjas.
 */
export function closeLists(preview, t) {
  return {
    keeps: [
      t("mentoring.relation.close_keep_summaries", { count: preview?.keeps?.confirmedSummaries ?? 0 }),
      t("mentoring.relation.close_keep_meetings", { count: preview?.keeps?.meetingFacts ?? 0 }),
      t("mentoring.relation.close_keep_agreements"),
      t("mentoring.relation.close_keep_notes", { count: preview?.keeps?.myPrivateNotes ?? 0 })
    ],
    purges: [
      t("mentoring.relation.close_purge_drafts", { count: preview?.purges?.unconfirmedSummaries ?? 0 }),
      preview?.purges?.goalSummary === false ? "" : t("mentoring.relation.close_purge_goal"),
      t("mentoring.relation.close_purge_topics")
    ].filter(Boolean)
  };
}

/** Lause, miks kohtumiste loend on tühi: lisada saab ainult aktiivses suhtes. */
export function meetingsEmptyText(relation, t) {
  if (relation?.can?.createMeeting) return t("mentoring.relation.views.meetings.empty_can_add");
  const status = code(relation?.status);
  if (status === "DRAFT") return t("mentoring.relation.views.meetings.empty_draft");
  if (status === "PAUSED") return t("mentoring.relation.views.meetings.empty_paused");
  return t("mentoring.relation.views.meetings.empty_closed");
}

/**
 * Millised osad sellel suhtel on. Lõppenud suhtel ei ole eesmärke (need
 * kustuvad lõpetamisel) ega tühja kokkuleppe osa. Ettevalmistuse osa on siis,
 * kui seal on midagi või kui mentee saab sinna Tööheaolust midagi tuua.
 */
export function relationPartKeys(relation) {
  const closed = isClosed(relation);
  const hasAgreement = Boolean(String(relation?.agreementText || "").trim());
  const hasPreparation = list(relation?.preparations).filter(Boolean).length > 0 || relation?.can?.handoffPreparation === true;
  return RELATION_PART_KEYS.filter((key) => {
    if (key === "goal") return !closed;
    if (key === "agreement") return hasAgreement || relation?.can?.proposeAgreement === true;
    if (key === "preparation") return hasPreparation;
    return true;
  });
}

/* Ülevaate plaadi rida iga osa kohta: esimene rida või tühjuse põhjus, mitte ridade arv. */
const PART_SUMMARIES = {
  goal({ relation, t }) {
    const text = excerpt(relation?.goalSummary);
    return text ? { state: "done", summary: text } : { state: "empty", summary: t("mentoring.relation.views.goal.summary_empty") };
  },
  agreement({ relation, t }) {
    const model = agreementModel(relation, t);
    return { state: model.hasText ? "done" : "empty", summary: model.summary };
  },
  meetings({ relation, t, formatDate }) {
    const rows = meetingRows(relation?.meetings, { t, formatDate });
    /* Server annab kohtumised uuemast vanemani: varaseim plaanitud on loendi lõpus. */
    const planned = rows.filter((row) => row.planned).at(-1);
    if (planned) return { state: "done", summary: t("mentoring.relation.views.meetings.summary_planned", { date: planned.title }) };
    if (rows.length) return { state: "partial", summary: t("mentoring.relation.views.meetings.summary_last", { date: rows[0].title }) };
    return { state: "empty", summary: t("mentoring.relation.views.meetings.summary_empty") };
  },
  summaries({ relation, t, formatDay }) {
    const rows = summaryRows(relation?.summaries, { t, formatDay, closed: isClosed(relation) });
    if (rows.some((row) => row.needsMe)) return { state: "done", summary: t("mentoring.relation.views.summaries.chip_confirm") };
    if (rows.length) return { state: "partial", summary: excerpt(rows[0].text) };
    return { state: "empty", summary: t("mentoring.relation.summaries_empty") };
  },
  preparation({ relation, candidates, t, formatDate }) {
    const rows = preparationRows(relation?.preparations, {
      t,
      formatDate,
      position: relation?.position,
      running: isRunning(relation)
    });
    if (rows.some((row) => row.sealed)) return { state: "done", summary: t("mentoring.relation.preparation_new_from_mentee") };
    /* Plaadil on ainult seis, mitte tekst: ülevaade on see vaade, mis jääb ette,
       kui suhe on kohtumise ajal lahti ja ekraani jagatakse. */
    if (rows.length) return { state: "partial", summary: rows[0].chip };
    if (list(candidates).length) return { state: "done", summary: t("mentoring.relation.views.preparation.summary_candidates") };
    return { state: "empty", summary: t("mentoring.relation.views.preparation.summary_empty") };
  },
  /* Märkmeid näeb ainult omanik: plaadil on viimase märkme päev, mitte selle tekst
     (sama põhjus mis ettevalmistusel). */
  notes({ relation, t, formatDay }) {
    const first = list(relation?.notes).find((note) => note?.id);
    if (!first) return { state: "empty", summary: t("mentoring.relation.views.notes.summary_empty") };
    const date = formatDay(first.updatedAt);
    return {
      state: "partial",
      summary: date ? t("mentoring.relation.views.notes.summary_last", { date }) : t("mentoring.relation.views.notes.summary_some")
    };
  },
  state({ relation, t }) {
    const head = relationHead(relation, t);
    return { state: "partial", summary: [head.chip.text, head.reason].filter(Boolean).join(": ") };
  }
};

/* Tekst ja loendid võivad olla pikad: nende järgi lava ühist kõrgust ei võeta. */
const FREE_PARTS = new Set(["agreement", "meetings", "summaries", "preparation", "notes"]);

/**
 * Suhte osad lava jaoks: nimi, lühinimi kiirmenüüsse, rida ülevaate plaadile ja
 * see, kas osas on midagi.
 *
 * @param {{ relation: object, candidates?: object[], t: Function, formatDate: Function, formatDay: Function }} input
 */
export function relationParts({ relation, candidates = [], t, formatDate, formatDay }) {
  return relationPartKeys(relation).map((key) => {
    const { state, summary } = PART_SUMMARIES[key]({ relation, candidates, t, formatDate, formatDay });
    return {
      key,
      label: t(`mentoring.relation.views.${key}.title`),
      short: t(`mentoring.relation.views.${key}.short`),
      state,
      summary: summary || undefined,
      free: FREE_PARTS.has(key)
    };
  });
}
