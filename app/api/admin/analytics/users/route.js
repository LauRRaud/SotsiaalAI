import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import {
  DangerousActionError,
  executeBulkUserDeletion,
  executeBulkEmail,
  previewBulkUserDeletion,
  previewBulkEmail
} from "@/lib/admin/dangerousAnalyticsActions";
import { createMetricBasis } from "@/lib/admin/analyticsMetrics";
import { projectAdminEmail } from "@/lib/admin/emailProjection";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import {
  MONTHLY_COST_BUDGET_EUR_PER_USER,
  COST_CHAT_REQUEST_EUR,
  COST_RAG_SEARCH_EUR,
  COST_STT_PER_MINUTE_EUR,
  COST_TTS_PER_MINUTE_EUR,
  estimateUsageCostEur,
  getMonthlyCostBudgetForRole
} from "@/lib/usageBudget";
import { getUsagePeriodRange } from "@/lib/usage/periods";
import { getRoleMonthlyAmount, PLAN_DEFINITION_IDS } from "@/lib/subscriptionPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 180;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;

  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));

  return fromHeader || "en";
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      ...extras
    },
    status
  );
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function buildUsageSeed() {
  return {
    chatRequests: 0,
    ragSearches: 0,
    noContext: 0,
    sttRequests: 0,
    sttAudioBytes: 0,
    sttMinutes: 0,
    ttsRequests: 0,
    ttsChars: 0,
    ttsMinutes: 0,
    analyses: 0
  };
}

function toActiveSubscription(subscription, now = new Date()) {
  if (!subscription) return false;
  if (String(subscription.status || "").toUpperCase() !== "ACTIVE") return false;
  if (!subscription.validUntil) return true;
  return new Date(subscription.validUntil).getTime() > now.getTime();
}

export async function GET(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const now = new Date();
    const url = new URL(req.url);
    const params = url.searchParams;

    const limitRaw = Number(params.get("limit"));
    const offsetRaw = Number(params.get("offset"));
    const daysRaw = Number(params.get("days"));
    const q = String(params.get("q") || "").trim();

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT));
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const periodDays = Math.min(MAX_PERIOD_DAYS, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : DEFAULT_PERIOD_DAYS));
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const todayRange = getUsagePeriodRange("DAILY", now, "Europe/Tallinn");

    const userWhere = q
      ? {
          OR: [{ email: { contains: q, mode: "insensitive" } }, { id: { contains: q, mode: "insensitive" } }]
        }
      : {};

    const [totalUsers, users] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.user.findMany({
        where: userWhere,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          isAdmin: true,
          createdAt: true
        }
      })
    ]);

    if (!users.length) {
      return json({
        ok: true,
        periodDays,
        basis: createMetricBasis({
          source: "User, ChatLog, UsageEvent, UsageBucket, Subscription and Payment",
          window: `${periodDays}d`,
          computedAt: now,
          degraded: true,
          degradationReason: "chatlog_metrics_without_retention_contract"
        }),
        totalUsers,
        items: [],
        totals: {
          estimatedCostEur: 0,
          paidAmountEur: 0,
          budgetCapacityEur: 0,
          nearLimitUsersCount: 0
        },
        costModel: {
          chatRequestEur: COST_CHAT_REQUEST_EUR,
          ragSearchEur: COST_RAG_SEARCH_EUR,
          sttPerMinuteEur: COST_STT_PER_MINUTE_EUR,
          ttsPerMinuteEur: COST_TTS_PER_MINUTE_EUR,
          monthlyBudgetEur: round2(MONTHLY_COST_BUDGET_EUR_PER_USER),
          monthlyBudgetClientEur: round2(getMonthlyCostBudgetForRole("CLIENT", false)),
          monthlyBudgetWorkerEur: round2(getMonthlyCostBudgetForRole("SOCIAL_WORKER", false)),
          currency: "EUR"
        }
      });
    }

    const userIds = users.map(user => user.id);

    const [
      usageEventRows,
      usageAmountRows,
      analyzePeriodRows,
      analyzeTodayRows,
      currentAnalyzeBuckets,
      analyzeOverrides,
      subscriptions,
      paidByUser
    ] = await Promise.all([
      prisma.chatLog.groupBy({
        by: ["userId", "event"],
        where: {
          userId: { in: userIds },
          createdAt: { gte: since },
          event: {
            in: ["chat_request", "rag_search", "no_context", "stt_request", "tts_request"]
          }
        },
        _count: { _all: true }
      }),
      prisma.chatLog.findMany({
        where: {
          userId: { in: userIds },
          createdAt: { gte: since },
          event: { in: ["stt_request", "tts_request"] }
        },
        select: {
          userId: true,
          event: true,
          data: true
        }
      }),
      prisma.usageEvent.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          metric: "FILE_ANALYZE",
          type: "COMMITTED",
          createdAt: { gte: since }
        },
        _sum: { amount: true }
      }),
      prisma.usageEvent.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          metric: "FILE_ANALYZE",
          type: "COMMITTED",
          createdAt: { gte: todayRange.start, lt: todayRange.end }
        },
        _sum: { amount: true }
      }),
      prisma.usageBucket.findMany({
        where: {
          userId: { in: userIds },
          metric: "FILE_ANALYZE",
          periodStart: { lte: now },
          periodEnd: { gt: now }
        },
        select: {
          userId: true,
          period: true,
          hardLimit: true,
          used: true,
          reserved: true,
          periodEnd: true
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.userEntitlementOverride.findMany({
        where: {
          userId: { in: userIds },
          metric: "FILE_ANALYZE",
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }]
        },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        select: {
          userId: true,
          enabled: true,
          hardLimit: true,
          period: true
        }
      }),
      prisma.subscription.findMany({
        where: { userId: { in: userIds } },
        orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          userId: true,
          status: true,
          plan: true,
          planDefinitionId: true,
          planDefinition: {
            select: {
              key: true,
              price: true
            }
          },
          validUntil: true,
          nextBilling: true,
          canceledAt: true,
          createdAt: true
        }
      }),
      prisma.payment.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: "PAID",
          paidAt: { gte: since }
        },
        _sum: { amount: true }
      })
    ]);

    const usageByUser = Object.fromEntries(userIds.map(userId => [userId, buildUsageSeed()]));

    for (const row of usageEventRows) {
      const userId = row?.userId;
      const event = String(row?.event || "");
      const count = Number(row?._count?._all || 0);
      if (!userId || !usageByUser[userId]) continue;

      if (event === "chat_request") usageByUser[userId].chatRequests = count;
      if (event === "rag_search") usageByUser[userId].ragSearches = count;
      if (event === "no_context") usageByUser[userId].noContext = count;
      if (event === "stt_request") usageByUser[userId].sttRequests = count;
      if (event === "tts_request") usageByUser[userId].ttsRequests = count;
    }

    for (const row of usageAmountRows) {
      const userId = row?.userId;
      if (!userId || !usageByUser[userId]) continue;

      if (row.event === "stt_request") {
        const size = Number(row?.data?.fileSizeBytes || 0);
        if (Number.isFinite(size) && size > 0) usageByUser[userId].sttAudioBytes += size;
        const durationSecondsValue = row?.data?.durationSeconds ?? row?.data?.duration_seconds ?? 0;
        const durationSeconds = Number(durationSecondsValue);
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
          usageByUser[userId].sttMinutes += durationSeconds / 60;
        }
      }

      if (row.event === "tts_request") {
        const chars = Number(row?.data?.textLength || 0);
        if (Number.isFinite(chars) && chars > 0) usageByUser[userId].ttsChars += chars;
        const durationSecondsValue = row?.data?.durationSeconds ?? row?.data?.duration_seconds ?? 0;
        const durationSeconds = Number(durationSecondsValue);
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
          usageByUser[userId].ttsMinutes += durationSeconds / 60;
        }
      }
    }

    const analyzeUsageByUser = Object.fromEntries(
      userIds.map(userId => [
        userId,
        {
          totalInPeriod: 0,
          today: 0
        }
      ])
    );

    for (const row of analyzePeriodRows) {
      const userId = row?.userId;
      if (!userId || !analyzeUsageByUser[userId]) continue;
      analyzeUsageByUser[userId].totalInPeriod = Number(row?._sum?.amount || 0n);
    }

    for (const row of analyzeTodayRows) {
      const userId = row?.userId;
      if (!userId || !analyzeUsageByUser[userId]) continue;
      analyzeUsageByUser[userId].today = Number(row?._sum?.amount || 0n);
    }

    const currentAnalyzeBucketByUser = {};
    for (const row of currentAnalyzeBuckets) {
      if (row?.userId && !currentAnalyzeBucketByUser[row.userId]) {
        currentAnalyzeBucketByUser[row.userId] = row;
      }
    }
    const analyzeOverrideByUser = {};
    for (const row of analyzeOverrides) {
      if (row?.userId && !analyzeOverrideByUser[row.userId]) {
        analyzeOverrideByUser[row.userId] = row;
      }
    }

    const latestSubscriptionByUser = {};
    for (const row of subscriptions) {
      if (!row?.userId) continue;
      if (!latestSubscriptionByUser[row.userId]) latestSubscriptionByUser[row.userId] = row;
    }

    const planDefinitionIds = Array.from(new Set([
      ...subscriptions.map(row => row.planDefinitionId).filter(Boolean),
      PLAN_DEFINITION_IDS.admin_internal
    ]));
    const analyzePlanEntitlements = await prisma.planEntitlement.findMany({
      where: {
        planDefinitionId: { in: planDefinitionIds },
        metric: "FILE_ANALYZE"
      },
      select: {
        planDefinitionId: true,
        enabled: true,
        hardLimit: true,
        period: true
      }
    });
    const analyzePlanEntitlementByPlanId = Object.fromEntries(
      analyzePlanEntitlements.map(row => [row.planDefinitionId, row])
    );

    const paidByUserMap = {};
    for (const row of paidByUser) {
      if (!row?.userId) continue;
      paidByUserMap[row.userId] = Number(row?._sum?.amount || 0);
    }

    let totalEstimatedCost = 0;
    let totalPaidAmount = 0;
    let totalBudgetCapacity = 0;
    let nearLimitUsersCount = 0;

    const items = users.map(user => {
      const usage = usageByUser[user.id] || buildUsageSeed();
      const analyzeUsage = analyzeUsageByUser[user.id] || { totalInPeriod: 0, today: 0 };
      const latestSubscription = latestSubscriptionByUser[user.id] || null;
      const analyzeBucket = currentAnalyzeBucketByUser[user.id] || null;
      const analyzeOverride = analyzeOverrideByUser[user.id] || null;
      const planDefinitionId = user.isAdmin
        ? PLAN_DEFINITION_IDS.admin_internal
        : latestSubscription?.planDefinitionId || null;
      const analyzePlanEntitlement = planDefinitionId
        ? analyzePlanEntitlementByPlanId[planDefinitionId] || null
        : null;
      const analyzeEnabled = analyzeOverride?.enabled ?? analyzePlanEntitlement?.enabled ?? false;
      const analyzeHardLimit = analyzeEnabled
        ? Number(analyzeBucket?.hardLimit ?? analyzeOverride?.hardLimit ?? analyzePlanEntitlement?.hardLimit ?? 0n)
        : 0;
      const analyzeUsed = Number(analyzeBucket?.used || 0n);
      const analyzeReserved = Number(analyzeBucket?.reserved || 0n);
      const analyzePeriod = analyzeBucket?.period || analyzeOverride?.period || analyzePlanEntitlement?.period || null;
      const analyzePeriodEnd = analyzeBucket?.periodEnd || null;

      const estimatedCosts = estimateUsageCostEur(usage);
      const chatCost = Number(estimatedCosts.chatEur || 0);
      const ragCost = Number(estimatedCosts.ragEur || 0);
      const sttCost = Number(estimatedCosts.sttEur || 0);
      const ttsCost = Number(estimatedCosts.ttsEur || 0);
      const totalCost = Number(estimatedCosts.totalEur || 0);
      const paidAmount = Number(paidByUserMap[user.id] || 0);
      const budget = Number(getMonthlyCostBudgetForRole(String(user.role || "CLIENT").toUpperCase(), !!user.isAdmin) || 0);
      const remainingBudget = Math.max(0, budget - totalCost);
      const utilizationPct = budget > 0 ? Math.min(100, (totalCost / budget) * 100) : 0;
      const analyzeUtilizationPct = analyzeHardLimit > 0
        ? Math.min(100, ((analyzeUsed + analyzeReserved) / analyzeHardLimit) * 100)
        : 0;
      const analyzeRemaining = Math.max(0, analyzeHardLimit - analyzeUsed - analyzeReserved);

      totalEstimatedCost += totalCost;
      totalPaidAmount += paidAmount;
      totalBudgetCapacity += budget;
      if (analyzeUtilizationPct >= 80 || utilizationPct >= 80) {
        nearLimitUsersCount += 1;
      }

      return {
        userId: user.id,
        email: projectAdminEmail(user.email),
        role: user.role,
        isAdmin: !!user.isAdmin,
        createdAt: user.createdAt,
        subscription: latestSubscription
          ? {
              id: latestSubscription.id,
              status: latestSubscription.status,
              plan: latestSubscription.plan,
              validUntil: latestSubscription.validUntil,
              nextBilling: latestSubscription.nextBilling,
              canceledAt: latestSubscription.canceledAt,
              createdAt: latestSubscription.createdAt,
              isActive: toActiveSubscription(latestSubscription, now)
            }
          : null,
        limits: {
          analyzePeriod,
          analyzePeriodEnd,
          analyzeHardLimit,
          analyzeUsed,
          analyzeReserved,
          analyzeRemaining,
          analyzeUtilizationPct: round2(analyzeUtilizationPct),
          planAmountEur: round2(
            latestSubscription?.planDefinition?.price ??
            getRoleMonthlyAmount(String(user.role || "CLIENT").toUpperCase())
          )
        },
        usage: {
          chatRequests: usage.chatRequests,
          ragSearches: usage.ragSearches,
          noContext: usage.noContext,
          sttRequests: usage.sttRequests,
          sttMinutes: round3(usage.sttMinutes),
          ttsRequests: usage.ttsRequests,
          ttsMinutes: round3(usage.ttsMinutes),
          analysesPeriod: analyzeUsage.totalInPeriod,
          analyses30d: analyzeUsage.totalInPeriod,
          analysesToday: analyzeUsage.today
        },
        budgetEstimate: {
          chatEur: round2(chatCost),
          ragEur: round2(ragCost),
          sttEur: round2(sttCost),
          ttsEur: round2(ttsCost),
          totalEur: round2(totalCost),
          currency: "EUR"
        },
        budget: {
          monthlyEur: round2(budget),
          remainingEur: round2(remainingBudget),
          utilizationPct: round2(utilizationPct)
        },
        paidAmountPeriodEur: round2(paidAmount),
        paidAmount30dEur: round2(paidAmount)
      };
    });

    return json({
      ok: true,
      periodDays,
      basis: createMetricBasis({
        source: "User, ChatLog, UsageEvent, UsageBucket, Subscription and Payment",
        window: `${periodDays}d`,
        computedAt: now,
        degraded: true,
        degradationReason: "chatlog_metrics_without_retention_contract"
      }),
      totalUsers,
      items,
      totals: {
        estimatedCostEur: round2(totalEstimatedCost),
        paidAmountEur: round2(totalPaidAmount),
        budgetCapacityEur: round2(totalBudgetCapacity),
        nearLimitUsersCount
      },
      costModel: {
        chatRequestEur: COST_CHAT_REQUEST_EUR,
        ragSearchEur: COST_RAG_SEARCH_EUR,
        sttPerMinuteEur: COST_STT_PER_MINUTE_EUR,
        ttsPerMinuteEur: COST_TTS_PER_MINUTE_EUR,
        monthlyBudgetEur: round2(MONTHLY_COST_BUDGET_EUR_PER_USER),
        monthlyBudgetClientEur: round2(getMonthlyCostBudgetForRole("CLIENT", false)),
        monthlyBudgetWorkerEur: round2(getMonthlyCostBudgetForRole("SOCIAL_WORKER", false)),
        currency: "EUR"
      }
    });
  } catch {
    return errorJson("api.admin.analytics.users_load_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_USERS_GET_FAILED"
    });
  }
}

export async function DELETE(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const actorUserId = String(session?.user?.id || "");
    const result = dryRun
      ? await previewBulkUserDeletion({ db: prisma, body, actorUserId })
      : await executeBulkUserDeletion({ db: prisma, body, actorUserId, request: req });
    return json({ ok: true, dryRun, ...result });
  } catch (error) {
    if (error instanceof DangerousActionError) {
      return errorJson(error.messageKey, error.status, locale, { debugCode: error.code });
    }
    console.error("admin analytics users DELETE failed", safeError(error));
    return errorJson("api.admin.analytics.users_delete_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_USERS_DELETE_FAILED"
    });
  }
}

export async function POST(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const result = dryRun
      ? await previewBulkEmail({ db: prisma, body })
      : await executeBulkEmail({
          db: prisma,
          mailer: getMailer("admin-analytics-bulk"),
          from: process.env.EMAIL_FROM || process.env.SMTP_FROM,
          body,
          actorUserId: session.user.id
        });
    return json({ ok: true, dryRun, ...result });
  } catch (error) {
    if (error instanceof DangerousActionError) {
      return errorJson(error.messageKey, error.status, locale, { debugCode: error.code });
    }
    console.error("admin analytics users POST failed", error);
    return errorJson("api.admin.analytics.users_email_send_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_USERS_EMAIL_FAILED"
    });
  }
}
