import { prisma } from "@/lib/prisma";
import { getRoleUsageAllowanceMultiplier, normalizeSubscriptionRole } from "@/lib/subscriptionPlans";

export const MONTHLY_COST_BUDGET_EUR_PER_USER = readNumber(process.env.MONTHLY_COST_BUDGET_EUR_PER_USER, 4);
export const COST_CHAT_REQUEST_EUR = readNumber(process.env.ANALYTICS_COST_CHAT_REQUEST_EUR, 0.0035);
export const COST_RAG_SEARCH_EUR = readNumber(process.env.ANALYTICS_COST_RAG_SEARCH_EUR, 0.0012);
export const COST_STT_PER_MINUTE_EUR = readNumber(process.env.ANALYTICS_COST_STT_PER_MINUTE_EUR, 0.003);
export const COST_TTS_PER_MINUTE_EUR = readNumber(process.env.ANALYTICS_COST_TTS_PER_MINUTE_EUR, 0.015);
const MONTHLY_COST_BUDGET_EUR_ADMIN = readNumber(
  process.env.MONTHLY_COST_BUDGET_EUR_ADMIN,
  Math.max(MONTHLY_COST_BUDGET_EUR_PER_USER * 3, 12)
);

function readNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function utcMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function buildUsageSeed() {
  return {
    chatRequests: 0,
    ragSearches: 0,
    sttRequests: 0,
    sttAudioBytes: 0,
    sttMinutes: 0,
    ttsRequests: 0,
    ttsChars: 0,
    ttsMinutes: 0
  };
}

export function estimateUsageCostEur(usage = {}) {
  const chatRequests = Number(usage.chatRequests || 0);
  const ragSearches = Number(usage.ragSearches || 0);
  const sttMinutes = Number(usage.sttMinutes || 0);
  const ttsMinutes = Number(usage.ttsMinutes || 0);

  const chatEur = chatRequests * COST_CHAT_REQUEST_EUR;
  const ragEur = ragSearches * COST_RAG_SEARCH_EUR;
  const sttEur = sttMinutes * COST_STT_PER_MINUTE_EUR;
  const ttsEur = ttsMinutes * COST_TTS_PER_MINUTE_EUR;
  const totalEur = chatEur + ragEur + sttEur + ttsEur;

  return {
    chatEur,
    ragEur,
    sttEur,
    ttsEur,
    sttMinutes,
    ttsMinutes,
    totalEur
  };
}

export async function readUserMonthlyUsage(userId, { since = utcMonthStart() } = {}) {
  if (!userId) return buildUsageSeed();

  const [eventRows, usageAmountRows] = await Promise.all([
    prisma.chatLog.groupBy({
      by: ["event"],
      where: {
        userId,
        createdAt: { gte: since },
        event: { in: ["chat_request", "rag_search", "stt_request", "tts_request"] }
      },
      _count: { _all: true }
    }),
    prisma.chatLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        event: { in: ["stt_request", "tts_request"] }
      },
      select: {
        event: true,
        data: true
      }
    })
  ]);

  const usage = buildUsageSeed();

  for (const row of eventRows) {
    const event = String(row?.event || "");
    const count = Number(row?._count?._all || 0);
    if (event === "chat_request") usage.chatRequests = count;
    if (event === "rag_search") usage.ragSearches = count;
    if (event === "stt_request") usage.sttRequests = count;
    if (event === "tts_request") usage.ttsRequests = count;
  }

  for (const row of usageAmountRows) {
    if (row.event === "stt_request") {
      const size = Number(row?.data?.fileSizeBytes || 0);
      if (Number.isFinite(size) && size > 0) usage.sttAudioBytes += size;
      const durationSecondsValue = row?.data?.durationSeconds ?? row?.data?.duration_seconds ?? 0;
      const durationSeconds = Number(durationSecondsValue);
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        usage.sttMinutes += durationSeconds / 60;
      }
    }
    if (row.event === "tts_request") {
      const chars = Number(row?.data?.textLength || 0);
      if (Number.isFinite(chars) && chars > 0) usage.ttsChars += chars;
      const durationSecondsValue = row?.data?.durationSeconds ?? row?.data?.duration_seconds ?? 0;
      const durationSeconds = Number(durationSecondsValue);
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        usage.ttsMinutes += durationSeconds / 60;
      }
    }
  }

  return usage;
}

export function getMonthlyCostBudgetForRole(role = "CLIENT", isAdmin = false) {
  if (isAdmin || role === "ADMIN") return round2(MONTHLY_COST_BUDGET_EUR_ADMIN);

  const normalizedRole = normalizeSubscriptionRole(role);
  const envOverride =
    normalizedRole === "SERVICE_PROVIDER"
      ? process.env.MONTHLY_COST_BUDGET_EUR_SERVICE_PROVIDER || process.env.MONTHLY_COST_BUDGET_EUR_WORKER
      : normalizedRole === "SOCIAL_WORKER"
        ? process.env.MONTHLY_COST_BUDGET_EUR_WORKER
        : process.env.MONTHLY_COST_BUDGET_EUR_CLIENT;
  const explicitBudget = readNumber(envOverride, 0);
  if (explicitBudget > 0) return round2(explicitBudget);

  const allowanceMultiplier = getRoleUsageAllowanceMultiplier(normalizedRole, {
    softening: Number(process.env.MONTHLY_COST_BUDGET_PRICE_SOFTENING || 0.6),
    cap: Number(process.env.MONTHLY_COST_BUDGET_PRICE_CAP || 1.85)
  });

  return round2(MONTHLY_COST_BUDGET_EUR_PER_USER * allowanceMultiplier);
}

async function resolveBudgetContext(userId, options = {}) {
  if (options.budgetEur != null && Number.isFinite(Number(options.budgetEur))) {
    return {
      budgetEur: Number(options.budgetEur),
      role: options.role || "CLIENT",
      isAdmin: Boolean(options.isAdmin)
    };
  }

  const role = String(options.role || "").trim().toUpperCase();
  if (role || options.isAdmin != null) {
    return {
      budgetEur: getMonthlyCostBudgetForRole(role || "CLIENT", Boolean(options.isAdmin)),
      role: role || "CLIENT",
      isAdmin: Boolean(options.isAdmin)
    };
  }

  if (!userId) {
    return {
      budgetEur: MONTHLY_COST_BUDGET_EUR_PER_USER,
      role: "CLIENT",
      isAdmin: false
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isAdmin: true
    }
  });

  return {
    budgetEur: getMonthlyCostBudgetForRole(user?.role || "CLIENT", Boolean(user?.isAdmin)),
    role: String(user?.role || "CLIENT").toUpperCase(),
    isAdmin: Boolean(user?.isAdmin)
  };
}

export async function getUserMonthlyBudgetSnapshot(userId, options = {}) {
  const budgetContext = await resolveBudgetContext(userId, options);
  const budgetEur = Number(budgetContext.budgetEur || 0);
  const usage = await readUserMonthlyUsage(userId, { since: options.since || utcMonthStart() });
  const costs = estimateUsageCostEur(usage);
  const usedEur = Number(costs.totalEur || 0);
  const remainingEur = Math.max(0, budgetEur - usedEur);
  return {
    budgetEur,
    role: budgetContext.role,
    isAdmin: budgetContext.isAdmin,
    usedEur,
    remainingEur,
    usage,
    costs: {
      ...costs,
      chatEur: round2(costs.chatEur),
      ragEur: round2(costs.ragEur),
      sttEur: round2(costs.sttEur),
      ttsEur: round2(costs.ttsEur),
      totalEur: round2(costs.totalEur)
    }
  };
}

export async function canSpendMonthlyBudget(userId, increment = {}, options = {}) {
  const snapshot = await getUserMonthlyBudgetSnapshot(userId, options);
  const incrementCost = estimateUsageCostEur(increment);
  const nextUsedEurRaw = Number(snapshot.usedEur || 0) + Number(incrementCost.totalEur || 0);
  const allowed = nextUsedEurRaw <= Number(snapshot.budgetEur || 0) + 1e-9;

  return {
    allowed,
    budgetEur: round2(snapshot.budgetEur),
    usedEur: round2(snapshot.usedEur),
    remainingEur: round2(snapshot.remainingEur),
    nextUsedEur: round2(nextUsedEurRaw),
    incrementEur: round2(incrementCost.totalEur),
    usage: snapshot.usage,
    costs: snapshot.costs
  };
}
