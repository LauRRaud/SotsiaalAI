function pickFirst(raw) {
  if (!raw) return "";
  return String(raw).split(",")[0]?.trim() || "";
}

export function getRequestIp(headers) {
  if (!headers || typeof headers.get !== "function") return "unknown";
  return (
    pickFirst(headers.get("x-real-ip")) ||
    pickFirst(headers.get("x-forwarded-for")) ||
    pickFirst(headers.get("cf-connecting-ip")) ||
    pickFirst(headers.get("true-client-ip")) ||
    "unknown"
  );
}

export function getRequestIpFromRequest(request) {
  return getRequestIp(request?.headers);
}
