/**
 * Kas ruumi menüü (karussell, laud või Töölaua toavaade) tohib praegu
 * klaviatuurile, rullikule ja žestidele vastata.
 *
 * Ei tohi, kui menüü on lukus (inert), ruum lahkub, ees on aken (sisselogimine,
 * kaardileht, ligipääsetavus, info), avatud on paneel või ülemine juhtpaneel on
 * lahti või hiire all.
 *
 * `pointer: false` = sisend ei tule hiirest ega sõrmest (kaamera käežestid):
 * siis ei loe ülariba hover ega fookus (omanik 28.09: „menüüs ei tahtnud need
 * töötada"). Avatud ülariba lukustab endiselt.
 */
export function isRoomInteractive(root, { pointer = true } = {}) {
  if (!root) return false;
  const wrap = root.closest(".room-carousel-wrap");
  if (!wrap || wrap.inert) return false;
  const room = root.closest(".room");
  if (!room) return false;
  if (room.dataset.departing === "1" || room.dataset.loginOpen === "1" || room.dataset.cardPage === "1") return false;
  // Ükski lahtiolev modal (ligipääsetavus, kontakt/paigalda) ei tohi
  // lasta rullikul/nooltel tagust karusselli pöörata (tellija 07.07).
  if (room.dataset.a11yOpen === "1" || room.dataset.infoOpen === "1") return false;
  if (document.documentElement.getAttribute("data-room-mode") === "panel") return false;
  /* Juhtpaneel elab ruumi ja main-kihi vahel eraldi kihis, et see oleks
     kasutatav ka töövaadetes. Seetõttu otsime seda dokumendist, mitte
     enam ainult .room elemendi seest. */
  const topbar = document.querySelector(".room-topbar");
  if (
    topbar &&
    (topbar.dataset.open === "1" ||
      (pointer && (topbar.matches?.(":hover") || topbar.matches?.(":focus-within"))))
  ) {
    return false;
  }
  return true;
}
