/**
 * TEENUSPÄEVIK E2b — ÜHEKORDNE asukohapunkt (DoD 10).
 *
 * KOLM REEGLIT, MIS EI OLE LÄBIRÄÄGITAVAD:
 *
 * 1. `getCurrentPosition`, MITTE `watchPosition`. Vaatlus tähendaks pidevat
 *    asukohajada — täpselt seda, mille välistamine on kogu meie positsioneeringu
 *    alus. Kood, milles `watchPosition` esineb, rikub DoD punkti 10 juba
 *    olemasoluga, seega teda siin EI OLE ja test kontrollib seda.
 *
 * 2. TÕRGE EI BLOKEERI MITTE MIDAGI. Loa puudumine, väljalülitatud GPS,
 *    aegumine — kõik annavad `null` ja ajatempel läheb kirja nagu ikka. Töö
 *    tegemine ei tohi sõltuda sellest, kas satelliit paistis.
 *
 * 3. AJAPIIRANG ON LÜHIKE. Külastuse uksel seisev inimene ei oota GPS-i;
 *    kaheksa sekundit on pikem kui tema kannatus ja piisav linnas.
 *
 * TÄPSUS TULEB KAASA, sest ilma temata ei saa punkti hiljem tõlgendada:
 * ±10 m tähendab „oli ukse taga", ±2000 m tähendab „oli kuskil linnas".
 */

export const LOCATION_TIMEOUT_MS = 8000;

/**
 * Vanem punkt kui see EI KÕLBA: teenusesündmus on „praegu" ja vahemälust tulnud
 * eilne punkt oleks vale tõend.
 */
export const LOCATION_MAX_AGE_MS = 30_000;

/**
 * @returns `{lat, lng, acc, at}` või `null`. EI VISKA — kutsuja ei pea
 *   proovima/püüdma ja unustatud `catch` ei saa siin ajatemplit ära kaotada.
 */
export function captureLocationPoint(navigatorRef = typeof navigator === "undefined" ? null : navigator) {
  const geolocation = navigatorRef?.geolocation;
  if (!geolocation?.getCurrentPosition) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position?.coords?.latitude);
          const lng = Number(position?.coords?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            finish(null);
            return;
          }
          const acc = Number(position?.coords?.accuracy);
          finish({
            lat,
            lng,
            ...(Number.isFinite(acc) && acc >= 0 ? { acc: Math.round(acc) } : {}),
            at: new Date().toISOString()
          });
        },
        () => finish(null),
        {
          enableHighAccuracy: true,
          timeout: LOCATION_TIMEOUT_MS,
          maximumAge: LOCATION_MAX_AGE_MS
        }
      );
    } catch {
      finish(null);
    }

    /* OMA TAIMER brauseri `timeout`-i kõrvale: mõni brauser ei kutsu
       vigade-callback'i, kui luba on „küsi iga kord" ja kasutaja jätab dialoogi
       lihtsalt lahti. Ilma selle taimerita jääks salvestusnupp igaveseks
       ootama midagi, mida ei tule. */
    setTimeout(() => finish(null), LOCATION_TIMEOUT_MS + 500);
  });
}
