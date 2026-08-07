/**
 * EESTI KALENDRIPÄEV — üks teostus, mitu kutsujat.
 *
 * MIKS OMA MOODUL. Sama arvutus oli platvormil juba kahes kohas
 * (`lib/usage/periods.js` kvoodiperioodidel, `lib/mtr/assessment.js` loa
 * kehtivusel) ja JTA-V1 E1 kirjutas kolmanda — VALESTI. Vale kuju oli:
 *
 *     const utcMidnight   = new Date(`${isoDay}T00:00:00Z`);
 *     const offsetMs      = utcMidnight - new Date(`${isoDay}T00:00:00`);
 *     const start         = new Date(utcMidnight - offsetMs);
 *     const end           = new Date(start + 24 * 60 * 60 * 1000);
 *
 * Kaks viga korraga, ja MÕLEMAD on nähtamatud masinal, mille ajavöönd on
 * juhtumisi `Europe/Tallinn`:
 *
 *   1. `new Date("...T00:00:00")` ILMA `Z`-ta parsitakse SERVERI lokaalses
 *      ajavööndis. Mõõdetud nihe on seega serveri oma, mitte Tallinna oma.
 *      UTC-serveris tuleb `offsetMs = 0` ja „Eesti päev" on tegelikult
 *      UTC-päev — suvel 3 tundi nihkes. Tagajärg on mõõdetav: kell 00:00–03:00
 *      Eesti aja järgi toimuvad kontaktid kaovad tänasest ja järgmise päeva
 *      varahommik satub nende asemele.
 *
 *   2. `+ 24 h` eeldab, et kalendripäev on 24 tundi pikk. Eestis on ta
 *      29.03.2026 **23** tundi ja 25.10.2026 **25** tundi.
 *
 * SIIN EI OLE ÜHTEGI SERVERI-LOKAALSET PARSINGUT ega ühtegi `Date`
 * getter'it, mis loeks masina vööndit. Kalendriväljad loetakse `Intl`-iga
 * SIHTVÖÖNDIS ja pannakse tagasi kokku `Date.UTC`-ga; päeva lõpp on JÄRGMISE
 * KALENDRIPÄEVA kesköö, mitte algus pluss kestus.
 */

export const ESTONIA_TIME_ZONE = "Europe/Tallinn";

const FORMATTERS = new Map();

function formatterFor(timeZone) {
  if (!FORMATTERS.has(timeZone)) {
    FORMATTERS.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        /* `h23`, mitte vaikeväärtus: `h24` annaks keskööl tunniks „24" ja
           `Date.UTC` liigutaks päeva vaikselt edasi. */
        hourCycle: "h23"
      })
    );
  }
  return FORMATTERS.get(timeZone);
}

/** Hetke kalendriväljad SIHTVÖÖNDIS. */
export function zonedParts(date, timeZone = ESTONIA_TIME_ZONE) {
  const values = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function utcValue(parts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    parts.millisecond || 0
  );
}

/**
 * Kohalik seinakell → UTC-hetk.
 *
 * ITEREERIB, sest nihke leidmiseks on vaja hetke ja hetke leidmiseks nihet.
 * Esimene arvamus on „nagu oleks UTC", edasi parandatakse seda mõõdetud
 * vahega. DST-üleminekul läheb vaja teist ringi; neli on lagi, mitte norm.
 */
export function localDateTimeToUtc(parts, timeZone = ESTONIA_TIME_ZONE) {
  const target = { hour: 0, minute: 0, second: 0, millisecond: 0, ...parts };
  let candidate = utcValue(target);

  for (let pass = 0; pass < 4; pass += 1) {
    const observed = zonedParts(new Date(candidate), timeZone);
    const delta = utcValue(target) - utcValue(observed);
    if (delta === 0) break;
    candidate += delta;
  }

  return new Date(candidate);
}

/** Kalendripäev ± n päeva. `Date.UTC` normaliseerib kuu- ja aastapiiri. */
export function shiftLocalDate(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function isoDayOf({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Eesti kalendripäeva piirid: `[start, end)`.
 *
 * `start` on selle päeva kesköö, `end` JÄRGMISE KALENDRIPÄEVA kesköö. Vahe
 * nende vahel on 23, 24 või 25 tundi ja see ei ole viga — see on kalender.
 *
 * @param {Date|string|number} [now] hetk, mille päeva küsitakse
 * @returns {{ isoDay: string, start: Date, end: Date }}
 */
export function estonianDayBounds(now = new Date(), timeZone = ESTONIA_TIME_ZONE) {
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) throw new TypeError("estonianDayBounds: invalid date");

  const local = zonedParts(at, timeZone);
  const today = { year: local.year, month: local.month, day: local.day };

  return {
    isoDay: isoDayOf(today),
    start: localDateTimeToUtc(today, timeZone),
    end: localDateTimeToUtc(shiftLocalDate(today, 1), timeZone)
  };
}
