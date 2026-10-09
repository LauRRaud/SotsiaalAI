/**
 * Dokumentide lehe read ja reeglid ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Kuni need otsused elasid lehe JSX-is, ei saanud neid testida:
 * milline rida saab millise märgi, mida avatud dokumendiga teha saab (süsteemi
 * loodud kirjet ei kustutata, töös olevat uuringut peatatakse, mitte ei
 * kustutata) ja millised osad on lehel pöördujal ning millised spetsialistil.
 * Siin on puhtad funktsioonid; leht (`../DocumentsPage.jsx`) hoiab andmeid ja
 * päringuid ning vaated (`./DocumentsViews.jsx`) ainult joonistavad.
 *
 * TOORES VÄÄRTUS EI JÕUA EKRAANILE. Iga seis (dokumendi liik, uuringu olek,
 * otsingust eemaldamise seis) läbib kataloogi; tundmatu väärtus annab üldise
 * sildi või jääb ära, mitte ei kuva sisemist koodi.
 */

import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/constants";
import { describeProvenance, formatDate, formatFileSize, researchStatusLabel, workspaceTypeLabel } from "@/lib/documents/presentation";
import { localizePath } from "@/lib/localizePath";

/** Vaated, millel on kataloogis nimi ja lühinimi (`documents.views.<võti>`). */
export const VIEW_TEXT_KEYS = Object.freeze(["entry", "add", "list", "item", "framework", "sources"]);

/**
 * Lehe osad. Pöördujal on ainult tema lähtefailid (loend ja avatud fail);
 * spetsialistil tegevused, faili lisamine, loend ja raamistik. Avatud dokument
 * on osa ainult siis, kui midagi on avatud.
 */
export function viewKeysFor({ client = false, opened = false } = {}) {
  if (client) return opened ? ["list", "item"] : ["list"];
  return ["entry", "add", "list", ...(opened ? ["item"] : []), "framework"];
}

/**
 * Sisenemise kaardid: neli tegevust viivad teisele lehele, kaks selle lehe
 * osasse. Võtmed on siin sõnadega välja kirjutatud (mitte kokku liidetud), et
 * test saaks kontrollida iga teksti olemasolu kolmes keeles.
 */
export const ENTRY_CARDS = Object.freeze([
  { key: "analyze", titleKey: "documents.workspace.entry.analyze_title", descKey: "documents.workspace.entry.analyze_desc", path: "/vestlus" },
  { key: "compose", titleKey: "documents.workspace.entry.compose_title", descKey: "documents.workspace.entry.compose_desc", path: "/dokreziim" },
  { key: "transcribe", titleKey: "documents.workspace.entry.transcribe_title", descKey: "documents.workspace.entry.transcribe_desc", path: "/dokreziim" },
  {
    key: "research",
    titleKey: "documents.workspace.entry.research_title",
    descKey: "documents.workspace.entry.research_desc",
    offKey: "documents.workspace.research_disabled",
    path: "/vestlus"
  },
  { key: "add", titleKey: "documents.workspace.entry.add_file_title", descKey: "documents.views.entry.add_file_desc", view: "add" },
  { key: "list", titleKey: "documents.views.list.title", descKey: "documents.views.entry.list_desc", view: "list" }
]);

/** @returns {{ key: string, title: string, description: string, href: string|null, view: string|null }[]} */
export function entryCards({ t, locale, researchEnabled = true }) {
  return ENTRY_CARDS.map((card) => ({
    key: card.key,
    title: t(card.titleKey),
    /* Kui süvauuringut ei saa käivitada, ütleb kaart seda selgituse asemel:
       lubadus „käivita” ja teade „ei saa käivitada” ei seisa kõrvuti. */
    description: card.offKey && !researchEnabled ? t(card.offKey) : t(card.descKey),
    href: card.path ? localizePath(card.path, locale) : null,
    view: card.view || null
  }));
}

/**
 * Loendi tüübifilter. Teenuspäeviku aruannetel on oma rühm, sest neid otsitakse
 * perioodi, mitte pealkirja järgi.
 */
export const TYPE_FILTERS = Object.freeze([
  { value: "ALL", labelKey: "documents.filters.all", types: null },
  { value: "FILES", labelKey: "documents.workspace.filters.files", types: ["source", "transcript"] },
  { value: "ANALYSIS", labelKey: "documents.workspace.filters.analysis", types: ["analysis"] },
  { value: "ARTIFACTS", labelKey: "documents.workspace.filters.artifacts", types: ["draft", "final"] },
  { value: "RESEARCH", labelKey: "documents.workspace.filters.research", types: ["research"] },
  { value: "SERVICE_LOG", labelKey: "documents.workspace.filters.service_log", types: ["service_log"] }
]);

export function filterOptions(t) {
  return TYPE_FILTERS.map((filter) => ({ value: filter.value, label: t(filter.labelKey) }));
}

/** Tundmatu filter näitab kõike: vale väärtus ei tohi loendit tühjaks teha. */
export function filterItems(items, filterValue) {
  const list = Array.isArray(items) ? items : [];
  const types = TYPE_FILTERS.find((filter) => filter.value === filterValue)?.types;
  return types ? list.filter((item) => types.includes(item.type)) : list;
}

const DOCUMENT_TYPES = new Set(["source", "transcript", "service_log"]);
const TYPE_TONES = { draft: "wait", final: "ok" };
const RESEARCH_TONES = { queued: "wait", running: "wait", done: "ok", error: "risk", cancelled: "quiet" };
/* Uuring on lõppenud nendes seisudes; kõigis teistes saab seda peatada. */
const RESEARCH_ENDED = new Set(["done", "error", "cancelled"]);
const REMOVAL_CHIPS = {
  pending: { key: "documents.views.chips.removal_pending", tone: "wait" },
  failed: { key: "documents.views.chips.removal_failed", tone: "risk" }
};
export const REMOVAL_NOTE_KEYS = Object.freeze({
  pending: "documents.workspace.rag_removal_pending",
  failed: "documents.workspace.rag_removal_failed"
});
const FACT_LABEL_KEYS = Object.freeze({
  audience: "documents.provenance.labels.audience",
  origin: "documents.provenance.labels.origin",
  state: "documents.provenance.labels.state",
  retention: "documents.provenance.labels.retention",
  rag: "documents.provenance.labels.rag"
});

/** Kas vana otsingukoopia eemaldamine on pooleli (`pending`) või ootab uut katset (`failed`). */
export function removalState(item) {
  const status = String(item?.raw?.metadata?.ragRemoval?.status || "");
  return status === "pending" || status === "failed" ? status : "";
}

/**
 * Rea seisumärgid. Tüüp on real alati; siin on see, mida tüüp ei ütle:
 * uuringu olek, pooleli eemaldamine, süsteemi loodud kirje või see, et fail on
 * töörežiimi lubatud (see on ainus valik, mis muudab, kes faili näeb).
 */
function stateChips(item, t) {
  const raw = item?.raw || {};
  if (item.type === "research") {
    const status = String(raw.status || "").toLowerCase();
    return [{ key: "status", text: researchStatusLabel(raw.status, t), tone: RESEARCH_TONES[status] || "wait" }];
  }
  if (!DOCUMENT_TYPES.has(item.type)) return [];
  const removal = REMOVAL_CHIPS[removalState(item)];
  if (removal) return [{ key: "removal", text: t(removal.key), tone: removal.tone }];
  if (item.readOnly) return [{ key: "system", text: t("documents.framework_acceptance.system_chip"), tone: "quiet" }];
  if (raw.agentAllowed) return [{ key: "shared", text: t("documents.views.chips.shared"), tone: "ok" }];
  return [];
}

/**
 * Loendi rida: pealkiri, tüüp, seis ja aeg. `plain` on pöörduja lähtefailide
 * loend: seal on kõik read sama liiki failid ja märgid oleksid müra.
 */
export function documentRow(item, { t, locale, plain = false }) {
  return {
    key: item.key,
    title: item.title || t("documents.workspace.untitled"),
    type: plain ? "" : workspaceTypeLabel(item.type, t),
    tone: TYPE_TONES[item.type] || "quiet",
    chips: plain ? [] : stateChips(item, t),
    date: formatDate(item.updatedAt, locale)
  };
}

/** Avatud dokumendi faktid: kes näeb, kust see tuli, mis seisus on, kui kaua säilib ja kas läheb otsingusse. */
export function itemFacts(item, t) {
  const provenance = describeProvenance(item, t);
  return Object.keys(FACT_LABEL_KEYS)
    .map((key) => ({ key, label: t(FACT_LABEL_KEYS[key]), value: provenance[key] }))
    .filter((fact) => fact.value);
}

/**
 * Avatud dokumendi leht: sama rida, mis loendis, ja lisaks faili nimi,
 * selgitav märkus ning faktid. Pöörduja näeb oma faili nime ja suurust; päritolu
 * ja otsingu faktid on spetsialisti tööruumi jaoks.
 */
export function itemSheet(item, { t, locale, plain = false }) {
  const raw = item?.raw || {};
  const isDocument = DOCUMENT_TYPES.has(item.type);
  return {
    ...documentRow(item, { t, locale, plain }),
    file: isDocument && raw.originalName ? `${raw.originalName} · ${formatFileSize(raw.size)}` : "",
    note: item.readOnly
      ? t("documents.framework_acceptance.read_only_note")
      : item.type === "analysis"
        ? t("documents.analyses.disclaimer")
        : "",
    facts: plain ? [] : itemFacts(item, t)
  };
}

/** Kas kinnitatud tekstist tehti PDF. Teadmata (vanem kirje) loetakse tehtuks. */
export function pdfWasRendered(artifact) {
  const rendered = artifact?.provenance?.rendered;
  return !(Boolean(rendered) && typeof rendered === "object" && !rendered.pdf);
}

/**
 * Mida avatud dokumendiga teha saab.
 *
 * - Fail ja transkript: alla laadida; muuta (ümber nimetada, töörežiimi lubada,
 *   kustutada) ainult siis, kui see ei ole süsteemi loodud kirje; „koosta
 *   sellest” ainult töörežiimi lubatud failist.
 * - Teenuspäeviku aruanne: ainult alla laadida. See on raamatupidamise
 *   alusdokument, mida ei muudeta ega kustutata enne säilitustähtaega, ja
 *   jagatud otsingusse see ei lähe.
 * - Analüüs: tekst avaneb koos dokumendiga; kustutada saab.
 * - Mustand ja kinnitatud tulemus: avada, laadida alla (kui fail on olemas),
 *   kopeerida, kustutada.
 * - Uuring: avada vestluses; töös olevat saab peatada, lõppenut kustutada.
 * - Pöörduja (`client`): oma lähtefaili saab alla laadida ja kustutada.
 */
export function itemActions(item, { locale, client = false } = {}) {
  const raw = item?.raw || {};
  const id = encodeURIComponent(item?.id || "");
  const none = { download: null, compose: null, rename: false, share: null, open: null, docx: null, pdf: null, copy: false, chat: null, stop: false, text: false, remove: null };

  switch (item?.type) {
    case "source":
    case "transcript": {
      const editable = !item.readOnly;
      const download = `/api/documents/${id}/download`;
      if (client) return { ...none, download, remove: editable ? "document" : null };
      return {
        ...none,
        download,
        compose: editable && raw.agentAllowed ? `${localizePath("/dokreziim", locale)}?documents=${id}` : null,
        rename: editable,
        share: editable ? { checked: Boolean(raw.agentAllowed), removal: removalState(item) } : null,
        remove: editable ? "document" : null
      };
    }
    case "service_log":
      return { ...none, download: `/api/documents/${id}/download` };
    case "analysis":
      return { ...none, text: true, remove: "analysis" };
    case "draft":
    case "final":
      return {
        ...none,
        open: localizePath(`/documents/artifacts/${id}`, locale),
        docx: raw.downloadUrls?.docx || null,
        /* PDF-i ei tehta, kui tekstis on märke, mida PDF-i kirjatüüp ei kanna
           (kirillitsa, emotikonid): link vastaks siis veaga. Sama reegel mis
           detaililehel (`artifactDownloads`, ../detail/detailModel.js). */
        pdf: pdfWasRendered(raw) ? raw.downloadUrls?.pdf || null : null,
        copy: true,
        remove: "artifact"
      };
    case "research": {
      const ended = RESEARCH_ENDED.has(String(raw.status));
      return {
        ...none,
        chat: raw.convId ? `${localizePath("/vestlus", locale)}?conv=${encodeURIComponent(raw.convId)}` : null,
        stop: !ended,
        remove: ended ? "research" : null
      };
    }
    default:
      return none;
  }
}

/** Failivalija lubatud tüübid: samad, mida server vastu võtab (laiendid ja MIME-tüübid). */
export const UPLOAD_ACCEPT = [...Object.values(ALLOWED_DOCUMENT_TYPES).flat(), ...Object.keys(ALLOWED_DOCUMENT_TYPES)].join(",");

/**
 * Kas valitud faili saab üles laadida. Liiga suurt faili ei ole mõtet enne
 * serveri keeldumist terves mahus teele saata; tüüpi kontrollib server sisu
 * järgi ja seda siin ei dubleerita.
 * @returns {string} veateate võti või tühi string
 */
export function uploadProblem(file) {
  if (!file) return "";
  return Number(file.size || 0) > MAX_DOCUMENT_SIZE_BYTES ? "documents.errors.file_too_large" : "";
}
