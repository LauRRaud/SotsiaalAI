/**
 * TÖÖHEAOLU KOOND — LUBATUD PERIOODID (SOL-WB-06).
 *
 * MIS OLI. Vaataja sai `periodStart` ja `periodEnd` vabalt valida. Künnis
 * kaitses ainult ÜHE päringu eest: kui valim oli piisav, tulid välja täpsed
 * täisarvud. Kaks peaaegu identset päringut — üks ajapiir ühe inimese võrra
 * nihkes — annavad LAHUTAMISEL täpselt selle inimese signaalid ja
 * riskimarkerid. Kumbki päring eraldi ei riku künnist; rikub nende VAHE.
 *
 * MIS SIIN ON. Periood ei ole enam vabalt valitav vahemik, vaid **valik
 * fikseeritud võrgust**: terve kalendrikuu, kvartal või aasta (Eesti kalendri
 * järgi, mitte serveri vööndi järgi — vt `estonianDay.js`), või „kõik".
 * Kahte lubatud perioodi, mis erinevad ühe inimese võrra, ei ole olemas: nad
 * erinevad alati terve kuu, kvartali või aasta võrra. Vabalt nihutatav piir oli
 * kogu rünnaku eeldus ja ta on ära võetud.
 *
 * MIDA SEE EI LAHENDA. Kaks eri suurusega perioodi (kuu vs kvartal) on endiselt
 * sisestikud ja piisavalt kannatlik vaataja saab neid võrrelda. Selle vastu
 * aitavad päringueelarve või privaatsust säilitav müra — need on eraldi töö ja
 * eeldavad omaniku otsust, sest mõlemad muudavad numbrid ebatäpseks või
 * piiravad kasutust. Vt raporti KATMATA-lõiku.
 */

import { localDateTimeToUtc, zonedParts, ESTONIA_TIME_ZONE } from "../time/estonianDay.js";

export const WELLBEING_PERIOD_KINDS = Object.freeze(["all", "month", "quarter", "year"]);

function monthStart(year, month) {
  return localDateTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, ESTONIA_TIME_ZONE);
}

/* Lõpp on JÄRGMISE perioodi algus (poolavatud vahemik `[start, end)`), mitte
   „algus + kestus": kuud on eri pikkusega ja kellakeeramise päev ei ole 24 h. */
function addMonths(year, month, count) {
  const zeroBased = (month - 1) + count;
  return { year: year + Math.floor(zeroBased / 12), month: (zeroBased % 12 + 12) % 12 + 1 };
}

function periodError(message, details) {
  const error = new Error(message);
  error.status = 400;
  if (details) error.details = details;
  return error;
}

/**
 * Perioodivalik → poolavatud vahemik.
 *
 * @param {{ periodKind?: string, periodYear?: number|string, periodIndex?: number|string }} selection
 * @returns `{ periodKind, periodStart, periodEnd, label }`
 */
export function resolveWellbeingPeriod(selection = {}) {
  const kind = String(selection.periodKind || "all").trim().toLowerCase();
  if (!WELLBEING_PERIOD_KINDS.includes(kind)) {
    throw periodError("wellbeing.pilot.period_invalid", { allowed: [...WELLBEING_PERIOD_KINDS] });
  }
  if (kind === "all") {
    return { periodKind: "all", periodStart: null, periodEnd: null, label: "kõik" };
  }

  const year = Number(selection.periodYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw periodError("wellbeing.pilot.period_invalid", { field: "periodYear" });
  }

  if (kind === "year") {
    return {
      periodKind: "year",
      periodStart: monthStart(year, 1),
      periodEnd: monthStart(year + 1, 1),
      label: String(year)
    };
  }

  const index = Number(selection.periodIndex);
  const maxIndex = kind === "month" ? 12 : 4;
  if (!Number.isInteger(index) || index < 1 || index > maxIndex) {
    throw periodError("wellbeing.pilot.period_invalid", { field: "periodIndex", max: maxIndex });
  }

  const startMonth = kind === "month" ? index : (index - 1) * 3 + 1;
  const next = addMonths(year, startMonth, kind === "month" ? 1 : 3);
  return {
    periodKind: kind,
    periodStart: monthStart(year, startMonth),
    periodEnd: monthStart(next.year, next.month),
    label: kind === "month" ? `${year}-${String(index).padStart(2, "0")}` : `${year}-Q${index}`
  };
}

/**
 * Vabade kuupäevade tagasilükkamine.
 *
 * Vana klient saatis `periodStart`/`periodEnd` ISO-kuupäevadena. Neid EI
 * tõlgita vaikselt lähima lubatud perioodi peale — vaikne ümardamine tähendaks,
 * et vastus katab muud kui küsitud ja seda ei ütleks keegi. Vastus on 400 koos
 * lubatud valikute loendiga.
 */
export function assertNoFreeFormPeriod(filters = {}) {
  if (filters.periodStart || filters.periodEnd) {
    throw periodError("wellbeing.pilot.period_free_form_forbidden", {
      allowed: [...WELLBEING_PERIOD_KINDS]
    });
  }
}

/** Käesolev periood Eesti kalendri järgi — liidese vaikevalik. */
export function currentWellbeingPeriodSelection(now = new Date()) {
  const parts = zonedParts(now, ESTONIA_TIME_ZONE);
  return { periodKind: "month", periodYear: parts.year, periodIndex: parts.month };
}
