import { getRoleMonthlyAmount, getRoleUsageAllowanceMultiplier, normalizeSubscriptionRole } from "@/lib/subscriptionPlans";

function readLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function scaleLimit(baseLimit, multiplier) {
  return Math.max(baseLimit, Math.ceil(baseLimit * Math.max(1, Number(multiplier) || 1)));
}

export function getAnalyzeLimitDetails(role = "CLIENT", isAdmin = false) {
  const adminLimit = readLimit(process.env.ANALYZE_LIMIT_ADMIN, 100);
  const workerLimit = readLimit(process.env.ANALYZE_LIMIT_WORKER, 20);
  const clientLimit = readLimit(process.env.ANALYZE_LIMIT_CLIENT, 10);

  if (isAdmin || role === "ADMIN") {
    return {
      role: "ADMIN",
      baseLimit: adminLimit,
      limit: adminLimit,
      monthlyAmount: null,
      allowanceMultiplier: 1
    };
  }

  const normalizedRole = normalizeSubscriptionRole(role);
  const baseLimit = normalizedRole === "SOCIAL_WORKER" || normalizedRole === "SERVICE_PROVIDER"
    ? workerLimit
    : clientLimit;
  const monthlyAmount = getRoleMonthlyAmount(normalizedRole);
  const allowanceMultiplier = getRoleUsageAllowanceMultiplier(normalizedRole, {
    softening: Number(process.env.ANALYZE_LIMIT_PRICE_SOFTENING || 0.55),
    cap: Number(process.env.ANALYZE_LIMIT_PRICE_CAP || 1.75)
  });

  return {
    role: normalizedRole,
    baseLimit,
    limit: scaleLimit(baseLimit, allowanceMultiplier),
    monthlyAmount,
    allowanceMultiplier
  };
}

export function getAnalyzeLimit(role = "CLIENT", isAdmin = false) {
  return getAnalyzeLimitDetails(role, isAdmin).limit;
}
export function utcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}
export function secondsUntilUtcMidnight(date = new Date()) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
  return Math.max(1, Math.floor((next.getTime() - date.getTime()) / 1000));
}
