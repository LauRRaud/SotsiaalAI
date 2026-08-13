const LICENCE_LOCALES = Object.freeze({ et: "et-EE", en: "en-GB", ru: "ru-RU" });

export function formatLicenceRetryAfter(value, locale = "et") {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LICENCE_LOCALES[locale] || LICENCE_LOCALES.et, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Tallinn"
  }).format(date);
}

export function formatLicenceVerifiedDate(value, locale = "et") {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LICENCE_LOCALES[locale] || LICENCE_LOCALES.et, {
    dateStyle: "long",
    timeZone: "Europe/Tallinn"
  }).format(date);
}
