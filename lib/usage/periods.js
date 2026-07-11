const FORMATTERS = new Map();
const LIFETIME_END = new Date("9999-12-31T23:59:59.999Z");

function formatterFor(timeZone) {
  if (!FORMATTERS.has(timeZone)) {
    FORMATTERS.set(timeZone, new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }));
  }
  return FORMATTERS.get(timeZone);
}

function zonedParts(date, timeZone) {
  const values = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)])
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

export function localDateTimeToUtc(parts, timeZone = "Europe/Tallinn") {
  const target = {
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    ...parts
  };
  let candidate = utcValue(target);

  for (let pass = 0; pass < 4; pass += 1) {
    const observed = zonedParts(new Date(candidate), timeZone);
    const delta = utcValue(target) - utcValue(observed);
    if (delta === 0) break;
    candidate += delta;
  }

  return new Date(candidate);
}

function moveLocalDate(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

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
