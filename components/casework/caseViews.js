/**
 * JUHTUM-V1 — „Minu juhtumid" vaadete otsused ILMA JSX-ita: loendi read ja
 * filter, avatud juhtumi osad ja nende kokkuvõtted, seoste ja punktide read.
 *
 * MIKS OMA FAIL. Sama põhjus mis `workbenchRows.js`-il ja `caseListState.js`-il:
 * JSX-failis elavat otsust ei saa selle projekti testijooksjaga tõendada. Siin
 * on puhtad funktsioonid; lehed (`CaseWorkShell.jsx`, `CaseWorkDetail.jsx`)
 * hoiavad andmeid ja päringuid, vaated (`./cases/*.jsx`) ainult joonistavad.
 *
 * TOORES VÄÄRTUS EI LÄHE EKRAANILE. Seis, liik ja päritolu jõuavad pinnale
 * ainult kataloogi sõnana. Tundmatu väärtuse kohta öeldakse „tundmatu", mitte
 * ei näidata enum'i nime ega tõlkevõtit.
 */

import { provenanceLabelKey } from "@/lib/workspaces/provenance";

import { caseLabelText, missingInfoStatusKey, retentionLabelKey, targetTypeKey } from "./caseWorkClient";
import { sectionSummary } from "./workbenchView";

/** Loendilehe vaated: juhtumite loend ja uue juhtumi loomine. */
export const CASE_LIST_VIEWS = Object.freeze(["list", "create"]);

/**
 * Loendi filter: juhtumi seis. `ALL` ei lähe päringusse; ülejäänud on täpselt
 * need väärtused, mida `listCaseWorkAssists()` filtrina vastu võtab.
 */
export const CASE_STATE_FILTERS = Object.freeze(["ALL", "ACTIVE", "READ_ONLY", "ARCHIVED"]);

export const CASE_FILTER_LABEL_KEYS = Object.freeze({
  ALL: "casework.page.filter_all",
  ACTIVE: "casework.page.filter_active",
  READ_ONLY: "casework.page.filter_read_only",
  ARCHIVED: "casework.page.filter_archived"
});

/**
 * Avatud juhtumi osad. Töö on ees, elutsükkel taga: põhiandmed ja seosed,
 * puuduv info, siis kohtumise ettevalmistus, märge ja STAR2-sse kantav (samas
 * järjekorras, nagu töö ajas kulgeb), ning lõpus see, mis juhtumit sulgeb.
 * Kliendiviite kustutamine on viimane: see on juhtumi kõige pöördumatum tegu.
 *
 * Kohtumise heli seisab märkme kõrval omaette osana: salvestis on dokument,
 * mitte märkme rida, ja salvesti peab töötama edasi ka siis, kui märkmete osa
 * vahetab oma sisu (loend, avatud märge).
 */
export const CASE_PART_ORDER = Object.freeze([
  "basics",
  "star",
  "items",
  "missing",
  "prep",
  "notes",
  "audio",
  "drafts",
  "transfer",
  "retention",
  "material",
  "client"
]);

/* Loend või avatud kirje võib olla pikk ja salvesti teated tulevad ja lähevad:
   nende järgi lava ühist kõrgust ei võeta. */
const FREE_PARTS = new Set(["items", "missing", "prep", "notes", "audio", "drafts", "transfer"]);

const RETENTION_TONES = Object.freeze({ ACTIVE: "ok", READ_ONLY: "wait", ARCHIVED: "quiet" });
const MISSING_TONES = Object.freeze({ OPEN: "wait", RESOLVED: "ok", NOT_APPLICABLE: "quiet" });

/** Puuduva info seisud samas järjekorras mis serveris (`MISSING_INFO_STATUSES`). */
export const MISSING_STATUSES = Object.freeze(["OPEN", "RESOLVED", "NOT_APPLICABLE"]);

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timeText(value, locale) {
  const date = validDate(value);
  return date ? date.toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" }) : "";
}

export function dateText(value, locale) {
  const date = validDate(value);
  return date ? date.toLocaleDateString(locale || "et", { dateStyle: "medium" }) : "";
}

/**
 * Kataloogi sõna või tühi. `t(võti, "")` annab puuduva võtme korral võtme enda
 * tagasi: enum'ist kokku pandud võti (`casework.draft.type_${…}`) jõuaks nii
 * tundmatu väärtusega ekraanile. Siin jääb sel juhul tühi koht.
 */
function word(t, key) {
  const text = t(key, "");
  return text && text !== key ? text : "";
}

export function retentionTone(state) {
  return RETENTION_TONES[state] || "quiet";
}

/** Loendi päringuosa. Tundmatu filter tähendab „kõik": vigast väärtust serverile ei saadeta. */
export function caseListQuery({ limit, cursor = null, filter = "ALL" } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filter !== "ALL" && CASE_STATE_FILTERS.includes(filter)) params.set("retentionState", filter);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export function caseFilterOptions(t) {
  return CASE_STATE_FILTERS.map((value) => ({ value, label: t(CASE_FILTER_LABEL_KEYS[value], "") }));
}

/**
 * Juhtumi rida loendis: nimi, seis märgina ja järgmine kontakt.
 *
 * Järgmist kontakti näitab ainult aktiivne juhtum: kirjutuskaitstud ja
 * arhiveeritud juhtumi töö on lõppenud ja kuupäev tekitaks ülesande, mida
 * keegi teha ei saa (sama reegel mis `listUpcomingContacts()` teenuskihis).
 */
export function caseListRows(cases, { t, locale }) {
  return (Array.isArray(cases) ? cases : [])
    .filter((row) => row?.id)
    .map((row) => {
      const time = row.retentionState === "ACTIVE" ? timeText(row.nextContactAt, locale) : "";
      return {
        id: String(row.id),
        title: caseLabelText(row.label, t),
        state: t(retentionLabelKey(row.retentionState), ""),
        tone: retentionTone(row.retentionState),
        meta: time ? t("casework.page.row_next_contact", "").replace("{time}", time) : ""
      };
    });
}

/** Avatud juhtumi osade võtmed. Töömaterjali arhiveerimine on ainult aktiivsel juhtumil. */
export function casePartKeys({ isActive }) {
  return CASE_PART_ORDER.filter((key) => key !== "material" || isActive);
}

/* Sektsiooni loend → plaadi tekst: esimene rida ja sõna, kui ridu on veel.
   `null` tähendab „loend ei ole veel kohal": siis ei väideta ka, et see on tühi. */
function listSummary(list, { t, emptyKey, title }) {
  if (!Array.isArray(list)) return { state: "empty", summary: "" };
  const rows = list.map((row) => ({ title: title(row) })).filter((row) => row.title);
  return {
    state: rows.length ? "done" : "empty",
    summary: sectionSummary({ rows, noticeText: t(emptyKey, ""), moreText: t("casework.page.more_rows", "") })
  };
}

/**
 * Lause juhtumi päises, kui juhtum ei ole aktiivne: mida selles seisus veel teha
 * saab. Kirjutuskaitstud juhtumis saab lugeda, STAR2 jaoks kopeerida ja
 * kliendiviite kustutada; arhiveeritud juhtumis kopeerida enam ei saa (server
 * keeldub). Aktiivsel juhtumil lauset ei ole.
 */
export function lockedNote(retentionState, t) {
  if (retentionState === "ACTIVE") return "";
  return t(retentionState === "ARCHIVED" ? "casework.page.archived_notice" : "casework.page.read_only_notice", "");
}

const PART_SUMMARIES = {
  basics({ record, t, locale }) {
    /* Järgmist kontakti näitab ainult aktiivne juhtum, nagu loendi rida: lõppenud
       töö kuupäev oleks ülesanne, mida keegi teha ei saa. Lõppenud töö plaat ei
       ütle ka, et kontakt on määramata: sinna ei saa enam midagi määrata. */
    if (record?.retentionState !== "ACTIVE") return { state: "done", summary: "" };
    const time = timeText(record?.nextContactAt, locale);
    return time
      ? { state: "done", summary: t("casework.page.parts.basics.summary_contact", "").replace("{time}", time) }
      : { state: "empty", summary: t("casework.page.parts.basics.summary_no_contact", "") };
  },
  star({ record, t }) {
    return record?.externalSystem && record?.externalReference
      ? { state: "done", summary: `${record.externalSystem} · ${record.externalReference}` }
      : { state: "empty", summary: t("casework.page.parts.star.summary_empty", "") };
  },
  /* Arv on SELLE juhtumi oma (sama arv, mis oli vana vaate päises): ta ei ole
     töötaja koormuse mõõdik ega summeeru juhtumite peale kokku. */
  items({ counts, t }) {
    const count = Number(counts?.items) || 0;
    return count > 0
      ? { state: "done", summary: t("casework.page.parts.items.summary_count", "").replace("{count}", String(count)) }
      : { state: "empty", summary: t("casework.page.items_empty", "") };
  },
  missing({ counts, t }) {
    const count = Number(counts?.openMissingInfo) || 0;
    return count > 0
      ? { state: "done", summary: t("casework.page.parts.missing.summary_open", "").replace("{count}", String(count)) }
      : { state: "empty", summary: t("casework.page.parts.missing.summary_none", "") };
  },
  prep({ lists, t, locale }) {
    return listSummary(lists?.prep, {
      t,
      emptyKey: "casework.prep.empty",
      title: (row) => timeText(row?.meetingAt, locale) || t("casework.prep.no_meeting_time", "")
    });
  },
  notes({ lists, t, locale }) {
    return listSummary(lists?.notes, {
      t,
      emptyKey: "casework.note.empty",
      title: (row) => timeText(row?.meetingAt, locale) || t("casework.note.no_meeting_time", "")
    });
  },
  /* Salvesti jääb tööle ka siis, kui ees on juhtumi teine osa: plaat ütleb,
     kas salvestus käib. */
  audio({ recording, t }) {
    return recording
      ? { state: "done", summary: t("casework.page.parts.audio.summary_recording", "") }
      : { state: "empty", summary: t("casework.page.parts.audio.summary", "") };
  },
  /* Tüüp ja seis on kataloogi sõnad; mustandi VÄLJU plaadil ei ole, sest väljad
     kannavad kliendi teksti (sama piir mis Juhtumitöö laual). */
  drafts({ lists, t }) {
    return listSummary(lists?.drafts, {
      t,
      emptyKey: "casework.draft.empty",
      title: (row) =>
        [word(t, `casework.draft.type_${row?.draftType}`), word(t, `casework.star2.${row?.transferState}`)]
          .filter(Boolean)
          .join(" · ")
    });
  },
  transfer({ lists, t, locale }) {
    return listSummary(lists?.transfer, {
      t,
      emptyKey: "casework.transfer.history_empty",
      title: (row) =>
        [word(t, `casework.transfer.kind_${row?.kind}`), timeText(row?.createdAt, locale)].filter(Boolean).join(" · ")
    });
  },
  retention({ record, t }) {
    return {
      state: record?.retentionState === "ACTIVE" ? "empty" : "done",
      summary: t(retentionLabelKey(record?.retentionState), "")
    };
  },
  material({ t }) {
    return { state: "empty", summary: t("casework.page.parts.material.summary", "") };
  },
  client({ record, t }) {
    return record?.clientErasedAt
      ? { state: "done", summary: t("casework.page.erased", "") }
      : { state: "empty", summary: t("casework.page.parts.client.summary", "") };
  }
};

/**
 * Avatud juhtumi osad lava jaoks: nimi, lühinimi kiirmenüüsse, kokkuvõte
 * ülevaate plaadile ja see, kas osas on midagi (`done`) või mitte (`empty`).
 *
 * @param {{ record: object, counts?: object, lists?: Record<string, unknown[]|null>, recording?: boolean, t: Function, locale?: string }} input
 */
export function caseParts({ record, counts = null, lists = null, recording = false, t, locale }) {
  const isActive = record?.retentionState === "ACTIVE";
  return casePartKeys({ isActive }).map((key) => {
    const { state, summary } = PART_SUMMARIES[key]({ record, counts, lists, recording, t, locale });
    return {
      key,
      label: t(`casework.page.parts.${key}.title`, ""),
      short: t(`casework.page.parts.${key}.short`, ""),
      state,
      summary: summary || undefined,
      free: FREE_PARTS.has(key)
    };
  });
}

/**
 * Seotud materjali read. Teenuskiht annab seose kohta ainult liigi, objekti
 * tunnuse ja sidumise aja: pealkirja seosel ei ole, seega tunnus jääb reale
 * (sama tunnus, mille töötaja sidudes ise sisestas).
 */
export function itemRows(items, { t, locale }) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.id)
    .map((item) => {
      const date = dateText(item.createdAt, locale);
      return {
        id: String(item.id),
        type: t(targetTypeKey(item.targetType), ""),
        ref: String(item.targetId || ""),
        meta: date ? t("casework.page.parts.items.linked_on", "").replace("{date}", date) : ""
      };
    });
}

/** Puuduva info punktid: tekst, seis ja päritolu sõnadena. `status` on juhtimiseks, mitte kuvamiseks. */
export function missingRows(list, { t }) {
  return (Array.isArray(list) ? list : [])
    .filter((item) => item?.id)
    .map((item) => ({
      id: String(item.id),
      text: String(item.text || ""),
      status: MISSING_STATUSES.includes(item.status) ? item.status : null,
      statusText: t(missingInfoStatusKey(item.status), ""),
      tone: MISSING_TONES[item.status] || "quiet",
      provenance: t(provenanceLabelKey(item.provenance) || "casework.errors.provenance_unknown", "")
    }));
}

export function missingStatusOptions(t) {
  return MISSING_STATUSES.map((value) => ({ value, label: t(missingInfoStatusKey(value), "") }));
}

/**
 * Elutsükli vaate otsused.
 *
 * SIIRE ON ÜHESUUNALINE: aktiivne → kirjutuskaitstud → arhiveeritud. `next` on
 * ainus seis, kuhu siit saab; arhiveeritud ja tundmatu seisu juures seda ei ole.
 * `warnClock` (L23): kell öeldakse välja ENNE arhiveerimist. Kirjutuskaitse
 * siire seda teksti ei kanna, sest tema kella ei käivita.
 * `countdown` (L7): loendus on nähtav kogu 12 kuu jooksul ja kuupäev tuleb
 * serverist, mitte ei arvutata pinnal.
 */
export function retentionView({ record, retentionClock = null, t, locale }) {
  const state = record?.retentionState;
  const next = state === "ACTIVE" ? "READ_ONLY" : state === "READ_ONLY" ? "ARCHIVED" : null;
  const deletion = state === "ARCHIVED" ? dateText(retentionClock?.deletionAt, locale) : "";
  return {
    stateText: t(retentionLabelKey(state), ""),
    tone: retentionTone(state),
    next,
    warnClock: next === "ARCHIVED",
    countdown: deletion
      ? t("casework.page.retention_countdown", "")
          .replace("{days}", String(retentionClock?.daysLeft ?? 0))
          .replace("{date}", deletion)
      : ""
  };
}

/**
 * Kas juhtumi enda vormides on kirjutatud midagi, mida serveris ei ole:
 * põhiandmed, STAR-i viide, pooleli puuduva info punkt, seose tunnus või
 * elutsükli põhjus. `savedNextContact` on salvestatud aeg samal kujul, nagu
 * väli seda näitab. Juhtumis, mis ei ole aktiivne, välju muuta ei saa.
 */
export function caseFormUnsaved(record, form = {}) {
  if (!record || record.retentionState !== "ACTIVE") return false;
  const same = (value, saved) => String(value ?? "").trim() === String(saved ?? "").trim();
  if (!same(form.displayName, record.clientDisplayName)) return true;
  if (!same(form.externalRef, record.clientExternalRef)) return true;
  if (!same(form.nextContact, form.savedNextContact)) return true;
  if (!same(form.externalSystem, record.externalSystem)) return true;
  if (!same(form.externalReference, record.externalReference)) return true;
  return [form.missingText, form.linkTargetId, form.retentionReason].some((value) => String(value ?? "").trim());
}
