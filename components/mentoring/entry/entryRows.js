/**
 * Mentorluse avalehtede read ja otsused ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Kolm lehte (mentorluse avaleht, minu mentoriprofiil, mentori
 * profiil) joonistasid varem kõik ise: seisu sõna pandi kokku serveri koodist
 * (`mentoring.profile_status.${status}`) ja tundmatu kood jõudis ekraanile
 * toore võtmena; nupud pakuti ka seisus, kus server neid ei luba. Siin on see
 * kõik puhaste funktsioonidena, mida saab testida ilma brauserita
 * (`tests/mentoring-entry-views.test.mjs`). Lehed hoiavad andmeid ja päringuid,
 * vaated (`HomeViews.jsx`, `MyProfileViews.jsx`, `PublicProfileViews.jsx`)
 * ainult joonistavad.
 *
 * SEISU SÕNA TULEB LOENDIST. Iga kood, mida server võib saata, on siin nimeliselt
 * kirjas koos oma sõna võtme ja tooniga. Koodi, mida loendis ei ole, ei trükita:
 * tühi märk on parem kui `mentoring.profile_status.something_new` ekraanil.
 *
 * PIIRID ON SERVERI OMAD. Tekstide pikkused ja loendite suurused tulevad failist
 * `lib/mentoring/constants.js` (puhas konstantide fail, ei too andmebaasi kaasa);
 * keelte ja vormide piir (6) ning kataloogi lagi (200) on serveris arvuna koodi
 * sees, seepärast kontrollib test neid serveri faili vastu.
 */

import { MENTORING_LIMITS } from "@/lib/mentoring/constants";

/** ESTA avalik mentorite leht: väline viide, kui kirjel oma aadressi ei ole. */
export const ESTA_MENTORS_URL = "https://eswa.ee/arendus/mentorlus/";

/** Kataloog annab korraga kuni nii palju mentoreid (`listMentorCatalog`). */
export const CATALOG_CAP = 200;

/** Vaadete võtmed lehtede kaupa: sama järjekord mis ekraanil. */
export const HOME_VIEW_KEYS = Object.freeze(["find", "relations", "requests", "mentor"]);
export const PROFILE_VIEW_KEYS = Object.freeze(["who", "areas", "ways", "intro", "story", "experience", "state"]);
export const PUBLIC_VIEW_KEYS = Object.freeze(["about", "story", "request"]);

/** Kood → sõna võti ja märgi toon. */
export const STATUS_WORDS = Object.freeze({
  profile_status: Object.freeze({
    DRAFT: { key: "draft", tone: "quiet" },
    PENDING_REVIEW: { key: "pending_review", tone: "wait" },
    ACTIVE: { key: "active", tone: "ok" },
    REJECTED: { key: "rejected", tone: "risk" },
    PAUSED: { key: "paused", tone: "quiet" },
    RETIRED: { key: "retired", tone: "quiet" },
    REVOKED: { key: "revoked", tone: "risk" },
    EXTERNAL_REFERENCE: { key: "external_reference", tone: "quiet" }
  }),
  request_status: Object.freeze({
    PENDING: { key: "pending", tone: "wait" },
    ACCEPTED: { key: "accepted", tone: "ok" },
    DECLINED: { key: "declined", tone: "quiet" },
    EXPIRED: { key: "expired", tone: "quiet" },
    CANCELLED: { key: "cancelled", tone: "quiet" }
  }),
  relation_status: Object.freeze({
    DRAFT: { key: "draft", tone: "wait" },
    ACTIVE: { key: "active", tone: "ok" },
    PAUSED: { key: "paused", tone: "quiet" },
    CLOSED: { key: "closed", tone: "quiet" }
  })
});

/** Tagasilükkamise alused, millel on kataloogis lause (`lib/mentoring/adminService.js`). */
export const REVIEW_REASON_KEYS = Object.freeze(["incomplete", "misleading", "out_of_scope", "abuse", "duplicate", "other"]);

/** Profiili tegevused, millel on oma kinnituslause (`mentoring.my_profile.action_done.*`). */
export const PROFILE_ACTIONS = Object.freeze(["submit", "pause", "resume", "retire", "capacity"]);

/**
 * Seisu sõna ja toon. Tundmatu kood annab tühja teksti, mitte toore koodi.
 *
 * @param {"profile_status"|"request_status"|"relation_status"} kind
 * @param {unknown} code serveri kood (nt `PENDING_REVIEW`)
 * @param {(key: string, vars?: object) => string} t
 * @returns {{ text: string, tone: string }}
 */
export function statusWord(kind, code, t) {
  const entry = STATUS_WORDS[kind]?.[String(code || "").toUpperCase()];
  if (!entry) return { text: "", tone: "quiet" };
  return { text: t(`mentoring.${kind}.${entry.key}`), tone: entry.tone };
}

/** Välisviide läheb lingiks ainult siis, kui see on päris veebiaadress. */
export function safeExternalUrl(value, fallback = ESTA_MENTORS_URL) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : fallback;
}

const list = (value) => (Array.isArray(value) ? value : []);

/* ------------------------------------------------------------------------
   Mentorluse avaleht
   ------------------------------------------------------------------------ */

/**
 * Minu mentorlussuhted ridadena. Rida viib suhteruumi; lõppenud suhe avab
 * järelvaate. Kuupäevata suhe ei trüki „Viimane tegevus:” ilma kuupäevata.
 */
export function relationRows(relations, { t, formatDate }) {
  return list(relations).map((relation) => {
    const closed = String(relation?.status || "").toUpperCase() === "CLOSED";
    const asMentor = relation?.position === "mentor";
    const name = (asMentor ? relation?.mentee?.name : relation?.mentor?.name) || t("mentoring.labels.deleted_user");
    const word = statusWord("relation_status", relation?.status, t);
    const date = closed ? "" : formatDate(relation?.lastActivityAt);
    return {
      id: String(relation?.id || ""),
      href: `/mentorlus/suhe/${encodeURIComponent(String(relation?.id || ""))}`,
      title: asMentor ? t("mentoring.home.relation_as_mentor", { name }) : t("mentoring.home.relation_as_mentee", { name }),
      chip: word.text,
      tone: word.tone,
      meta: date ? t("mentoring.home.last_activity", { date }) : "",
      openText: closed ? t("mentoring.home.open_archive") : t("mentoring.home.open_relation"),
      closed
    };
  });
}

/** Mulle kui mentorile saabunud taotlused: otsust ootavad kaardid. */
export function incomingRows(requests, { t, formatDate }) {
  return list(requests).map((request) => {
    const date = formatDate(request?.expiresAt);
    return {
      id: String(request?.id || ""),
      name: request?.menteeName || t("mentoring.labels.deleted_user"),
      message: request?.message || "",
      meta: date ? t("mentoring.home.request_expires", { date }) : "",
      canRespond: request?.canRespond !== false
    };
  });
}

/**
 * Minu saadetud taotlused. Mentori nimi puudub siis, kui tema profiil ei ole
 * enam kataloogis (peatatud, lõpetatud): see ei tähenda, et kasutaja on
 * kustutatud, seepärast on siin oma lause.
 */
export function sentRows(requests, { t, formatDate }) {
  return list(requests).map((request) => {
    const word = statusWord("request_status", request?.status, t);
    const pending = String(request?.status || "").toUpperCase() === "PENDING";
    const date = pending ? formatDate(request?.expiresAt) : "";
    return {
      id: String(request?.id || ""),
      name: request?.mentorDisplayName || t("mentoring.home.mentor_not_listed"),
      chip: word.text,
      tone: word.tone,
      meta: date ? t("mentoring.home.request_expires", { date }) : "",
      pending,
      canCancel: request?.canCancel === true
    };
  });
}

/**
 * Kataloogi read. Platvormi mentor avab oma profiili lehe; ESTA andmebaasi
 * kirje viib välja ESTA lehele. Välisel kirjel ei ole märki „võtab taotlusi
 * vastu”: platvormil talle taotlust esitada ei saa.
 */
export function mentorRows(profiles, { t, formatDate }) {
  return list(profiles).map((mentor) => {
    const external = mentor?.external === true;
    const fields = list(mentor?.fields).filter(Boolean);
    const shown = fields.slice(0, 5).join(", ");
    const full = String(mentor?.capacity || "").toUpperCase() === "FULL";
    const checked = external ? formatDate(mentor?.checkedAt) : "";
    return {
      id: String(mentor?.id || ""),
      external,
      href: external
        ? safeExternalUrl(mentor?.externalProfileUrl)
        : `/mentorlus/mentor/${encodeURIComponent(String(mentor?.id || ""))}`,
      title: mentor?.displayName || "",
      sub: [mentor?.title, mentor?.organization].filter(Boolean).join(" · "),
      fields: fields.length > 5 ? `${shown} +${fields.length - 5}` : shown,
      excerpt: mentor?.bioShort || "",
      chip: external ? t("mentoring.home.external_chip") : full ? t("mentoring.home.capacity_full") : t("mentoring.home.capacity_open"),
      tone: external || full ? "quiet" : "ok",
      meta: checked ? t("mentoring.home.external_checked", { date: checked }) : ""
    };
  });
}

/**
 * Filtrite valikud kataloogi enda väärtustest. Server võrdleb terve sildiga
 * täpselt, seepärast pakub leht valida neid silte, mis kataloogis päriselt on,
 * mitte ei lase trükkida vabateksti, mis midagi ei leia.
 */
export function catalogFacets(profiles, locale = "et") {
  const collect = (key) => {
    const seen = new Set();
    for (const profile of list(profiles)) {
      for (const value of list(profile?.[key])) {
        const text = String(value || "").trim();
        if (text) seen.add(text);
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b, locale));
  };
  return { field: collect("fields"), topic: collect("topics"), language: collect("languages") };
}

/** Kataloogi päringu filtrid: tühja valikut kaasa ei panda. */
export function filterQuery(filters) {
  const params = new URLSearchParams();
  for (const key of ["field", "topic", "language"]) {
    const value = String(filters?.[key] || "").trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

/**
 * Milline rühm on ees. Valitud rühm jääb, kui selles on ridu; tühja rühma
 * asemel näidatakse esimest, kus midagi on (muidu näeks inimene tühja loendit,
 * kuigi teises rühmas ootab taotlus).
 */
export function pickGroup(chosen, order, counts) {
  if (counts?.[chosen] > 0) return chosen;
  return order.find((key) => counts?.[key] > 0) || order[0];
}

/** Plaadi kokkuvõte: esimese rea nimi ja „ja teised”, mitte ridade arv. */
function firstAndMore(rows, pick, moreText) {
  if (!rows.length) return "";
  return rows.length > 1 ? `${pick(rows[0])} ${moreText}` : pick(rows[0]);
}

/**
 * Avalehe osad lava jaoks. Osad on alati samad neli: nii ei ehitata lava
 * ümber, kui viimane taotlus saab vastuse, ja inimene jääb samasse vaatesse.
 */
export function homeParts({ t, mentors, catalogFailed, openRelations, closedRelations, incoming, sent, profile }) {
  const more = t("mentoring.home.views.more");
  const pendingSent = sent.filter((row) => row.pending);
  const profileWord = profile ? statusWord("profile_status", profile.status, t).text : "";
  const state = {
    find: mentors.length ? "partial" : "empty",
    relations: openRelations.length ? "done" : closedRelations.length ? "partial" : "empty",
    requests: incoming.length ? "done" : sent.length ? "partial" : "empty",
    mentor: profile ? "partial" : "empty"
  };
  const summary = {
    find: catalogFailed
      ? t("mentoring.home.catalog_failed")
      : mentors.length
        ? t("mentoring.home.views.find.summary", { count: mentors.length >= CATALOG_CAP ? `${CATALOG_CAP}+` : mentors.length })
        : t("mentoring.home.views.find.summary_empty"),
    relations: firstAndMore(openRelations, (row) => row.title, more) || t("mentoring.home.empty_title"),
    requests: incoming.length
      ? t("mentoring.home.views.requests.summary_incoming", { name: firstAndMore(incoming, (row) => row.name, more) })
      : pendingSent.length
        ? t("mentoring.home.views.requests.summary_sent", { name: firstAndMore(pendingSent, (row) => row.name, more) })
        : t("mentoring.home.views.requests.empty"),
    mentor: profile ? profileWord || profile.displayName || "" : t("mentoring.home.no_profile")
  };
  return HOME_VIEW_KEYS.map((key) => ({
    key,
    label: t(`mentoring.home.views.${key}.title`),
    short: t(`mentoring.home.views.${key}.short`),
    state: state[key],
    summary: summary[key],
    /* Loendid võivad olla pikad: nende järgi ühist kõrgust ei võeta. */
    free: key !== "mentor"
  }));
}

/* ------------------------------------------------------------------------
   Minu mentoriprofiil
   ------------------------------------------------------------------------ */

/** Väljade piirid: samad, mille järgi server lõikab või keeldub. */
export const PROFILE_LIMITS = Object.freeze({
  line: MENTORING_LIMITS.MAX_SHORT_TEXT,
  bioShort: MENTORING_LIMITS.MAX_SHORT_TEXT,
  text: MENTORING_LIMITS.MAX_TEXT,
  fields: MENTORING_LIMITS.MAX_TAGS,
  topics: MENTORING_LIMITS.MAX_TAGS,
  languages: 6,
  formats: 6
});

const LIST_FIELDS = ["fields", "topics", "languages", "formats"];
const TEXT_FIELDS = ["displayName", "title", "organization", "bioShort", "bioFull", "experienceSummary"];

/* Seisud, kus server lubab profiili muuta, ja seisud, kust saab mentorluse
   lõpetada (`lib/mentoring/profileService.js`; test hoiab loendid koos). */
export const EDITABLE_PROFILE_STATUSES = Object.freeze(["DRAFT", "REJECTED", "ACTIVE", "PAUSED", "PENDING_REVIEW"]);
export const RETIRABLE_PROFILE_STATUSES = Object.freeze(["DRAFT", "PENDING_REVIEW", "ACTIVE", "PAUSED", "REJECTED"]);

export const EMPTY_FORM = Object.freeze({
  displayName: "",
  title: "",
  organization: "",
  fields: "",
  topics: "",
  languages: "",
  formats: "",
  bioShort: "",
  bioFull: "",
  experienceSummary: ""
});

/** Profiil → vormi väärtused. Loend on tekstiväljas üks kirje real. */
export function toForm(profile) {
  if (!profile) return { ...EMPTY_FORM };
  const form = {};
  for (const key of TEXT_FIELDS) form[key] = profile[key] || "";
  for (const key of LIST_FIELDS) form[key] = list(profile[key]).join("\n");
  return form;
}

/**
 * Tekst → loend. Kirjed eraldab reavahetus või koma (vana vorm õpetas komaga
 * eraldama; mõlemad harjumused peavad töötama). Kordused jäävad välja nagu
 * serveris.
 */
export function splitList(value) {
  const seen = new Set();
  for (const part of String(value || "").split(/[,\n]/)) {
    const item = part.trim();
    if (item) seen.add(item);
  }
  return [...seen];
}

/** Salvestamise sisu: sama kuju, mida `PUT /api/mentoring/profile` ootab. */
export function profilePayload(form, expectedVersion) {
  return {
    displayName: form.displayName,
    title: form.title,
    organization: form.organization,
    fields: splitList(form.fields),
    topics: splitList(form.topics),
    languages: splitList(form.languages),
    formats: splitList(form.formats),
    bioShort: form.bioShort,
    bioFull: form.bioFull,
    experienceSummary: form.experienceSummary,
    expectedVersion
  };
}

function comparable(form) {
  const texts = TEXT_FIELDS.map((key) => String(form?.[key] || "").trim());
  const lists = LIST_FIELDS.map((key) => splitList(form?.[key]).slice(0, PROFILE_LIMITS[key]));
  return JSON.stringify([texts, lists]);
}

/** Kas vormis on midagi, mida salvestatud profiilis ei ole. */
export function isDirty(form, profile) {
  return comparable(form) !== comparable(toForm(profile));
}

/**
 * Mis on ülevaatusele esitamiseks puudu. Server keeldub esitamast ilma nime,
 * lühitutvustuse ja vähemalt ühe valdkonnata, aga vastab üldise veaga; leht
 * ütleb selle enne välja.
 */
export function missingForReview(form) {
  const missing = [];
  if (!String(form?.displayName || "").trim()) missing.push("display_name");
  if (!String(form?.bioShort || "").trim()) missing.push("bio_short");
  if (!splitList(form?.fields).length) missing.push("fields");
  return missing;
}

/** Loendid, kuhu on kirjutatud rohkem, kui server alles jätab. */
export function overLimit(form) {
  const result = {};
  for (const key of LIST_FIELDS) result[key] = splitList(form?.[key]).length > PROFILE_LIMITS[key];
  return result;
}

/** Mida profiiliga selles seisus teha saab. Nupp, mida server ei luba, ei ilmu. */
export function profileStateModel(profile) {
  const status = profile ? String(profile.status || "").toUpperCase() : "";
  const known = STATUS_WORDS.profile_status[status];
  return {
    status,
    helpKey: !profile ? "none" : known ? known.key : "",
    editable: !profile || EDITABLE_PROFILE_STATUSES.includes(status),
    canSubmit: status === "DRAFT" || status === "REJECTED",
    canSetCapacity: status === "ACTIVE",
    canPause: status === "ACTIVE",
    canResume: status === "PAUSED",
    canRetire: RETIRABLE_PROFILE_STATUSES.includes(status),
    reasonKey: status === "REJECTED" && REVIEW_REASON_KEYS.includes(profile?.reviewReasonKey) ? profile.reviewReasonKey : ""
  };
}

const excerpt = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > 90 ? `${text.slice(0, 89).trimEnd()}…` : text;
};

/** Profiilivormi sammud: seis numbri heleduseks ja rida vaatesse „Kõik sammud”. */
export function profileSteps({ t, form, profile }) {
  const has = (key) => Boolean(String(form?.[key] || "").trim());
  const tags = (key) => splitList(form?.[key]);
  const model = profileStateModel(profile);
  const state = {
    who: has("displayName") ? "done" : has("title") || has("organization") ? "partial" : "empty",
    areas: tags("fields").length ? "done" : tags("topics").length ? "partial" : "empty",
    ways: tags("languages").length && tags("formats").length ? "done" : tags("languages").length || tags("formats").length ? "partial" : "empty",
    intro: has("bioShort") ? "done" : "empty",
    story: has("bioFull") ? "done" : "empty",
    experience: has("experienceSummary") ? "done" : "empty",
    state: model.status === "ACTIVE" ? "done" : profile ? "partial" : "empty"
  };
  const summary = {
    who: [form?.displayName, form?.title].map((value) => String(value || "").trim()).filter(Boolean).join(" · "),
    areas: tags("fields").slice(0, 3).join(", "),
    ways: tags("languages").join(", "),
    intro: excerpt(form?.bioShort),
    story: excerpt(form?.bioFull),
    experience: excerpt(form?.experienceSummary),
    state: profile ? statusWord("profile_status", profile.status, t).text : t("mentoring.my_profile.views.state.summary_none")
  };
  return PROFILE_VIEW_KEYS.map((key) => ({
    key,
    label: t(`mentoring.my_profile.views.${key}.title`),
    short: t(`mentoring.my_profile.views.${key}.short`),
    state: state[key],
    summary: summary[key] || undefined
  }));
}

/* ------------------------------------------------------------------------
   Mentori profiil
   ------------------------------------------------------------------------ */

/**
 * Mentori profiil vaadete jaoks. Tutvustuseks on pikem tekst, selle puudumisel
 * lühike (sama reegel mis enne). Välisel kirjel taotluse osa ei ole.
 */
export function publicProfileModel(profile) {
  const external = profile?.external === true;
  const groups = ["fields", "topics", "languages", "formats"]
    .map((key) => ({ key, items: list(profile?.[key]).map((item) => String(item || "").trim()).filter(Boolean) }))
    .filter((group) => group.items.length);
  const bio = String(profile?.bioFull || profile?.bioShort || "").trim();
  const experience = String(profile?.experienceSummary || "").trim();
  return {
    external,
    heading: profile?.displayName || "",
    sub: [profile?.title, profile?.organization].filter(Boolean).join(" · "),
    groups,
    bio,
    experience,
    canRequest: !external && profile?.canRequest === true,
    externalUrl: external ? safeExternalUrl(profile?.externalProfileUrl) : "",
    viewKeys: PUBLIC_VIEW_KEYS.filter((key) => (key === "story" ? Boolean(bio || experience) : key === "request" ? !external : true))
  };
}

/** Mentori profiili osad lava jaoks. */
export function publicParts({ t, model, sent }) {
  const summary = {
    about: model.sub || model.heading,
    story: excerpt(model.bio || model.experience),
    request: sent
      ? t("mentoring.profile_public.request_sent_short")
      : model.canRequest
        ? t("mentoring.home.capacity_open")
        : t("mentoring.profile_public.capacity_full_note")
  };
  return model.viewKeys.map((key) => ({
    key,
    label: t(`mentoring.profile_public.views.${key}.title`),
    short: t(`mentoring.profile_public.views.${key}.short`),
    state: key === "request" ? (sent ? "done" : model.canRequest ? "partial" : "empty") : "partial",
    summary: summary[key] || undefined,
    /* Tutvustus võib olla pikk tekst: selle järgi ühist kõrgust ei võeta. */
    free: key === "story"
  }));
}
