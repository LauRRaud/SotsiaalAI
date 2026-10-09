/**
 * Abisoovide ja abipakkumiste loendi read ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Loendi otsused (milline rida on minu oma, millal on rühmadel
 * pealkiri, millal tohib öelda kuulutuste arvu) elasid paneeli JSX-is ja neid
 * ei saanud testida. Siin on puhtad funktsioonid; paneel
 * (`./HelpListingsPanel.jsx`) ainult joonistab. Andmed ja päringud on paneeli
 * kasutajal (`components/alalehed/ChatBody.jsx`, `ProfiilBody.jsx`).
 */

/**
 * Kas loend on abisoovide või abipakkumiste oma. Ridadel on liik kaasas; tühja
 * loendi puhul ütleb seda paneeli võti (`help_offers`) või pealkiri.
 */
export function listingKind({ items = [], infoId = "", title = "", ui = {} } = {}) {
  const first = String(items[0]?.kind || "").trim().toLowerCase();
  if (first === "offer" || first === "request") return first;
  if (String(infoId || "").includes("offer")) return "offer";
  return title && title === ui.helpOffers ? "offer" : "request";
}

/** Loendi rida: pealkiri, märksõnade kokkuvõte ja märgid (minu kuulutus, seis). */
export function listingRows(items, ui = {}) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    key: `${item.kind}-${item.id}`,
    title: String(item.title || ""),
    summary: String(item.summary || ""),
    own: Boolean(item.isOwn),
    chips: [
      ...(item.isOwn ? [{ key: "own", text: ui.ownListing, tone: "own" }] : []),
      ...(item.statusLabel ? [{ key: "status", text: String(item.statusLabel), tone: "quiet" }] : [])
    ],
    item
  }));
}

/**
 * Read rühmadena: minu kuulutused enne, teiste omad pärast. Rühmal on pealkiri
 * ainult siis, kui mõlemad rühmad on olemas: muidu ütleb minu kuulutuse märk
 * real sama asja ja pealkiri ainult kordaks lehe nime.
 */
export function listingGroups(rows, { kind = "request", ui = {}, othersLabel = "" } = {}) {
  const own = rows.filter((row) => row.own);
  const others = rows.filter((row) => !row.own);
  const both = own.length > 0 && others.length > 0;
  return [
    { key: "own", label: both ? (kind === "offer" ? ui.myHelpOffers : ui.myHelpRequests) : "", rows: own },
    { key: "others", label: both ? othersLabel : "", rows: others }
  ].filter((group) => group.rows.length);
}

/**
 * Kuulutuste arv lausena. Arv öeldakse ainult siis, kui terve loend on laaditud:
 * kuni „Lae juurde" on alles, oleks laaditud ridade arv vale koguarv.
 */
export function listingCountText(count, { ui = {}, complete = true } = {}) {
  const total = Number(count) || 0;
  if (!complete || total < 1) return "";
  return `${total} ${total === 1 ? ui.listingSingular : ui.listingPlural}`;
}
