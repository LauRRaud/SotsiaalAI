/**
 * TÖÖHEAOLU — MÄRGID, MIS JÄÄVAD AINULT TÖÖTAJALE.
 *
 * Kirje märgid liiguvad tavaliselt kolme kohta peale töötaja enda vaate:
 * anonüümsesse koondisse (`aggregate.js`), jagatavasse mustandisse
 * (`supportDraftText.js`) ja Ülevaate juhimemosse (`overview.js`). Siin
 * loetletud märk ei lähe ühtegi neist.
 *
 * `risk.colleague_mistreatment` (kolleegi või juhi ebaväärikas kohtlemine):
 * juhimemos oleks ta kiri võimalikule osapoolele ja kovisiooni sisendis
 * grupile. Osakonna koondis osutaks ta väikeses meeskonnas ühele inimesele ja
 * võiks paljastada ka teataja. Koondisse saab teda lubada alles siis, kui on
 * olemas KOV-i või valdkonna tasandi koond (tööheaolu arendusettepanek, ptk 8.2).
 */

export const WELLBEING_PRIVATE_ONLY_MARKERS = new Set(["risk.colleague_mistreatment"]);

export function withoutPrivateOnlyMarkers(values) {
  return (Array.isArray(values) ? values : []).filter((value) => !WELLBEING_PRIVATE_ONLY_MARKERS.has(value));
}
