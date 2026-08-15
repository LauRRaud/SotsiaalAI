const PUBLIC_URL_ENV_KEYS = ["APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL"];

function httpOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export function resolvePublicOrigin(requestUrl) {
  for (const key of PUBLIC_URL_ENV_KEYS) {
    const origin = httpOrigin(process.env[key]);
    if (origin) return origin;
  }

  return httpOrigin(requestUrl) || "https://sotsiaal.ai";
}
