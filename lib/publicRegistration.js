/* Avaliku registreerimise ÜKS tõeallikas (T10 E3).
   Teadlik launch-lukk: väärtus on kõvakodeeritud, MITTE env-ist loetav —
   deploy-keskkonna muutuja ei saa seisu kogemata muuta. Muutmine = üks
   muudatus siin failis; server (app/api/register/route.js),
   registreerimisleht, LoginModal ja hinnastuse CTA-d loevad kõik sama
   konstanti. AVATUD 22.07.2026 omaniku otsusega (maksevoo päris-test +
   eelseisvad piloodid); SULETUD tagasi 27.07.2026 — maksevoo päris-test sai
   tehtud ja läbitud, avalik registreerimine ootab uut omaniku otsust. */
export const REGISTRATION_OPEN = false;
