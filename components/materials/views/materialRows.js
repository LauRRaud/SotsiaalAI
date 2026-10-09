/**
 * Materjalide lehe read ja reeglid ILMA JSX-ita: seisu sõnad, säilitamise read,
 * loendi read, avatud materjali leht, faili valiku kontroll ning ülevaatuse
 * (administraatori) read ja õiguste vorm.
 *
 * MIKS OMA FAIL. Kuni need otsused elasid lehe JSX-is, ei saanud neid testida:
 * millal saab materjali tagasi võtta, mis sõnaga seisu näidatakse, mida
 * laekunud materjaliga teha saab. Siin on puhtad funktsioonid; lehed
 * (`../MaterialsPage.jsx`, `../MaterialsAdminSubmissionsPanel.jsx`) hoiavad
 * andmeid ja päringuid ning vaated (`./MaterialsViews.jsx`, `./ReviewViews.jsx`)
 * ainult joonistavad.
 *
 * TOORES VÄÄRTUS EI JÕUA EKRAANILE. Vana leht kirjutas säilitamise kihi seisu
 * ja teavituse seisu välja nii, nagu need andmebaasis on (`NOT_PRESENT`,
 * `RETRY`). Iga seis saab siin kataloogist sõna; tundmatu väärtus annab üldise
 * sildi, mitte sisemise koodi.
 */

import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/constants";
import { formatDate, formatFileSize } from "@/lib/documents/presentation";
import { getMaterialsFileCountLimit } from "@/lib/storageGuardrails";

/** Vaated, millel on kataloogis nimi ja lühinimi (`materials_page.views.<võti>`). */
export const MATERIAL_VIEW_KEYS = Object.freeze(["list", "send", "item", "review", "submission", "rights"]);

/** Materjali seisud (sama loend mis failis lib/materials/submissions.js). */
export const MATERIAL_STATUSES = Object.freeze(["pending", "reviewed", "rejected", "imported"]);
const STATUS_TONES = Object.freeze({ pending: "wait", reviewed: "ok", rejected: "risk", imported: "ok" });

/** Seisu sõna ja märgi toon. Tundmatu seis saab üldise sõna. */
export function materialStatus(status, t) {
  const value = String(status || "").trim().toLowerCase();
  if (!MATERIAL_STATUSES.includes(value)) return { value: "", text: t("materials_page.status_unknown"), tone: "quiet" };
  return { value, text: t(`materials_page.admin.status.${value}`), tone: STATUS_TONES[value] };
}

/** Kuupäev ilma kellaajata (säilitamise tähtaeg, saatmise päev loendis). */
export function formatDay(value, locale = "et") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
}

/* --- Säilitamine: kolm kihti (originaal, puhastatud koopia, otsingu koopia) --- */

export const RETENTION_LAYERS = Object.freeze(["original", "derivative", "rag"]);
/** Kihi seisud, nagu server need salvestab (lib/materials/retentionPolicy.js ja retention.js). */
export const RETENTION_STATES = Object.freeze(["SCHEDULED", "NOT_PRESENT", "DELETED"]);

/**
 * Säilitamise read: kihi nimi ja kas tähtaeg („kuni …") või seisu sõna.
 * Kustutatud kiht ütleb „kustutatud" ka siis, kui vana tähtaeg on kirjes alles.
 */
export function retentionFacts(retention, { t, locale } = {}) {
  return RETENTION_LAYERS.map((layer) => {
    const entry = retention?.[layer];
    const state = String(entry?.state || "NOT_PRESENT").trim().toUpperCase();
    const word = RETENTION_STATES.includes(state) ? state.toLowerCase() : "unknown";
    const until = state !== "DELETED" && entry?.until ? formatDay(entry.until, locale) : "";
    return {
      key: `retention-${layer}`,
      label: t(`materials_page.retention.layers.${layer}`),
      value: until ? t("materials_page.retention.until_date", { date: until }) : t(`materials_page.retention.state.${word}`)
    };
  });
}

/* --- Minu saadetud materjalid --------------------------------------------- */

/* Fakt ilma väärtuseta (nt loetamatu kuupäev) jääb reast välja, mitte ei näita tühja nimetust. */
const hasValue = (fact) => Boolean(fact.value);

/** Loendi rida: faili nimi, seis märgina ja saatmise päev. Kõik muu on avatud materjali vaates. */
export function mineRows(items, { t, locale } = {}) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const status = materialStatus(item.status, t);
    return {
      id: String(item.id),
      title: item.originalName || t("materials_page.views.item.title"),
      state: status.text,
      tone: status.tone,
      date: formatDay(item.createdAt, locale)
    };
  });
}

/** Tagasi saab võtta ootel või tagasi lükatud materjali (sama reegel mis vanal lehel). */
export function canWithdraw(status) {
  return ["pending", "rejected"].includes(String(status || "").trim().toLowerCase());
}

export function materialDownloadHref(id) {
  return `/api/materials/${encodeURIComponent(id)}/download`;
}

/** Avatud materjal: seis, faktid (saadetud, suurus, säilitamine), oma selgitus ja tegevused. */
export function materialSheet(item, { t, locale } = {}) {
  const status = materialStatus(item?.status, t);
  return {
    title: item?.originalName || t("materials_page.views.item.title"),
    state: status.text,
    tone: status.tone,
    facts: [
      { key: "sent", label: t("materials_page.views.item.sent_at"), value: formatDate(item?.createdAt, locale) },
      { key: "size", label: t("materials_page.views.item.size"), value: formatFileSize(item?.size) },
      ...retentionFacts(item?.retention, { t, locale })
    ].filter(hasValue),
    comment: String(item?.comment || "").trim(),
    downloadHref: materialDownloadHref(item?.id),
    canWithdraw: canWithdraw(item?.status)
  };
}

/* --- Faili valik ---------------------------------------------------------- */

/** Failivalija lubatud tüübid: samad, mida server vastu võtab. */
export const UPLOAD_ACCEPT = [...Object.values(ALLOWED_DOCUMENT_TYPES).flat(), ...Object.keys(ALLOWED_DOCUMENT_TYPES)].join(",");

/** Piirid, mida abitekst nimetab: tulevad samadest konstantidest, mida server kontrollib. */
export const UPLOAD_LIMITS = Object.freeze({
  count: getMaterialsFileCountLimit(),
  sizeMb: Math.round(MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024))
});

/** Selgituse pikkus: server lõikab pikema teksti (lib/materials/server.js). */
export const COMMENT_MAX = 4000;

/**
 * Mis on valitud failidega valesti. Liiga palju või liiga suurt faili ei ole
 * mõtet enne serveri keeldumist teele saata; tüüpi kontrollib server sisu järgi.
 * @returns {string} veateate võti või tühi string
 */
export function uploadProblem(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length > UPLOAD_LIMITS.count) return "materials_page.errors.file_count_exceeded";
  if (list.some((file) => Number(file?.size || 0) > MAX_DOCUMENT_SIZE_BYTES)) return "documents.errors.file_too_large";
  return "";
}

/** Valitud failid ridadena: nimi ja suurus. */
export function fileRows(files) {
  return (Array.isArray(files) ? files : []).map((file, index) => ({
    key: `${index}:${file?.name || ""}`,
    name: String(file?.name || ""),
    size: formatFileSize(file?.size)
  }));
}

/* --- Ülevaatus (administraator) ------------------------------------------- */

/** Loendi filter: „kõik" ja iga seis. Väärtus „all" tähendab päringus filtrita loendit. */
export const FILTER_ALL = "all";
export function statusFilterOptions(t) {
  return [
    { value: FILTER_ALL, label: t("materials_page.admin.all_statuses") },
    ...MATERIAL_STATUSES.map((status) => ({ value: status, label: t(`materials_page.admin.status.${status}`) }))
  ];
}

/** Lubatud üleminekud: samad mis serveris (lib/materials/review.js `REVIEW_TRANSITIONS`). */
export const REVIEW_TRANSITIONS = Object.freeze({
  pending: Object.freeze(["reviewed", "rejected"]),
  reviewed: Object.freeze(["pending", "rejected", "imported"]),
  rejected: Object.freeze(["pending", "reviewed"]),
  imported: Object.freeze([])
});

/** Mida laekunud materjaliga teha saab: nupp on keelatud, kui server üleminekust keelduks. */
export function reviewActions(status) {
  const next = REVIEW_TRANSITIONS[String(status || "").trim().toLowerCase()] || [];
  return {
    canReview: next.includes("reviewed"),
    canReject: next.includes("rejected"),
    canImport: next.includes("imported")
  };
}

/** Ülevaatuse märkuse pikkus: server keeldub pikemast (lib/materials/submissions.js). */
export const REVIEW_NOTE_MAX = 2000;

/** Administraatori teavituse seisud (lib/materials/notifications.js). */
export const NOTIFICATION_STATES = Object.freeze(["PENDING", "SENDING", "RETRY", "SENT", "FAILED"]);

/** Teavituse seis sõnaga, katsete arv ja veakood (kood on tehniline viide, mitte seis). */
export function notificationText(notification, t) {
  if (!notification) return "";
  const state = String(notification.status || "").trim().toUpperCase();
  const word = t(`materials_page.admin.notification.${NOTIFICATION_STATES.includes(state) ? state.toLowerCase() : "unknown"}`);
  const text = t("materials_page.admin.notification_attempts", { status: word, attempts: Number(notification.attempts || 0) });
  return notification.lastErrorCode ? `${text} (${t("materials_page.admin.error_code", { code: notification.lastErrorCode })})` : text;
}

/** Laekunud materjalide loendi rida: nimi, saatja, seis ja saatmise aeg. */
export function submissionRows(items, { t, locale } = {}) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const status = materialStatus(item.status, t);
    return {
      id: String(item.id),
      title: item.originalName || t("materials_page.views.submission.title"),
      sub: item.submittedByUser?.email || "",
      state: status.text,
      tone: status.tone,
      date: formatDate(item.createdAt, locale)
    };
  });
}

export function materialPreviewHref(id) {
  return `/api/materials/${encodeURIComponent(id)}/preview`;
}

/** Avatud laekunud materjal: faktid, saatja selgitus, eelmine ülevaatus ja lubatud tegevused. */
export function submissionSheet(item, { t, locale } = {}) {
  const status = materialStatus(item?.status, t);
  const reviewed = [item?.reviewedAt ? formatDate(item.reviewedAt, locale) : "", item?.reviewedBy || ""].filter(Boolean).join(" · ");
  const notification = notificationText(item?.notification, t);
  return {
    title: item?.originalName || t("materials_page.views.submission.title"),
    state: status.text,
    tone: status.tone,
    facts: [
      { key: "sent", label: t("materials_page.views.item.sent_at"), value: formatDate(item?.createdAt, locale) },
      { key: "size", label: t("materials_page.views.item.size"), value: formatFileSize(item?.size) },
      ...(item?.submittedByUser?.email ? [{ key: "submitter", label: t("materials_page.admin.submitter"), value: item.submittedByUser.email }] : []),
      ...(reviewed ? [{ key: "review", label: t("materials_page.admin.review_fact"), value: reviewed }] : []),
      ...retentionFacts(item?.retention, { t, locale }),
      ...(notification ? [{ key: "notification", label: t("materials_page.admin.notification_label"), value: notification }] : [])
    ].filter(hasValue),
    comment: String(item?.comment || "").trim(),
    reviewNote: String(item?.reviewNote || "").trim(),
    previewHref: materialPreviewHref(item?.id),
    ...reviewActions(item?.status)
  };
}

/* Õiguste alused, mida server impordil lubab (lib/materials/ragPolicy.js). */
export const RIGHTS_BASES = Object.freeze(["PUBLIC_DOMAIN", "OPEN_LICENSE", "DOCUMENTED_PERMISSION"]);

export function rightsBasisOptions(t) {
  return RIGHTS_BASES.map((value) => ({ value, label: t(`materials_page.admin.rights.basis.${value.toLowerCase()}`) }));
}

export function emptyRights() {
  return { authorName: "", rightsHolder: "", rightsBasis: "", rightsEvidence: "", confirmed: false };
}

/** Import on võimalik, kui kõik neli välja on täidetud ja kinnitus antud (vana leht küsis need järjest). */
export function rightsReady(form) {
  return Boolean(
    String(form?.authorName || "").trim() &&
      String(form?.rightsHolder || "").trim() &&
      RIGHTS_BASES.includes(form?.rightsBasis) &&
      String(form?.rightsEvidence || "").trim() &&
      form?.confirmed === true
  );
}

/** Impordi päringu õiguste osa: sama kuju mis vanal lehel. */
export function rightsPayload(form) {
  return {
    authorName: form.authorName,
    rightsHolder: form.rightsHolder,
    rightsBasis: form.rightsBasis,
    rightsEvidence: form.rightsEvidence,
    clientCaseMaterial: false,
    confidential: false,
    containsPersonalData: false
  };
}
