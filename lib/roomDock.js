/**
 * Millised avatud aknad kannavad ruumi DOKKI (alumine kiirmenüü).
 *
 * Omanik 26.07: väljapääs ei tohi igal pinnal eri kohas olla. Tavaline
 * aken (kaardileht, profiili sektsioon, lugemisleht) jätab doki ekraanile
 * — seal on tagasi-nool ja õdede otseteed, nii et kaardilt kaardile ei
 * pea karusselli kaudu tagasi ronima. Dokiga akendel nurga-× EI OLE:
 * kaks väljapääsu ühel aknal on halvem kui üks.
 *
 * Välja jäävad pinnad, mis ekraani ise täis võtavad ja mille alumine
 * serv on juba hõivatud: Vestlus ise (composer), lõuendid (kovisioon,
 * teemaseemned, registreerimine, hinnastus) ja laiad tööpinnad
 * (teenusekaart). `/vestlus?workspace=…` ei ole Vestlus, vaid Töölaua
 * sisuleht, ning kannab seetõttu dokki nagu teised tööpinnad.
 *
 * 01.08: ADMIN EI OLE ENAM SIIN NIMEKIRJAS — vt panelHasRoomDock.
 *
 * Loendid elavad SIIN, mitte PanelFrame'is, sest neid loevad kaks
 * komponenti (PanelFrame otsustab risti + polstri, RoomStage doki enda).
 * Kaks koopiat oleks kaks tõde ja üks neist läheks vaikselt valeks.
 */

/* Töölaua MENÜÜD: kaardikomplektid, mida näitab ruumi karussell. Nendel teedel
   paneeli ei ole (leht ise on ainult ekraanilugeja marker). Kõik muu Töölaua
   all on SISULEHT ja saab tavalise paneeli ning doki: Juhtumitöö laud ja
   kiireloomuline vastuvõtt joonistati varem ilma kestata otse ruumipildile,
   sest raam pidas menüüks iga teed, mis algab „/toolaud/" (kujundusaudit K01).
   RoomStage kasutab samu kolme teed (isWorkspaceRoute); test hoiab need koos. */
export const WORKSPACE_HUB_ROUTES = ["/toolaud", "/toolaud/tooheaolu", "/toolaud/kovisioon"];

export function isWorkspaceHubRoute(normalized) {
  return WORKSPACE_HUB_ROUTES.includes(String(normalized || "/"));
}

/* Täisekraani lõuend: paneel on täpselt ekraani suurune ja paddinguta. */
export const CANVAS_ROUTES = [
  "/kovisioon",
  "/teemaseemned",
  "/registreerimine",
  "/hinnastus",
];

/* Suured tööpinnad: aken venib ekraani servani. */
export const WIDE_ROUTES = [
  "/teenusekaart",
  "/lopetatud-juhtumid",
  "/parimad-praktikad",
];

/* Lõuendid, mille OMA dokk kannab tagasi-noolt. Nemad ei saa ruumi dokki
   (alumine serv on oma ribaga hõivatud), aga nurga-risti nad ka ei taha:
   väljapääs on kiirmenüüs, ühes ja samas kohas nagu mujal (omanik 26.07).
   Kovisiooni EI ole siin — tal on oma nimeline „← Välju" nupp, mis ei ole
   dokk ja mida PanelFrame juba eraldi renderdab. */
export const SELF_EXIT_ROUTES = ["/hinnastus"];

export function isCanvasRoute(normalized) {
  return CANVAS_ROUTES.includes(normalized);
}

/**
 * Kas see leht kannab väljapääsu ise (ja nurga-risti seega ei renderdata)?
 */
export function panelHasOwnExit(normalized) {
  return SELF_EXIT_ROUTES.includes(String(normalized || "/"));
}

export function isWideRoute(normalized) {
  return WIDE_ROUTES.includes(normalized);
}

/**
 * Kas sellel marsruudil avatud aken kannab dokki?
 * Ootab NORMALISEERITUD teed (ilma keeleprefiksi ja päringuta).
 */
export function panelHasRoomDock(normalized, { workspace = "" } = {}) {
  const path = String(normalized || "/");
  if (isCanvasRoute(path) || isWideRoute(path)) return false;
  /* ADMIN SAI DOKI (omanik 01.08: „sulge nuppu lehtedel enam ei kasuta ja
     all on kiirpaneel"). Varem oli admin siit väljas põhjendusega, et ta
     „võtab ekraani ise täis ja alumine serv on hõivatud" — analüütika ja
     RAG admin on tegelikult keritavad sisulehed, mille alumine serv on
     vaba. Poolik reegel oleks halvim variant: kui analüütikal on dokk ja
     RAG adminil nurga-rist, on väljapääs kahel naaberpinnal eri kohas —
     täpselt see, mille vastu see fail kirjutati. Doki komplekt on juba
     olemas (RoomStage adminItems). */
  /* Vestlus ja teekond juhivad ise kogu sisenemist ja hoiavad alumist
     serva composeri jaoks. Töölaua sisulehel composerit ei ole: päringu
     `workspace` väärtus eristab teda päris Vestlusest. */
  if (path.startsWith("/teekond")) return false;
  if (path.startsWith("/vestlus")) return Boolean(String(workspace || "").trim());
  return true;
}

/**
 * Teed, mille kaardilt dokk lehe nime võtab, selles järjekorras, nagu neid
 * proovitakse (esimene, millel on kaart, annab nime ja ikooni).
 *
 * MIKS. Dokk leidis nime ainult täpse tee järgi. Alamteel (külastuse vaade
 * `/valitoo/<id>`, `/supervisioon/uus`, mentori profiil) ja sama lehe teise
 * päringuga (`/juhtumid?juhtum=<id>`) jäi dokki ainult tagasi-nool. Leht ise
 * pealkirja ei kanna (nimi on dokis), nii et inimene ei näinud kusagilt, mis
 * leht lahti on. Alamtee kannab nüüd oma vanema nime: külastus on Välitöö osa.
 *
 *  1. täpne tee koos päringuga (profiili sektsioonid erinevad ainult päringu poolest)
 *  2. tee, mille kaart avab teise tee (`aliases`, nt /eelpoordumised)
 *  3. sama tee ilma päringuta
 *  4. tee esimene osa (`/valitoo/<id>` -> `/valitoo`) ja selle alias
 *     (`/documents/<id>` -> `/documents` -> kaart „Dokumendid")
 */
export function dockLabelRoutes(normalized, search = "", aliases = {}) {
  const path = String(normalized || "/");
  const query = String(search || "").replace(/^\?/, "");
  const routes = [query ? `${path}?${query}` : path];
  if (aliases?.[path]) routes.push(aliases[path]);
  if (query) routes.push(path);
  const first = path.split("/").filter(Boolean)[0];
  if (first && `/${first}` !== path) {
    routes.push(`/${first}`);
    if (aliases?.[`/${first}`]) routes.push(aliases[`/${first}`]);
  }
  return [...new Set(routes)];
}
