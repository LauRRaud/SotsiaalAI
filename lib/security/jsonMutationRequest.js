function configuredOrigins() {
  return [process.env.NEXTAUTH_URL, process.env.AUTH_URL, process.env.APP_URL]
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}

export function validateJsonMutationRequest(request) {
  const fetchSite = String(request?.headers?.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return false;

  const contentType = String(request?.headers?.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") return false;

  const origin = request?.headers?.get("origin");
  if (!origin) return false;

  try {
    const allowedOrigins = new Set([new URL(request.url).origin, ...configuredOrigins()]);
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
