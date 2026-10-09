/**
 * Dokumendi ja koostatud teksti detaililehtede reeglid ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Kaks detaililehte (`../DocumentDetailPage.jsx` faili oma leht
 * ja `../ArtifactDetailPage.jsx` koostatud teksti leht) joonistavad sama asja,
 * mida dokumentide lehe avatud dokument (`../workspace/documentRows.js`):
 * faktid, tegevused ja seis. Siin on see, mis on detaililehe oma ja mida silm
 * kergesti ei märka: millised osad lehel on (mustandil kinnitamine, kinnitatud
 * kohtumise kokkuvõttel jagamine), mida saab alla laadida, millistesse
 * ruumidesse saab jagada ja mida teine vajutus teeb. Puhtad funktsioonid, et
 * neid saaks testis päriselt välja kutsuda.
 *
 * TOORES VÄÄRTUS EI JÕUA EKRAANILE. Teksti liik ja seis läbivad kataloogi;
 * tundmatu liik saab sõna „Muu”, pealkirjata ruum sõna „Ruum” (mitte ruumi
 * sisemist tunnust) ja serveri veavõti, millel kataloogis sõna ei ole, annab
 * lehe enda lause.
 */

import { AGENT_ARTIFACT_TYPE_VALUES } from "@/lib/documents/constants";
import { formatDate, kindLabel } from "@/lib/documents/presentation";
import { buildWorkspaceItems } from "@/lib/documents/workspace";
import { localizePath } from "@/lib/localizePath";

import { itemSheet } from "../workspace/documentRows";

/** Vaated, millel on kataloogis nimi ja lühinimi (`documents.detail.views.<võti>`). */
export const DETAIL_VIEW_KEYS = Object.freeze(["text", "approve", "sheet", "share", "sources"]);

/* Teine vajutus (kustutamine, kinnitamine, jagamine) peab tulema selle aja
   sees ja mitte kiiremini kui topeltklõps. */
export const TWO_PRESS_HOLD_MS = 8000;
export const TWO_PRESS_MIN_GAP_MS = 400;

/* Nii palju ruume on valikus kohe näha (ühelaiused lahtrid); pikem loend on rippvalik. */
export const VISIBLE_ROOM_CHOICES = 6;

/**
 * Koostatud teksti osad. Leht avaneb tekstil: sinna tullakse loendist nupuga
 * „Ava tekst”. Mustandil on kinnitamine omaette osa; kinnitatud kohtumise
 * kokkuvõttel, mida vaataja tohib jagada, on jagamine omaette osa.
 */
export function artifactPartKeys({ draft = false, shareable = false } = {}) {
  if (draft) return ["text", "approve", "sheet", "sources"];
  return ["text", "sheet", ...(shareable ? ["share"] : []), "sources"];
}

/**
 * Faili oma lehe osad. Tekst on osa ainult siis, kui server selle annab
 * (transkript ja selle kokkuvõte); muidu on lehel üks vaade ja lava ei ole.
 */
export function documentPartKeys({ hasText = false } = {}) {
  return hasText ? ["sheet", "text"] : ["sheet"];
}

/** Mustandit saab muuta ja kinnitada; kõik muu on lugemiseks (sama piir mis serveril). */
export function isDraft(artifact) {
  return String(artifact?.status || "") === "DRAFT";
}

const ARTIFACT_TYPES = new Set(AGENT_ARTIFACT_TYPE_VALUES);

/** Teksti liik sõnaga; tundmatu liik on „Muu”, mitte sisemine kood. */
export function artifactTypeText(type, t) {
  const value = String(type || "").toUpperCase();
  return t(`documents.artifact_types.${ARTIFACT_TYPES.has(value) ? value.toLowerCase() : "other"}`);
}

/** Pealkirjata tekst kannab oma liigi nime (nt „Kohtumise kokkuvõte”). */
export function artifactTitle(artifact, t) {
  return String(artifact?.title || "").trim() || artifactTypeText(artifact?.type, t);
}

/** Sama rida, mille dokumentide leht teeb loendi jaoks: tüüp, päritolu, kehtivus. */
export function artifactItem(artifact) {
  return buildWorkspaceItems({ artifacts: artifact ? [artifact] : [] })[0] || null;
}

export function documentItem(document) {
  return buildWorkspaceItems({ documents: document ? [document] : [] })[0] || null;
}

/**
 * Mida kinnitatud tekstist alla laadida saab. Server pakub PDF-i linki iga
 * kinnitatud teksti juures, aga PDF-i ei tehta, kui tekstis on märke, mida PDF
 * ei toeta. Kinnitamisel salvestatud kirje (`provenance.rendered`) ütleb, kas
 * PDF on olemas: kui ei ole, siis linki ei näidata, sest see viiks veateateni.
 */
export function artifactDownloads(artifact) {
  if (!artifact || isDraft(artifact)) return { docx: null, pdf: null, pdfMissing: false };
  const urls = artifact.downloadUrls || {};
  const rendered = artifact.provenance?.rendered;
  const pdfMissing = Boolean(rendered) && typeof rendered === "object" && !rendered.pdf;
  return { docx: urls.docx || null, pdf: pdfMissing ? null : urls.pdf || null, pdfMissing };
}

/**
 * Koostatud teksti andmete leht: dokumentide lehe avatud dokumendi faktid ja
 * lisaks see, mida loend ei näita (teksti liik, loomise ja kinnitamise aeg).
 * Märkus ütleb, miks mustandit veel alla laadida ei saa või miks PDF-i ei ole.
 * Liigi märki ei ole, kui pealkirjata tekst juba kannab oma liigi nime.
 */
export function artifactSheet(artifact, { t, locale }) {
  const item = artifactItem(artifact);
  if (!item) return null;
  const sheet = itemSheet(item, { t, locale });
  const dates = [
    { key: "created", label: t("documents.detail.facts.created"), value: formatDate(artifact.createdAt, locale) },
    { key: "approved", label: t("documents.approved_at"), value: artifact.approvedAt ? formatDate(artifact.approvedAt, locale) : "" }
  ].filter((fact) => fact.value);
  const title = artifactTitle(artifact, t);
  const kind = artifactTypeText(artifact.type, t);
  return {
    ...sheet,
    title,
    chips: kind === title ? [] : [{ key: "kind", text: kind, tone: "quiet" }],
    note: isDraft(artifact)
      ? t("documents.draft_notice")
      : artifactDownloads(artifact).pdfMissing
        ? t("api.exports.pdf_content_not_supported")
        : "",
    facts: [...sheet.facts, ...dates]
  };
}

/**
 * Faili andmete leht. Pöörduja (`plain`) ei näe päritolu ja otsingu fakte, aga
 * faili liik on tal ikka näha, nagu vanal lehel.
 */
export function documentSheet(item, { t, locale, plain = false }) {
  const sheet = itemSheet(item, { t, locale, plain });
  if (!plain) return sheet;
  return {
    ...sheet,
    facts: [{ key: "kind", label: t("documents.form.kind_label"), value: kindLabel(item?.raw?.kind, t) }]
  };
}

/** Faili tekst, kui server selle andis (transkript); ainult tühikutest tekst on „teksti ei ole”. */
export function documentText(document) {
  const text = String(document?.content || "");
  return text.trim() ? text : "";
}

export function documentHref(id, locale) {
  return localizePath(`/documents/${encodeURIComponent(String(id || ""))}`, locale);
}

/**
 * Dokumentide leht, kus on ees koostatud tekstide loend (sama süvalink, mida
 * kasutab koostamisruum). Faili lehelt minnakse dokumentide lehe algusesse.
 */
export function documentsHref(locale, { artifacts = false } = {}) {
  return localizePath(artifacts ? "/documents?artifacts=all#artifacts" : "/documents", locale);
}

/**
 * Mustandi avamine koostamisruumis: sama aadressi kuju, mille koostamisruum
 * ise kirjutab (allikad ja tekst), nii et seal on ees sama töö.
 */
export function draftingHref(artifact, locale) {
  const params = new URLSearchParams();
  const sourceIds = (Array.isArray(artifact?.sources) ? artifact.sources : [])
    .map((source) => String(source?.id || "").trim())
    .filter(Boolean);
  if (sourceIds.length) params.set("documents", sourceIds.join(","));
  params.set("artifact", String(artifact?.id || ""));
  return `${localizePath("/dokreziim", locale)}?${params.toString()}`;
}

function sourceRow(prefix, document, chip, { t, locale }) {
  const name = String(document.originalName || "").trim();
  const title = String(document.title || "").trim() || name || t("documents.workspace.untitled");
  return {
    key: `${prefix}:${document.id}`,
    title,
    /* Faili nimi teise reana ainult siis, kui see ütleb pealkirjast midagi muud. */
    sub: name && name !== title ? name : "",
    chip,
    href: documentHref(document.id, locale)
  };
}

/**
 * Millest tekst koostati: valitud mall ja allikfailid. Iga rida viib selle
 * faili oma lehele.
 * @returns {{ template: object|null, sources: object[] }}
 */
export function sourceRows(artifact, { t, locale }) {
  const template = artifact?.template?.id
    ? sourceRow("template", artifact.template, t("documents.template_label"), { t, locale })
    : null;
  const sources = (Array.isArray(artifact?.sources) ? artifact.sources : [])
    .filter((source) => source?.id)
    .map((source) => sourceRow("source", source, kindLabel(source.kind, t), { t, locale }));
  return { template, sources };
}

/** Sõnade arv plaadi kokkuvõtte jaoks. */
export function wordCount(text) {
  const words = String(text || "").trim();
  return words ? words.split(/\s+/).length : 0;
}

/** Kas väljadel on midagi, mida serveris veel ei ole. */
export function draftDirty(artifact, { title, content }) {
  return String(title ?? "") !== String(artifact?.title || "") || String(content ?? "") !== String(artifact?.content || "");
}

const SHARE_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER", "ADMIN"]);

/** Kes tohib kohtumise kokkuvõtet ruumi jagada (sama reegel mis serveril, `lib/rooms/meetingSummaryShare.js`). */
export function canShareMeetingSummary(user) {
  return Boolean(user?.isAdmin || SHARE_ROLES.has(String(user?.role || "").trim().toUpperCase()));
}

/** Ruumi saab jagada ainult kinnitatud kohtumise kokkuvõtet. */
export function isShareableSummary(artifact) {
  return Boolean(artifact) && !isDraft(artifact) && artifact.type === "MEETING_SUMMARY";
}

/**
 * Ruumid, kuhu kokkuvõtet saab jagada: ruumis on peale jagaja veel keegi ja
 * ruum ei ole arhiveeritud (arhiveeritud ruumi server sõnumit vastu ei võta).
 * Pealkirjata ruum saab sõna „Ruum”, mitte oma sisemist tunnust.
 */
export function shareRoomOptions(rooms, t) {
  return (Array.isArray(rooms) ? rooms : [])
    .filter((room) => room?.id && Number(room.memberCount) > 1 && !room.archivedAt)
    .map((room) => ({ value: String(room.id), label: String(room.title || "").trim() || t("rooms.fallback_title") }));
}

/**
 * Mis jagamisest sai. Jagamine ise võib õnnestuda ka siis, kui kinnituse
 * küsimine ei õnnestunud: siis peab jagaja seda teada saama (`approvalWarn`).
 * `asked`: kas jagaja palus kinnitust küsida.
 */
export function shareOutcome(payload, { asked = false } = {}) {
  const share = payload?.summaryShare || {};
  const approvalRequested = share.approvalRequested === true;
  return {
    approvalRequested,
    approvalWarn: share.approvalFailed === true || (Boolean(asked) && !approvalRequested)
  };
}

/** Viga, mille sõnum tuli serveri vastusest ja mida võib inimesele näidata. */
export class RequestFailure extends Error {}

/**
 * Vea lause inimesele. Serveri vastusest tulnud sõnum sobib ekraanile; võrgu-
 * ja muu viga kannab brauseri ingliskeelset teksti („Failed to fetch”) ja selle
 * asemel on lehe oma lause.
 */
export function failureText(error, fallback) {
  return error instanceof RequestFailure && error.message ? error.message : fallback;
}

const KEY_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;

/**
 * Serveri veateade ekraanile. Dokumentide marsruudid saadavad tõlgitud lause,
 * ruumide marsruut saadab võtme ka välja `message` sees. Võti tõlgitakse
 * kataloogist; võti, millel sõna ei ole, annab `fallback`-i, mitte võtit.
 */
export function serverMessage(payload, t, fallback) {
  const translate = (key) => {
    const text = key ? t(key, "") : "";
    return text && text !== key ? text : "";
  };
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  return (
    translate(String(payload?.messageKey || "").trim()) ||
    (message && !KEY_SHAPE.test(message) ? message : translate(message)) ||
    fallback
  );
}

/**
 * Mida vajutus teeb nupul, mis küsib teist vajutust: esimene relvastab, liiga
 * kiire teine (topeltklõps) jääb vahele, õige teine teeb töö ära.
 * @returns {"arm" | "wait" | "run"}
 */
export function pressOutcome({ armed, armedAt, now, minGapMs = TWO_PRESS_MIN_GAP_MS }) {
  if (!armed) return "arm";
  return now - armedAt < minGapMs ? "wait" : "run";
}

/** All hoitud Enter või tühik kordab vajutust: see ei tohi olla teine vajutus. */
export function isHeldActivation(event) {
  return Boolean(event?.repeat) && (event.key === "Enter" || event.key === " ");
}
