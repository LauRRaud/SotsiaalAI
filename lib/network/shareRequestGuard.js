import { createHash } from "node:crypto";

import { consumeLoginThrottle } from "@/lib/auth/loginThrottle";
import { getTrustedRequestIpFromRequest } from "@/lib/request-ip";
import { findNetworkShareMutationReplay } from "@/lib/network/shareLifecycle";

const positive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
};

export const networkShareGuardSettings = () => ({
  readLimit: positive(process.env.NETWORK_SHARE_READ_RATE_LIMIT, 120),
  mutationLimit: positive(process.env.NETWORK_SHARE_MUTATION_RATE_LIMIT, 30),
  windowMs: positive(process.env.NETWORK_SHARE_RATE_WINDOW_MS, 60_000),
  lockMs: positive(process.env.NETWORK_SHARE_RATE_LOCK_MS, 60_000)
});

const subject = (value) => createHash("sha256").update(String(value || "")).digest("hex");

export function readNetworkShareMutationKey(request) {
  const value = String(request?.headers?.get?.("idempotency-key") || "").trim();
  return /^[A-Za-z0-9._:-]{8,120}$/u.test(value) ? value : null;
}

/** Klastriülene kasutaja- JA usaldatud-IP-piir, eraldi iga tegevuse kohta. */
export async function guardShareRequest({
  db,
  request,
  userId,
  actionCode,
  mutation = false,
  resourceId = null
}) {
  const settings = networkShareGuardSettings();
  const limit = mutation ? settings.mutationLimit : settings.readLimit;
  const scope = `network-share:${String(actionCode || "unknown").toLowerCase()}`;
  const userResult = await consumeLoginThrottle({
    db,
    scope: `${scope}:user`,
    subject: subject(userId),
    limit,
    windowMs: settings.windowMs,
    lockMs: settings.lockMs
  });
  if (!userResult.allowed) return { ok: false, status: 429, message: "api.common.rate_limited", ...userResult };

  const trustedIp = getTrustedRequestIpFromRequest(request);
  if (trustedIp) {
    const ipResult = await consumeLoginThrottle({
      db,
      scope: `${scope}:ip`,
      subject: subject(trustedIp),
      limit,
      windowMs: settings.windowMs,
      lockMs: settings.lockMs
    });
    if (!ipResult.allowed) return { ok: false, status: 429, message: "api.common.rate_limited", ...ipResult };
  }

  if (!mutation) return { ok: true, mutationKey: null, replayedShare: null };
  const mutationKey = readNetworkShareMutationKey(request);
  if (!mutationKey) return { ok: false, status: 428, message: "network_share.idempotency_key_required" };
  const replayedShare = await findNetworkShareMutationReplay({ db, actorUserId: userId, actionCode, mutationKey });
  if (replayedShare && resourceId && replayedShare.id !== resourceId) {
    return { ok: false, status: 409, message: "network_share.concurrent_change" };
  }
  return { ok: true, mutationKey, replayedShare };
}
