import { refreshTokenAuthorization } from "@/lib/auth/jwtAuthorization";

// Omaniku lubatud kolm tavarolli kontot: sol-proof-20261014-01.
// Ajutine erand lõpeb 16.10.2026 kell 03.00 Eesti aja järgi.
export const PRELAUNCH_TEST_ACCESS_EXPIRES_AT = "2026-10-16T00:00:00.000Z";
const TEST_ROLES = new Map([
  ["cmv7uufuo0000u3kmo9ausfgt", "CLIENT"],
  ["cmv7uufv50003u3kmxjmb35yj", "SOCIAL_WORKER"],
  ["cmv7uufvh0006u3kmo6mc5zrr", "SERVICE_PROVIDER"]
]);

export function isPrelaunchTestUser(user, now = new Date()) {
  return now.getTime() < Date.parse(PRELAUNCH_TEST_ACCESS_EXPIRES_AT) &&
    TEST_ROLES.get(String(user?.id || "")) === user?.role &&
    TEST_ROLES.has(String(user?.id || ""));
}

export async function authorizeCurrentPrelaunchToken(token, options) {
  if (!token?.id) return false;
  try {
    const { degraded } = await refreshTokenAuthorization(token, options);
    if (degraded) return false;
    if (token.isAdmin === true || token.role === "ADMIN") return true;
    return isPrelaunchTestUser(token, options.now || new Date());
  } catch {
    return false;
  }
}
