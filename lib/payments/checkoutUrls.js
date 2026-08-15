function httpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function configuredPublicUrl(canonicalUrl) {
  const configured = canonicalUrl
    || process.env.NEXTAUTH_URL
    || process.env.AUTH_URL
    || process.env.APP_URL;
  const direct = httpUrl(configured);
  if (direct) return direct;

  const vercelHost = String(process.env.VERCEL_URL || "").trim();
  return vercelHost ? httpUrl(`https://${vercelHost}`) : null;
}

/** Payment callback authority is configuration, never a request header. */
export function resolveCheckoutUrl(envValue, fallbackPath, options = {}) {
  const direct = httpUrl(envValue);
  if (direct) return direct.toString();

  const configured = configuredPublicUrl(options.canonicalUrl);
  if (configured) return new URL(fallbackPath, configured).toString();

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "development") {
    return new URL(fallbackPath, "http://localhost:3000").toString();
  }
  return "";
}
