import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { getAnalyzeLimitDetails, utcDayStart } from "@/lib/analyzeQuota";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { getMailer } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { deleteUserWithPrivacyCleanup } from "@/lib/privacy/userDeletion";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 180;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_BULK_USER_IDS = 500;
const MAX_BULK_SUBJECT_LEN = 180;
const MAX_BULK_BODY_LEN = 8000;
const ADMIN_ANALYTICS_SHOW_FULL_EMAILS =
  String(process.env.ADMIN_ANALYTICS_SHOW_FULL_EMAILS || "")
    .trim()
    .toLowerCase() === "true" ||
  String(process.env.ADMIN_ANALYTICS_SHOW_FULL_EMAILS || "")
    .trim()
    .toLowerCase() === "1" ||
  String(process.env.ADMIN_ANALYTICS_SHOW_FULL_EMAILS || "")
    .trim()
    .toLowerCase() === "yes";

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
    crisisDetected: 0,
    sttRequests: 0,
    sttAudioBytes: 0,
    sttMinutes: 0,
    ttsRequests: 0,
    ttsChars: 0,
    ttsMinutes: 0,
    analyses: 0
  };
}

function maskEmail(email) {
  const value = String(email || "").trim();
  if (!value || !value.includes("@")) return null;

  const [localRaw, domainRaw] = value.split("@");
  const local = String(localRaw || "");
  const domain = String(domainRaw || "");
  if (!local || !domain) return null;

  const localMasked =
    local.length <= 2
      ? `${local.slice(0, 1)}***`
      : `${local.slice(0, 1)}${"*".repeat(Math.min(8, Math.max(2, local.length - 2)))}${local.slice(-1)}`;

  const domainParts = domain.split(".");
  const host = String(domainParts.shift() || "");
  const tld = domainParts.join(".");
  const hostMasked =
    host.length <= 2
      ? `${host.slice(0, 1)}***`
      : `${host.slice(0, 1)}***${host.slice(-1)}`;

  if (!tld) return `${localMasked}@${hostMasked}`;
  return `${localMasked}@${hostMasked}.${tld}`;
}

function toActiveSubscription(subscription, now = new Date()) {
  if (!subscription) return false;
  if (String(subscription.status || "").toUpperCase() !== "ACTIVE") return false;
  if (!subscription.validUntil) return true;
  return new Date(subscription.validUntil).getTime() > now.getTime();
}

function normalizeIds(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_BULK_USER_IDS) break;
  }
  return out;
}

function normalizeBulkTarget(value) {
  return String(value || "").trim().toLowerCase() === "all" ? "all" : "selected";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map(line => escapeHtml(line.trimEnd()));
  return `<div>${lines.map(line => (line ? `<p>${line}</p>` : "<p>&nbsp;</p>")).join("")}</div>`;
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
    const sinceDay = utcDayStart(since);
    const todayDay = utcDayStart(now);

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
      analyzeRows,
      subscriptions,
      paidByUser
    ] = await Promise.all([
      prisma.chatLog.groupBy({
        by: ["userId", "event"],
        where: {
          userId: { in: userIds },
          createdAt: { gte: since },
          event: {
            in: ["chat_request", "rag_search", "no_context", "crisis_detected", "stt_request", "tts_request"]
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
      prisma.analyzeUsage.findMany({
        where: {
          userId: { in: userIds },
          day: { gte: sinceDay }
        },
        select: {
          userId: true,
          day: true,
          count: true
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
      if (event === "crisis_detected") usageByUser[userId].crisisDetected = count;
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

    for (const row of analyzeRows) {
      const userId = row?.userId;
      if (!userId || !analyzeUsageByUser[userId]) continue;

      const count = Number(row?.count || 0);
      analyzeUsageByUser[userId].totalInPeriod += count;
      if (row?.day instanceof Date && row.day.getTime() === todayDay.getTime()) {
        analyzeUsageByUser[userId].today += count;
      }
    }

    const latestSubscriptionByUser = {};
    for (const row of subscriptions) {
      if (!row?.userId) continue;
      if (!latestSubscriptionByUser[row.userId]) latestSubscriptionByUser[row.userId] = row;
    }

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
      const analyzeLimit = getAnalyzeLimitDetails(String(user.role || "CLIENT").toUpperCase(), !!user.isAdmin);

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
      const analyzeUtilizationPct = analyzeLimit.limit > 0 ? Math.min(100, (analyzeUsage.today / analyzeLimit.limit) * 100) : 0;
      const analyzeRemainingToday = Math.max(0, analyzeLimit.limit - analyzeUsage.today);

      totalEstimatedCost += totalCost;
      totalPaidAmount += paidAmount;
      totalBudgetCapacity += budget;
      if (analyzeUtilizationPct >= 80 || utilizationPct >= 80) {
        nearLimitUsersCount += 1;
      }

      return {
        userId: user.id,
        email: ADMIN_ANALYTICS_SHOW_FULL_EMAILS ? user.email || null : maskEmail(user.email),
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
          analyzeDaily: analyzeLimit.limit,
          analyzeBaseDaily: analyzeLimit.baseLimit,
          analyzeToday: analyzeUsage.today,
          analyzeRemainingToday,
          analyzeUtilizationPct: round2(analyzeUtilizationPct),
          planAmountEur: round2(analyzeLimit.monthlyAmount || 0)
        },
        usage: {
          chatRequests: usage.chatRequests,
          ragSearches: usage.ragSearches,
          noContext: usage.noContext,
          crisisDetected: usage.crisisDetected,
          sttRequests: usage.sttRequests,
          sttMinutes: round3(usage.sttMinutes),
          ttsRequests: usage.ttsRequests,
          ttsMinutes: round3(usage.ttsMinutes),
          analysesPeriod: analyzeUsage.totalInPeriod,
          analyses30d: analyzeUsage.totalInPeriod,
          analysesToday: analyzeUsage.today
        },
        costs: {
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
    const userIds = normalizeIds(body?.userIds);
    if (!userIds.length) {
      return errorJson("api.admin.analytics.users_delete_invalid_payload", 400, locale);
    }

    const selectedUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, isAdmin: true }
    });

    if (!selectedUsers.length) {
      return errorJson("api.admin.analytics.users_delete_not_found", 404, locale);
    }

    const ownUserId = String(session?.user?.id || "");
    const selfSelected = ownUserId ? userIds.includes(ownUserId) : false;
    const protectedAdminIds = new Set(
      selectedUsers.filter(user => user.isAdmin || user.id === ownUserId).map(user => user.id)
    );
    const deletableUsers = selectedUsers.filter(user => !protectedAdminIds.has(user.id));
    if (!deletableUsers.length) {
      return errorJson("api.admin.analytics.users_delete_forbidden_targets", 409, locale, {
        blocked: {
          self: selfSelected,
          admins: selectedUsers.filter(user => user.isAdmin).map(user => user.id)
        }
      });
    }

    const deletableIds = deletableUsers.map(user => user.id);
    const emailsToCleanup = deletableUsers
      .map(user => String(user.email || "").trim().toLowerCase())
      .filter(Boolean);

    if (emailsToCleanup.length) {
      await prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { in: emailsToCleanup } },
            { identifier: { in: emailsToCleanup.map(email => `email-verify:${email}`) } }
          ]
        }
      });
    }

    for (const userId of deletableIds) {
      await deleteUserWithPrivacyCleanup({
        actorUserId: ownUserId || String(session?.user?.id || ""),
        targetUserId: userId,
        reason: "admin_analytics_users_delete",
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null
      });
    }

    return json({
      ok: true,
      deletedCount: deletableIds.length,
      deletedIds: deletableIds,
      blocked: {
        self: selfSelected,
        admins: selectedUsers.filter(user => user.isAdmin).map(user => user.id)
      }
    });
  } catch (error) {
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
    const target = normalizeBulkTarget(body?.target);
    const subject = String(body?.subject || "").trim();
    const text = String(body?.text || "").trim();
    const selectedIds = normalizeIds(body?.userIds);

    if (!subject || !text) {
      return errorJson("api.admin.analytics.users_email_invalid_payload", 400, locale);
    }
    if (subject.length > MAX_BULK_SUBJECT_LEN || text.length > MAX_BULK_BODY_LEN) {
      return errorJson("api.admin.analytics.users_email_too_large", 400, locale, {
        limits: {
          subject: MAX_BULK_SUBJECT_LEN,
          text: MAX_BULK_BODY_LEN
        }
      });
    }
    if (target === "selected" && !selectedIds.length) {
      return errorJson("api.admin.analytics.users_email_no_recipients", 400, locale);
    }

    const where =
      target === "all"
        ? { email: { not: null } }
        : { id: { in: selectedIds }, email: { not: null } };

    const recipients = await prisma.user.findMany({
      where,
      select: { id: true, email: true }
    });

    const recipientEmails = [];
    const seen = new Set();
    for (const row of recipients) {
      const email = String(row?.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      recipientEmails.push(email);
      if (recipientEmails.length >= MAX_BULK_USER_IDS) break;
    }

    if (!recipientEmails.length) {
      return errorJson("api.admin.analytics.users_email_no_recipients", 404, locale);
    }

    const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();
    if (!from) {
      return errorJson("api.admin.analytics.email_from_missing", 500, locale);
    }

    const mailer = getMailer("admin-analytics-bulk");
    const failed = [];

    for (const to of recipientEmails) {
      try {
        await mailer.sendMail({
          to,
          from,
          subject,
          text,
          html: textToHtml(text)
        });
      } catch (error) {
        failed.push({
          email: to,
          error: String(error?.message || "send_failed")
        });
      }
    }

    return json({
      ok: true,
      target,
      requestedCount: recipientEmails.length,
      sentCount: recipientEmails.length - failed.length,
      failedCount: failed.length,
      failed
    });
  } catch (error) {
    console.error("admin analytics users POST failed", error);
    return errorJson("api.admin.analytics.users_email_send_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_USERS_EMAIL_FAILED"
    });
  }
}
