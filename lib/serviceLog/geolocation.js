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

/**
 * 20 s, mitte 8. Ajatempel on JUBA kirjas, kui seda oodatakse — ootamine ei
 * blokeeri töötajat. Külm GPS vajab esimese täpse mõõtmiseni sageli 10–15 s ja
 * liiga lühike aken sunnib platvormi andma jämeda võrgupõhise vastuse.
 */
export const LOCATION_TIMEOUT_MS = 20000;

/**
 * NULL, MITTE 30 SEKUNDIT.
 *
 * Omanik mõõtis 02.08 päris seadmes: viibis Tabasalus, meie leht ütles Kopli;
 * teine leht andis samal hetkel õige koha. Põhjus oli siin. `maximumAge`
 * lubab brauseril vastata VAHEMÄLUST — ja vahemälus võib olla varasem JÄME
 * määrang (Wi-Fi/IP), mille mõni muu leht või brauser ise tegi. Vana jäme
 * punkt tuleb tagasi silmapilkselt ja näeb välja täpselt nagu värske mõõtmine.
 *
 * Teenusesündmuse tõend peab tähendama „mõõdetud PRAEGU". Null sunnib päris
 * mõõtmise; hind on paar sekundit ootamist, mis ei blokeeri kedagi.
 */
export const LOCATION_MAX_AGE_MS = 0;

/**
 * TÄPSUSE LÄVI. Alla selle on punkt kohalolu tõend; üle selle ütleb ta ainult
 * „kuskil selles linnaosas".
 *
 * Punkt ±2 km täpsusega EI OLE vale — ta on aus mõõtmine jämeda meetodiga.
 * Vale oleks teda esitada kohalolu tõendina. Seepärast ei visata teda ära, vaid
 * MÄRGISTATAKSE: kasutaja näeb täpsust ja teab, mida ta salvestas.
 */
export const LOCATION_TRUSTED_ACCURACY_M = 100;

/**
 * Ilmselgelt kasutu mõõtmine. IP-põhine määrang annab kümneid kilomeetreid ja
 * tema salvestamine tekitaks andmebaasi ridu, mis näevad välja nagu asukoht,
 * aga ei ütle mitte midagi.
 */
export const LOCATION_MAX_USEFUL_ACCURACY_M = 5000;

/**
 * MIKS PUNKTI EI TULNUD. Ilma selleta ütles leht kõigil juhtudel ühe ja sama
 * lause — „Asukohta ei saadud" — ja kasutaja ei saanud teada, kas ta peaks
 * midagi ette võtma. Keeldunud luba on parandatav ühe klikiga seadetes;
 * aegumine tähendab „proovi õue"; toetuseta brauser ei tähenda mitte midagi,
 * mida kasutaja saaks teha.
 *
 * Koodid tulevad `GeolocationPositionError`-ist: 1 = luba puudub,
 * 2 = positsioon kättesaamatu, 3 = aegumine.
 */
export const LOCATION_REASON = {
  UNSUPPORTED: "unsupported",
  DENIED: "denied",
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
  TOO_COARSE: "too_coarse"
};

export function reasonFromError(error) {
  switch (Number(error?.code)) {
    case 1:
      return LOCATION_REASON.DENIED;
    case 2:
      return LOCATION_REASON.UNAVAILABLE;
    case 3:
      return LOCATION_REASON.TIMEOUT;
    default:
      return LOCATION_REASON.UNAVAILABLE;
  }
}

export function isTrustedAccuracy(acc) {
  return Number.isFinite(acc) && acc >= 0 && acc <= LOCATION_TRUSTED_ACCURACY_M;
}

/**
 * @returns `{lat, lng, acc, at, trusted}` või `null`. EI VISKA — kutsuja ei pea
 *   proovima/püüdma ja unustatud `catch` ei saa siin ajatemplit ära kaotada.
 */
export function captureLocationPoint(
  navigatorRef = typeof navigator === "undefined" ? null : navigator,
  { onReason } = {}
) {
  const geolocation = navigatorRef?.geolocation;
  const report = (reason) => {
    /* Põhjus on TEAVITUS, mitte tulemus: tema töötlemise viga ei tohi punkti
       ega ajatemplit ära kaotada. */
    try {
      onReason?.(reason);
    } catch {}
  };

  if (!geolocation?.getCurrentPosition) {
    report(LOCATION_REASON.UNSUPPORTED);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value, reason) => {
      if (settled) return;
      settled = true;
      if (!value) report(reason || LOCATION_REASON.UNAVAILABLE);
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
          /* Kasutu täpsus ei jõua kirjele: rida, mis näeb välja nagu asukoht,
             aga tähendab „kuskil maakonnas", on halvem kui puuduv rida. */
          if (Number.isFinite(acc) && acc > LOCATION_MAX_USEFUL_ACCURACY_M) {
            finish(null, LOCATION_REASON.TOO_COARSE);
            return;
          }
          finish({
            lat,
            lng,
            ...(Number.isFinite(acc) && acc >= 0 ? { acc: Math.round(acc) } : {}),
            at: new Date().toISOString(),
            /* Täpsus käib punktiga KAASA otsusena, mitte numbrina, mida keegi
               peaks ise tõlgendama. */
            trusted: isTrustedAccuracy(acc)
          });
        },
        (error) => finish(null, reasonFromError(error)),
        {
          enableHighAccuracy: true,
          timeout: LOCATION_TIMEOUT_MS,
          maximumAge: LOCATION_MAX_AGE_MS
        }
      );
    } catch {
      finish(null, LOCATION_REASON.UNAVAILABLE);
    }

    /* OMA TAIMER brauseri `timeout`-i kõrvale: mõni brauser ei kutsu
       vigade-callback'i, kui luba on „küsi iga kord" ja kasutaja jätab dialoogi
       lihtsalt lahti. Ilma selle taimerita jääks salvestusnupp igaveseks
       ootama midagi, mida ei tule. */
    setTimeout(() => finish(null, LOCATION_REASON.TIMEOUT), LOCATION_TIMEOUT_MS + 500);
  });
}

/**
 * LOA SEIS — kolm väärtust, mida brauser meile ütleb, ja üks, mida ei ütle.
 *
 * MIKS SEE ON OLEMAS. Omanik mõõtis 02.08 päris seadmes ja sõnastas probleemi
 * täpselt: „kuidas siis teha nii, et luba on esiteks peal (kas on
 * sotsiaaltöötajaid, kes oskavad luba panna? ei usu)". Ilma loata ei tulnud
 * midagi ja ekraan ütles ainult „ei saadud" — kasutaja ei saanud teada, et
 * asi on loas ega seda, et selle saab ise ära parandada.
 *
 * MIDA ME EI SAA: luba ise anda. Ühtegi veebi-API-t selleks ei ole ja see on
 * meelega nii. Küpsisebänneri kombel „nõustu" ei aita — luba annab brauser,
 * mitte leht.
 *
 * MIDA ME SAAME:
 *   1. seisu LUGEDA (`navigator.permissions`),
 *   2. küsimuse KÄIVITADA — brauser näitab dialoogi ainult siis, kui leht
 *      `getCurrentPosition`-it kutsub, ja usaldusväärselt ainult kasutaja
 *      vajutuse peale,
 *   3. keeldumise korral ÖELDA, kust ta tagasi lülitada.
 *
 * `UNKNOWN` ei ole viga: Safari ei toeta `permissions.query`-t geolocation'i
 * kohta. Siis läheme edasi nii, nagu seis oleks `PROMPT` — küsimine on ohutu.
 */
export const PERMISSION_STATE = Object.freeze({
  GRANTED: "granted",
  PROMPT: "prompt",
  DENIED: "denied",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown"
});

export async function readPermissionState(
  navigatorRef = typeof navigator === "undefined" ? null : navigator
) {
  if (!navigatorRef?.geolocation?.getCurrentPosition) return PERMISSION_STATE.UNSUPPORTED;
  const permissions = navigatorRef.permissions;
  if (!permissions?.query) return PERMISSION_STATE.UNKNOWN;
  try {
    const status = await permissions.query({ name: "geolocation" });
    const state = String(status?.state || "");
    return state === PERMISSION_STATE.GRANTED ||
      state === PERMISSION_STATE.DENIED ||
      state === PERMISSION_STATE.PROMPT
      ? state
      : PERMISSION_STATE.UNKNOWN;
  } catch {
    /* Mõni brauser viskab tundmatu nime peale. Teadmatus ei ole keeld. */
    return PERMISSION_STATE.UNKNOWN;
  }
}

/**
 * MILLISED JUHISED NÄIDATA, kui luba on maas. Brauseri seadete tee erineb
 * seadmeti ja „ava seaded" ilma teeta on sama hea kui vaikimine.
 *
 * Tuvastus on user-agent'i põhine ja seega ebatäpne — aga siin on eksimise hind
 * väike (vale juhis, mille kõrval on ka teised) ja vaikimise hind suur.
 */
export function guessPlatformHint(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}
