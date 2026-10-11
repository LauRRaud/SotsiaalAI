/**
 * Teekonna avalehe reeglid ilma joonistamiseta: loendi rühmad ja read, alustamise
 * sammud, mustandi värskus ja pooleli jäänud töö taastamine.
 *
 * MIKS OMAETTE FAIL. Lehe otsused (mis rida on kus, millal ülevaade uuesti
 * koostatakse, mis läheb serverisse) on siin puhaste funktsioonidena, et neid
 * saaks testida käitumise, mitte lähteteksti järgi (`tests/journey-dashboard-views.test.mjs`).
 * Leht (`../JourneyDashboard.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./DashboardViews.jsx`) ainult joonistavad.
 */

/** Alustamise sammud lehe järjekorras. Loend on kindel: samm ei teki ega kao kirjutamise ajal. */
export const START_STEPS = Object.freeze(["describe", "overview", "ahead", "wish", "save"]);

/** Aadressi märge `?samm=`: kirjeldamine või ülevaade (vana lehe kaks sammu; lingid jäävad kehtima). */
export const START_URL_STEPS = Object.freeze({ describe: "kirjelda", review: "ulevaade" });

export const SITUATION_LIMIT = 12000;
export const TITLE_LIMIT = 160;

/* Teine vajutus samal nupul ei tule topeltklõpsust; kinnituse ootus aegub. */
export const PRESS_GAP_MS = 400;
export const CONFIRM_MS = 8000;

export function pressTooSoon(since, now = Date.now()) {
  return Boolean(since) && now - since < PRESS_GAP_MS;
}

/**
 * Kiire abi numbrid. Vanal lehel seisid need kolme palja numbrina ribal, mis
 * kattis sissejuhatuse; inimene ei saanud teada, mis number on mille jaoks.
 * Siin on igal numbril nimi (kataloogist) ja number on helistatav link.
 */
export const QUICK_HELP = Object.freeze([
  Object.freeze({ key: "emergency", tel: "112" }),
  Object.freeze({ key: "child", tel: "116111" }),
  Object.freeze({ key: "victim", tel: "116006" })
]);

function text(value) {
  return typeof value === "string" ? value : "";
}

/** Sõnade loend kirjest, mis võib olla sõne või `{ title }`. Tühjad jäävad välja. */
export function listItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.description || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

/** Kalendripäev `2026-10-15` → `15.10.2026`. */
export function plainDayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/** ISO hetk → `15.10.2026` inimese enda ajavööndis. Vigane väärtus annab tühja sõne. */
export function dayOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/* ---------- Loend -------------------------------------------------------------- */

/** Käimas olevad ees, kõrvale pandud (paus, lõpetatud, arhiveeritud) omaette. Serveri järjekord jääb. */
export function boardGroups(journeys) {
  const rows = Array.isArray(journeys) ? journeys.filter((journey) => journey?.id) : [];
  return {
    active: rows.filter((journey) => journey.status !== "ARCHIVED"),
    earlier: rows.filter((journey) => journey.status === "ARCHIVED")
  };
}

/**
 * Milline rühm on ees. Inimese valik kehtib, kuni selles rühmas midagi on;
 * tühja rühma ei näidata (viimase käimasoleva arhiveerimisel jääks muidu ette
 * tühi loend). Valikulahtrid on olemas ainult siis, kui mõlemas rühmas on midagi.
 */
export function boardShown(groups, wanted = "active") {
  const hasActive = groups.active.length > 0;
  const hasEarlier = groups.earlier.length > 0;
  let shown = wanted === "earlier" ? "earlier" : "active";
  if (shown === "active" && !hasActive && hasEarlier) shown = "earlier";
  if (shown === "earlier" && !hasEarlier) shown = "active";
  return { shown, choice: hasActive && hasEarlier, empty: !hasActive && !hasEarlier };
}

/**
 * Seis ühe sõnaga. Kõrvale pandud Teekond ütleb, kas see on paus või lõpetamine;
 * loendi nupust arhiveeritul liiki ei ole. Käimasoleval Teekonnal märki ei ole:
 * sõna, mis seisab igal real, ei ütle midagi.
 */
export function journeyStateKey(journey) {
  const status = String(journey?.status || "ACTIVE").toUpperCase();
  const kind = String(journey?.closure?.kind || "").toUpperCase();
  if (status === "ARCHIVED") {
    if (kind === "PAUSED" || kind === "FINISHED") return `journey.closure.status.${kind}`;
    return "journey.status.ARCHIVED";
  }
  if (status === "DRAFT") return "journey.status.DRAFT";
  return "";
}

/**
 * Loendi rida: pealkiri, selle all üks rida (kirjelduse algus; pausil oleval
 * Teekonnal päev, millal inimene plaanis jätkata), seisu märk ja viimase
 * muutmise päev. Arhiveerida saab ainult käimasolevat.
 */
export function journeyRow(journey, { t }) {
  const stateKey = journeyStateKey(journey);
  const paused = journey?.status === "ARCHIVED" && journey?.closure?.kind === "PAUSED";
  const resumeDay = paused ? plainDayLabel(journey.closure.resumeOn) : "";
  const title = text(journey?.title).trim();
  let sub = text(journey?.summary).replace(/\s+/g, " ").trim();
  /* Pealkirjata loodud Teekonna pealkiri on kirjelduse algus: sama teksti kaks
     korda üksteise all ei näidata. */
  if (title && sub.toLocaleLowerCase("et").startsWith(title.replace(/\s+/g, " ").toLocaleLowerCase("et"))) sub = "";
  if (resumeDay) {
    sub = t("journey.closure.resume_line", { date: resumeDay });
    if (journey.closure.resumeDue) sub = `${sub} ${t("journey.closure.resume_due")}`;
  }
  return {
    id: journey.id,
    title: title || t("journey.title"),
    sub,
    chip: stateKey ? t(stateKey) : "",
    /* Jätkamise päev on käes: märk on rõhutatud, mitte ainult teise sõnaga. */
    attention: Boolean(resumeDay && journey.closure.resumeDue),
    day: dayOf(journey?.updatedAt),
    updatedAt: journey?.updatedAt || null,
    canArchive: journey?.status !== "ARCHIVED"
  };
}

/** Loendi alla: lause ainult siis, kui server ütleb, et Teekondi on rohkem, kui on laaditud. */
export function boardMore(page, loaded) {
  const total = Number(page?.totalCount) || 0;
  return page?.hasMore && page?.nextCursor ? { cursor: page.nextCursor, loaded, total: Math.max(total, loaded) } : null;
}

/* ---------- Alustamine --------------------------------------------------------- */

export const EMPTY_DRAFT = Object.freeze({
  title: "",
  summary: "",
  primaryPath: "UNKNOWN",
  domains: [],
  missingInfo: [],
  riskSignals: [],
  suggestedActions: [],
  context: {}
});

export function draftWish(draft) {
  return text(draft?.context?.personWish);
}

/** Soov läheb mustandi konteksti; tühi soov võtab välja (võtit tühja sõnega ei saadeta). */
export function withWish(draft, value) {
  const context = { ...(draft?.context || {}) };
  if (text(value)) context.personWish = value;
  else delete context.personWish;
  return { ...draft, context };
}

/** Ülevaade on olemas, kui server on selle kirjelduse põhjal koostanud. */
export function draftReady(draft) {
  return Boolean(text(draft?.summary).trim());
}

/**
 * Kas ülevaade tuleb (uuesti) koostada: seda ei ole või kirjeldus on pärast
 * koostamist muutunud. `builtFor` on kirjeldus, mille kohta ülevaade koostati.
 */
export function draftStale({ situation, draft, builtFor }) {
  if (!draftReady(draft)) return true;
  return text(situation) !== text(builtFor);
}

/**
 * Uus ülevaade serverist. Inimese enda kirjutatu jääb alles: soov (seda ei
 * puuduta platvorm kunagi) ja pealkiri, kui ta selle ise ära muutis. Kõik muu
 * (teemad, tähelepanekud, võimalikud sammud) tuleb uue kirjelduse põhjalt.
 */
export function mergeBuiltDraft({ previous, built, clientActionId, titleEdited = false }) {
  const next = { ...EMPTY_DRAFT, ...(built || {}), clientActionId };
  if (titleEdited && text(previous?.title).trim()) next.title = previous.title;
  return withWish(next, draftWish(previous));
}

/**
 * Sammude seis kiirmenüü ja vaate „Kõik sammud" jaoks. Kirjeldus on tehtud, kui
 * midagi on kirjas; soov on vabatahtlik; ülevaate vaated on valmis, kui server
 * on ülevaate koostanud.
 */
export function startStepStates({ situation, draft, builtFor }) {
  const described = Boolean(text(situation).trim());
  const fresh = !draftStale({ situation, draft, builtFor });
  return {
    describe: described ? "done" : "empty",
    wish: draftWish(draft).trim() ? "done" : "empty",
    overview: fresh ? (text(draft?.title).trim() ? "done" : "partial") : "empty",
    ahead: fresh ? "done" : "empty",
    save: "empty"
  };
}

/** Kas inimesel on kirjutatut, mis lahkudes kaoks: kirjeldus, soov või koostatud ülevaade. */
export function startDirty({ situation, draft }) {
  return Boolean(text(situation).trim() || draftWish(draft).trim() || draftReady(draft));
}

/** Aadressi märge sammu järgi: esimene samm on kirjeldamine, kõik järgmised ülevaade. */
export function startUrlStep(stepKey) {
  return stepKey === "describe" ? START_URL_STEPS.describe : START_URL_STEPS.review;
}

/**
 * Pooleli jäänud töö taastamine selle vahekaardi mälust.
 *
 * `saved` on rida kujul `{ mode, step, situation, draft, builtFor }`. Vana lehe
 * real ei ole sammu ega `builtFor`-i: seal oli ülevaates kokkuvõte omaette
 * muudetav väli, seega on ülevaate režiimis salvestatud real värskem tekst
 * kokkuvõte, kirjeldamise režiimis kirjeldus. `urlStep` on aadressi märge:
 * ilma selleta taastub ainult tekst (leht avaneb loendis nagu enne).
 */
export function restoreStart(saved, urlStep = "") {
  const row = saved && typeof saved === "object" ? saved : null;
  const draft = row?.draft && typeof row.draft === "object" && !Array.isArray(row.draft) ? { ...EMPTY_DRAFT, ...row.draft } : null;
  let situation = text(row?.situation);
  let builtFor = text(row?.builtFor);
  if (draft && !Object.hasOwn(row, "builtFor")) {
    if (row.mode === "review" && draftReady(draft)) situation = draft.summary;
    builtFor = row.mode === "review" ? situation : "";
  }
  const wantsFlow = urlStep === START_URL_STEPS.describe || urlStep === START_URL_STEPS.review;
  let stepKey = "describe";
  if (urlStep === START_URL_STEPS.review && draft && !draftStale({ situation, draft, builtFor })) {
    stepKey = START_STEPS.includes(row?.step) && row.step !== "describe" ? row.step : "overview";
  }
  return {
    situation,
    draft,
    builtFor,
    mode: wantsFlow ? "start" : "list",
    stepKey,
    restored: Boolean(wantsFlow && row && (situation.trim() || draft))
  };
}

/** Mälurea kuju. `mode` on vana lehe väli: nii loeb rea ka enne uuendust avatud vahekaart. */
export function startStorageRow({ stepKey, situation, draft, builtFor }) {
  return { mode: stepKey === "describe" ? "start" : "review", step: stepKey, situation, draft, builtFor };
}

/**
 * Ülevaate vaate sisu: teemad ja eluvaldkonnad sõnadena ning ettevaatlikud
 * tähelepanekud. Kui server eluvaldkondi ei andnud, on vaikimisi neli esimest
 * (sama mis vanal lehel).
 */
export const DEFAULT_LIFE_DOMAINS = Object.freeze([
  "suhtlemine",
  "vaimne tervis",
  "füüsiline tervis",
  "elukeskkond",
  "hõivatus",
  "vaba aeg ja huvitegevus",
  "igapäevaelu toimingud",
  "võrgustik ja kõrvalabi",
  "kriis ja turvalisus"
]);

export function draftNoticed(draft) {
  const lifeDomains = listItems(draft?.context?.lifeDomains);
  return {
    domains: listItems(draft?.domains),
    lifeDomains: lifeDomains.length ? lifeDomains : DEFAULT_LIFE_DOMAINS.slice(0, 4),
    risks: listItems(draft?.riskSignals),
    missing: listItems(draft?.missingInfo),
    actions: listItems(draft?.suggestedActions)
  };
}

/**
 * Mis takistab salvestamist. Pealkiri on kohustuslik (vanal lehel nõudis seda
 * brauseri vormikontroll); kirjeldus on olemas, kui ülevaade on koostatud.
 * Tagastab `{ key, step }`: kataloogi võti ja samm, kus puuduv väli on.
 */
export function saveProblem(draft) {
  if (!draftReady(draft)) return { key: "journey.start.need_situation", step: "describe" };
  if (!text(draft?.title).trim()) return { key: "journey.start.need_title", step: "overview" };
  return null;
}

/** Pärast loomist avatava Teekonna tee; `startWith` avab selle valitud osa juures. */
export function createdJourneyPath(journeyId, startWith = "") {
  const start = startWith ? `?alusta=${encodeURIComponent(startWith)}` : "";
  return `/teekond/${encodeURIComponent(journeyId)}${start}`;
}

/** Loendur ilmub alles siis, kui väli hakkab täis saama (viimane viiendik). */
export function counterNear(value, limit) {
  const length = text(value).length;
  return length >= limit * 0.8 ? { current: length, limit } : null;
}

/* ---------- Teised rollid ------------------------------------------------------ */

/**
 * Spetsialist ja teenuseosutaja ei näe kellegi Teekonda. Leht ütleb seda ja
 * pakub neli teed sinna, kus kinnitatud info nendeni jõuab. Read on võtmetena,
 * et vaade ei peaks rolli järgi hargnema.
 */
export function roleWorkspace(role) {
  const provider = String(role || "").toUpperCase() === "SERVICE_PROVIDER";
  const base = provider ? "journey.workspace.provider" : "journey.workspace.specialist";
  return {
    lead: [`${base}.description`, `${base}.sharedInfoOnly`],
    title: `${base}.title`,
    actions: [
      {
        key: "inquiries",
        href: "/eelpoordumised",
        title: provider ? `${base}.serviceInquiries` : `${base}.preInquiries`,
        description: provider ? `${base}.serviceInquiriesDescription` : `${base}.preInquiriesDescription`
      },
      { key: "rooms", href: "/vestlus?rooms=1", title: "journey.workspace.client.relatedRooms", description: "journey.workspace.privateJourneysNotShared" },
      provider
        ? { key: "profile", href: "/teenuseprofiil", title: `${base}.serviceProfile`, description: `${base}.serviceProfileDescription` }
        : { key: "documents", href: "/documents", title: "chat.workspace.cards.document_drafting.title", description: `${base}.documentsDescription` }
    ]
  };
}
