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
 * serv on juba hõivatud: vestlus (composer), lõuendid (kovisioon,
 * teemaseemned, registreerimine, hinnastus), admini juhtimiskeskus ja
 * laiad tööpinnad (teenusekaart). Nemad hoiavad oma nurga-risti.
 *
 * Loendid elavad SIIN, mitte PanelFrame'is, sest neid loevad kaks
 * komponenti (PanelFrame otsustab risti + polstri, RoomStage doki enda).
 * Kaks koopiat oleks kaks tõde ja üks neist läheks vaikselt valeks.
 */

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

export function isCanvasRoute(normalized) {
  return CANVAS_ROUTES.includes(normalized);
}

export function isWideRoute(normalized) {
  return WIDE_ROUTES.includes(normalized);
}

/**
 * Kas sellel marsruudil avatud aken kannab dokki?
 * Ootab NORMALISEERITUD teed (ilma keeleprefiksi ja päringuta).
 */
export function panelHasRoomDock(normalized) {
  const path = String(normalized || "/");
  if (isCanvasRoute(path) || isWideRoute(path)) return false;
  if (path.startsWith("/admin")) return false;
  /* Vestlus ja teekond juhivad ise kogu sisenemist ja hoiavad alumist
     serva composeri jaoks. */
  if (path.startsWith("/vestlus") || path.startsWith("/teekond")) return false;
  return true;
}
