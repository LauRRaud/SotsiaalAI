export function resolveApiMessage({
  payload,
  t,
  fallbackKey,
  fallbackText = ""
}) {
  const key = typeof payload?.messageKey === "string" ? payload.messageKey.trim() : "";
  if (key) {
    const translated = typeof t === "function" ? t(key) : "";
    if (typeof translated === "string" && translated.trim() && translated !== key) {
      return translated;
    }
    if (typeof payload?.message === "string" && payload.message.trim() && payload.message !== key) {
      return payload.message;
    }
    if (typeof t === "function" && fallbackKey) {
      return t(fallbackKey);
    }
    return fallbackText || key;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof t === "function" && fallbackKey) {
    return t(fallbackKey);
  }
  return fallbackText || fallbackKey || "";
}
