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
