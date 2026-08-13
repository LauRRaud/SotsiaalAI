/**
 * Karusselli-marsruudi mälu paneeli sulgemiseks.
 *
 * Etapp 2 (omanik 21.07): TÖÖLAUD sai päris marsruudi (/toolaud). Enne seda
 * oli töölaud olekulüliti avalehel, nii et paneeli sulgemisrist sai alati
 * viia "/" peale ja kaardirivi püsis. Marsruudiga oleks "/" tähendanud, et
 * töölaualt avatud leht (nt /supervisioon) sulgub AVALEHE kaartidele ja
 * töölaud kaob käest.
 *
 * Seetõttu: RoomStage jätab meelde viimase KARUSSELLI-HUBI marsruudi ja
 * PanelFrame'i × naaseb sinna. Ainult hubid — kaardi-lehti (/ruum,
 * /uuenda-pin) siia EI kirjutata, muidu sulgeks × lehe iseendale.
 */

export const ROOM_HUB_RETURN_STORAGE_KEY = "sotsiaalai:room-hub-return";

/* Lubatud sihtkohad on lukus: sessionStorage'i väärtus tuleb brauserist ja
   seda ei tohi pimesi router.push'i sööta (avatud ümbersuunamine). */
const ROOM_HUB_ROUTES = [
  "/",
  "/toolaud",
  "/toolaud/tooheaolu",
  "/toolaud/kovisioon",
  "/profiil",
  "/admin",
];

export function rememberRoomHubPath(pathname) {
  if (typeof window === "undefined") return;
  if (!ROOM_HUB_ROUTES.includes(pathname)) return;
  try {
    window.sessionStorage.setItem(ROOM_HUB_RETURN_STORAGE_KEY, pathname);
  } catch {}
}

export function readRoomHubPath(fallback = "/") {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.sessionStorage.getItem(ROOM_HUB_RETURN_STORAGE_KEY);
    return ROOM_HUB_ROUTES.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}
