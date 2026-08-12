import { consumeRateLimit } from "@/lib/rate-limit";

export const ORG_CREATION_RATE_LIMIT = 10;
export const ORG_CREATION_RATE_WINDOW_MS = 60 * 60 * 1000;

export function consumeOrganizationCreationLimit(
  { userId, trustedIp },
  { consume = consumeRateLimit } = {}
) {
  const userLimit = consume(
    `org:create:user:${userId}`,
    ORG_CREATION_RATE_LIMIT,
    ORG_CREATION_RATE_WINDOW_MS
  );
  if (!userLimit.allowed) return userLimit;
  if (!trustedIp) return userLimit;
  return consume(
    `org:create:ip:${trustedIp}`,
    ORG_CREATION_RATE_LIMIT * 2,
    ORG_CREATION_RATE_WINDOW_MS
  );
}
