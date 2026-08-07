/* Ajavööndi-teisendus elab `lib/time/estonianDay.js`-is — ÜKS teostus, mitte
   moodulipõhine koopia. Vöönd jääb siin parameetriks, vaikeväärtus on Eesti. */
import { localDateTimeToUtc, shiftLocalDate as moveLocalDate, zonedParts } from "@/lib/time/estonianDay";

export { localDateTimeToUtc };

const LIFETIME_END = new Date("9999-12-31T23:59:59.999Z");

export function getUsagePeriodRange(period, at = new Date(), timeZone = "Europe/Tallinn") {
  const now = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(now.getTime())) throw new TypeError("Invalid usage period date");

  if (period === "LIFETIME") {
    return { start: new Date(0), end: LIFETIME_END };
  }

  const local = zonedParts(now, timeZone);
  let startParts;
  let endParts;

  if (period === "DAILY") {
    startParts = moveLocalDate(local, 0);
    endParts = moveLocalDate(local, 1);
  } else if (period === "WEEKLY") {
    const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    startParts = moveLocalDate(local, -daysSinceMonday);
    endParts = moveLocalDate(startParts, 7);
  } else if (period === "MONTHLY") {
    startParts = { year: local.year, month: local.month, day: 1 };
    endParts = local.month === 12
      ? { year: local.year + 1, month: 1, day: 1 }
      : { year: local.year, month: local.month + 1, day: 1 };
  } else {
    throw new TypeError(`Unsupported usage period: ${period}`);
  }

  return {
    start: localDateTimeToUtc(startParts, timeZone),
    end: localDateTimeToUtc(endParts, timeZone)
  };
}
