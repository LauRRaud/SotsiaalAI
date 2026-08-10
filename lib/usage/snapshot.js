import { prisma } from "../prisma.js";
import { getUserStorageUsageBytes } from "../storageUsage.js";
import { getRolePlanKey } from "../subscriptionPlans.js";
import { isSponsoredBillingSource, sponsorKindFromBillingSource } from "../subscriptionView.js";
import { getUsagePeriodRange } from "./periods.js";

const DEFAULT_TIME_ZONE = "Europe/Tallinn";
const PAID_PLAN_KEYS = new Set([
  "client_monthly",
  "social_worker_monthly",
  "service_provider_monthly"
]);

function toBigInt(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function dateIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function activePlanWhere(key, now) {
  return {
    key,
    active: true,
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
  };
}

function fallbackPlanKey(user, subscription) {
  if (user.isAdmin || user.role === "ADMIN") return "admin_internal";
  const storedKey = String(subscription?.plan || "").trim().toLowerCase();
  if (storedKey === "free" || subscription?.status === "NONE") return "free";
  if (PAID_PLAN_KEYS.has(storedKey)) return storedKey;
  return subscription?.status === "ACTIVE" ? getRolePlanKey(user.role) : "free";
}

function effectiveEntitlements(plan, overrides) {
  const baseByMetric = new Map(
    (plan?.entitlements || []).map((item) => [item.metric, item])
  );
  const overrideByMetric = new Map();
  for (const item of overrides || []) {
    if (!overrideByMetric.has(item.metric)) overrideByMetric.set(item.metric, item);
  }

  const metrics = new Set([...baseByMetric.keys(), ...overrideByMetric.keys()]);
  return [...metrics].map((metric) => {
    const base = baseByMetric.get(metric);
    const override = overrideByMetric.get(metric);
    return {
      metric,
      enabled: override?.enabled ?? base?.enabled ?? false,
      softLimit: override?.softLimit ?? base?.softLimit ?? null,
      hardLimit: override?.hardLimit ?? base?.hardLimit ?? null,
      period: override?.period ?? base?.period ?? null,
      overridden: Boolean(override)
    };
  }).filter((item) => item.enabled && item.period && item.hardLimit != null);
}

function usageState(consumed, hardLimit) {
  if (hardLimit <= 0n || consumed >= hardLimit) return "blocked";
  const basisPoints = Number((consumed * 10_000n) / hardLimit);
  if (basisPoints >= 9000) return "warning";
  if (basisPoints >= 7000) return "notice";
  return "normal";
}

function findBucket(buckets, metric, range) {
  const start = range.start.getTime();
  const end = range.end.getTime();
  return buckets.find((bucket) =>
    bucket.metric === metric &&
    new Date(bucket.periodStart).getTime() === start &&
    new Date(bucket.periodEnd).getTime() === end
  );
}

function shapeMetric(entitlement, buckets, storageBytes, now, timeZone) {
  const range = getUsagePeriodRange(entitlement.period, now, timeZone);
  const bucket = findBucket(buckets, entitlement.metric, range);
  const used = entitlement.metric === "STORAGE_BYTES"
    ? toBigInt(storageBytes)
    : toBigInt(bucket?.used);
  const reserved = entitlement.metric === "STORAGE_BYTES" ? 0n : toBigInt(bucket?.reserved);
  const hardLimit = toBigInt(entitlement.hardLimit);
  const softLimit = entitlement.softLimit == null ? null : toBigInt(entitlement.softLimit);
  const consumed = used + reserved;
  const remaining = hardLimit > consumed ? hardLimit - consumed : 0n;
  const percentage = hardLimit > 0n
    ? Math.min(100, Math.round(Number((consumed * 1000n) / hardLimit) / 10))
    : 100;

  return {
    metric: entitlement.metric,
    period: entitlement.period,
    used: used.toString(),
    reserved: reserved.toString(),
    consumed: consumed.toString(),
    softLimit: softLimit?.toString() ?? null,
    hardLimit: hardLimit.toString(),
    remaining: remaining.toString(),
    percentage,
    state: usageState(consumed, hardLimit),
    resetAt: entitlement.period === "LIFETIME" ? null : range.end.toISOString(),
    overridden: entitlement.overridden
  };
}

export function createUsageSnapshotService({
  prismaClient = prisma,
  storageUsageResolver = getUserStorageUsageBytes,
  timeZone = DEFAULT_TIME_ZONE
} = {}) {
  return {
    async getUserSnapshot(userId, options = {}) {
      const normalizedUserId = String(userId || "").trim();
      if (!normalizedUserId) throw new TypeError("userId is required");
      const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

      const [user, activeSubscription, latestSubscription, overrides, buckets, storage] = await Promise.all([
        prismaClient.user.findUnique({
          where: { id: normalizedUserId },
          select: { id: true, role: true, isAdmin: true }
        }),
        prismaClient.subscription.findFirst({
          where: {
            userId: normalizedUserId,
            status: "ACTIVE",
            OR: [{ validUntil: null }, { validUntil: { gt: now } }]
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: { planDefinition: { include: { entitlements: true } } }
        }),
        prismaClient.subscription.findFirst({
          where: { userId: normalizedUserId },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: { planDefinition: { include: { entitlements: true } } }
        }),
        prismaClient.userEntitlementOverride.findMany({
          where: {
            userId: normalizedUserId,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }]
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }]
        }),
        prismaClient.usageBucket.findMany({
          where: {
            userId: normalizedUserId,
            periodStart: { lte: now },
            periodEnd: { gt: now }
          }
        }),
        storageUsageResolver(normalizedUserId)
      ]);

      if (!user) {
        const error = new Error("User was not found");
        error.code = "USAGE_USER_NOT_FOUND";
        throw error;
      }

      const subscription = activeSubscription || latestSubscription;
      const planKey = fallbackPlanKey(user, activeSubscription || latestSubscription);
      let plan = user.isAdmin || user.role === "ADMIN"
        ? null
        : subscription?.planDefinition || null;

      if (!plan || plan.key !== planKey) {
        plan = await prismaClient.planDefinition.findFirst({
          where: activePlanWhere(planKey, now),
          orderBy: { version: "desc" },
          include: { entitlements: true }
        });
      }

      const entitlements = effectiveEntitlements(plan, overrides);
      const storageBytes = storage?.totalBytes ?? 0;
      const metrics = entitlements
        .map((item) => shapeMetric(item, buckets, storageBytes, now, timeZone))
        .sort((a, b) => a.metric.localeCompare(b.metric));

      return {
        generatedAt: now.toISOString(),
        plan: plan ? {
          id: plan.id,
          key: plan.key,
          name: plan.name,
          price: String(plan.price),
          currency: plan.currency,
          version: plan.version
        } : {
          id: null,
          key: planKey,
          name: planKey,
          price: "0.00",
          currency: "EUR",
          version: null
        },
        subscription: {
          status: activeSubscription?.status || latestSubscription?.status || "NONE",
          billingSource: activeSubscription?.billingSource || latestSubscription?.billingSource || "SELF",
          /* SOL-ORG-07: „kas keegi teine maksab" on SERVERI otsus, mitte
             kliendi sõnevõrdlus. Organisatsiooni sponsorlus lisandus hiljem ja
             just selline võrdlus jäi liideses uuendamata. */
          isSponsored: isSponsoredBillingSource(
            activeSubscription?.billingSource || latestSubscription?.billingSource
          ),
          sponsorKind: sponsorKindFromBillingSource(
            activeSubscription?.billingSource || latestSubscription?.billingSource
          ),
          validUntil: dateIso(activeSubscription?.validUntil || latestSubscription?.validUntil),
          nextBilling: dateIso(activeSubscription?.nextBilling || latestSubscription?.nextBilling),
          // Expired = there is no active subscription but the latest one has lapsed.
          // This is distinct from never-subscribed (free/NONE), so the profile can
          // show an honest "subscription expired" state instead of a silent fallback.
          expired: Boolean(
            !activeSubscription &&
              latestSubscription?.validUntil &&
              latestSubscription.validUntil <= now
          ),
          expiredAt:
            !activeSubscription &&
            latestSubscription?.validUntil &&
            latestSubscription.validUntil <= now
              ? dateIso(latestSubscription.validUntil)
              : null
        },
        metrics
      };
    }
  };
}

export const usageSnapshotService = createUsageSnapshotService();
