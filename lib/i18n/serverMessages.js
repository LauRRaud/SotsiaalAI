import en from "../../messages/en.json" with { type: "json" };
import et from "../../messages/et.json" with { type: "json" };
import ru from "../../messages/ru.json" with { type: "json" };

const CATALOGS = {
  en,
  et,
  ru
};

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split(".");
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

export function normalizeServerLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("et")) return "et";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("en")) return "en";
  return "";
}

function formatServerMessage(template, values) {
  if (typeof template !== "string") return "";
  if (!values || typeof values !== "object") return template;
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

export function serverT(locale, key, values, fallback = "") {
  const normalized = normalizeServerLocale(locale) || "en";
  const primary = getByPath(CATALOGS[normalized], key);
  const english = getByPath(CATALOGS.en, key);
  const template =
    typeof primary === "string"
      ? primary
      : typeof english === "string"
        ? english
        : fallback || key;
  return formatServerMessage(template, values);
}
