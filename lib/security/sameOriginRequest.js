export function isSameOriginRequest(request) {
  const origin = request?.headers?.get?.("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
