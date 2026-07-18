import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { getDocumentStorageSnapshot } from "@/lib/admin/documentStorageSnapshot";
import {
  buildExclusiveRequestSplit,
  countServiceAvailabilityStates,
  createCrisisCountMetric,
  createMetric,
  createMetricBasis
} from "@/lib/admin/analyticsMetrics";
import { projectAdminEmail } from "@/lib/admin/emailProjection";
import { assertAdmin } from "@/lib/authz";
import { buildPaymentAlerts, buildPaymentPipelineFromCounts } from "@/lib/admin/payment-alerts";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";
import {
  summarizeFreshnessAudit,
  summarizeHighRiskSourceFreshness
} from "@/lib/rag/sourceFreshness";
import { fetchRagServiceDocumentsForFreshness } from "@/lib/rag/ragServiceFreshnessFallback";
import { summarizeRagTraceSourceQuality } from "@/lib/rag/sourceQualityMetrics";
import { getServiceAvailabilityState } from "@/lib/serviceAvailability";
import { countPlanRoleAnomalies } from "@/lib/subscriptionView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function toCountMap(rows, keyField) {
  const out = {};
  for (const row of rows || []) {
    const key = row?.[keyField];
    if (!key) continue;
    out[key] = Number(row?._count?._all || 0);
  }
  return out;
}

function countDistinct(rows, keyField) {
  return Array.isArray(rows) ? rows.filter(row => row?.[keyField] != null).length : 0;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

async function getSourcePackageSnapshotSummary() {
  const delegate = prisma.sourcePackageSnapshot;
  const empty = {
    sourcePackageCount: null,
    activeSourcePackageCount: null,
    needsReviewSourcePackageCount: null,
    reviewedSourcePackageCount: null,
    pendingReviewSourcePackageCount: null,
    archivedSourcePackageCount: null,
    missingFormsCount: null,
    missingContactsCount: null,
    missingLegalBasisCount: null,
    missingFeesCount: null,
    missingDeadlinesCount: null,
    packageConflictCount: null,
    packagesByMunicipality: {},
    packagesByType: {},
    packagesByReviewStatus: {},
    unavailable: !delegate
  };
  if (!delegate) return empty;

  try {
    const [
      total,
      active,
      needsReview,
      reviewed,
      pendingReview,
      archivedReview,
      activeRows,
      byMunicipalityRows,
      byTypeRows,
      byReviewStatusRows
    ] = await Promise.all([
      delegate.count(),
      delegate.count({ where: { active: true } }),
      delegate.count({ where: { active: true, status: "needs_review" } }),
      delegate.count({ where: { reviewStatus: "reviewed" } }),
      delegate.count({ where: { reviewStatus: "pending" } }),
      delegate.count({ where: { reviewStatus: "archived" } }),
      delegate.findMany({
        where: { active: true },
        select: {
          missingSections: true,
          sourceMembership: true
        },
        take: 1000
      }),
      delegate.groupBy({
        by: ["municipalityId"],
        where: { active: true },
        _count: { _all: true }
      }),
      delegate.groupBy({
        by: ["packageType"],
        where: { active: true },
        _count: { _all: true }
      }),
      delegate.groupBy({
        by: ["reviewStatus"],
        _count: { _all: true }
      })
    ]);

    let missingForms = 0;
    let missingContacts = 0;
    let missingLegalBasis = 0;
    let missingFees = 0;
    let missingDeadlines = 0;
    let packageConflicts = 0;
    for (const row of activeRows) {
      const missing = Array.isArray(row.missingSections) ? row.missingSections : [];
      if (missing.includes("forms")) missingForms += 1;
      if (missing.includes("contacts")) missingContacts += 1;
      if (missing.includes("legal_basis")) missingLegalBasis += 1;
      if (missing.includes("fees")) missingFees += 1;
      if (missing.includes("deadlines")) missingDeadlines += 1;
      const membership = Array.isArray(row.sourceMembership) ? row.sourceMembership : [];
      const municipalities = new Set(membership.map(item => item?.municipality_id).filter(Boolean));
      if (municipalities.size > 1) packageConflicts += 1;
    }

    return {
      sourcePackageCount: total,
      activeSourcePackageCount: active,
      needsReviewSourcePackageCount: needsReview,
      reviewedSourcePackageCount: reviewed,
      pendingReviewSourcePackageCount: pendingReview,
      archivedSourcePackageCount: archivedReview,
      missingFormsCount: missingForms,
      missingContactsCount: missingContacts,
      missingLegalBasisCount: missingLegalBasis,
      missingFeesCount: missingFees,
      missingDeadlinesCount: missingDeadlines,
      packageConflictCount: packageConflicts,
      packagesByMunicipality: Object.fromEntries(
        byMunicipalityRows.map(row => [row.municipalityId || "unknown", row._count?._all || 0])
      ),
      packagesByType: Object.fromEntries(
        byTypeRows.map(row => [row.packageType || "unknown", row._count?._all || 0])
      ),
      packagesByReviewStatus: Object.fromEntries(
        byReviewStatusRows.map(row => [row.reviewStatus || "unknown", row._count?._all || 0])
      ),
      unavailable: false
    };
  } catch (error) {
    return {
      ...empty,
      unavailable: true,
      error: error?.message || String(error)
    };
  }
}

function sortFreshnessIssue(left, right) {
  const severityRank = { error: 0, warning: 1, info: 2 };
  const priorityRank = { high: 0, medium: 1, low: 2, unknown: 3 };
  const leftSeverity = severityRank[left?.severity] ?? 9;
  const rightSeverity = severityRank[right?.severity] ?? 9;
  if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;

  const leftPriority = priorityRank[left?.freshness_priority] ?? 9;
  const rightPriority = priorityRank[right?.freshness_priority] ?? 9;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  return Number(right?.age_days || 0) - Number(left?.age_days || 0);
}

function compactFreshnessIssue(item) {
  return {
    source_id: item.source_id || null,
    document_id: item.document_id || null,
    title: item.title || null,
    source_type: item.source_type || null,
    collection_family: item.collection_family || null,
    source_file_type: item.source_file_type || null,
    source_status: item.source_status || null,
    freshness_status: item.freshness_status || null,
    severity: item.severity || "info",
    reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 8) : [],
    metadata_quality: item.metadata_quality || null,
    remediation: item.remediation || null,
    last_checked: item.last_checked || null,
    age_days: item.age_days,
    max_age_days: item.max_age_days,
    valid_to: item.valid_to || null,
    url: item.url || null
  };
}

export async function GET(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale);
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const unopenedPreInquiryCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const storageSnapshotPromise = getDocumentStorageSnapshot();

    const [
      totalRequests,
      totalCrisis,
      noContextCount,
      ragSearchCount,
      ragTraceCount,
      sttRequestCount,
      ttsRequestCount,
      ragErrorCount,
      ragOptionalSearchErrorCount,
      openAiErrorCount,
      conversationTotal,
      activeConversations30d,
      ragDocTotal,
      ragDocFailed,
      ragDocError30d,
      ragDocsRecent,
      ragDocsForFreshness,
      ragDocsByStatus,
      ragDocsByAudience,
      ragDocsByType,
      activeSubscriptions,
      newSubscriptions30d,
      canceledSubscriptions30d,
      paymentsByStatus30d,
      paidAmount30d,
      recentPayments,
      paymentEventInitStartedCount,
      paymentEventCheckoutCreatedCount,
      paymentEventInitFailedCount,
      paymentEventCallbackSuccessCount,
      paymentEventCallbackPendingCount,
      paymentEventCallbackFailedCount,
      paymentEventCallbackCanceledCount,
      paymentEventWebhookProcessedCount,
      paymentEventWebhookPaidCount,
      paymentEventWebhookFailedStatusCount,
      paymentEventWebhookCanceledStatusCount,
      paymentEventWebhookRefundedStatusCount,
      paymentEventWebhookErrorCount,
      paymentEventWebhookInvalidSignatureCount,
      paymentEventWebhookInvalidPayloadCount,
      paymentEventWebhookRateLimitedCount,
      helpRequestsOpen,
      helpOffersOpen,
      helpRequests30d,
      helpOffers30d,
      helpMatches30d,
      helpMatchesByStatus,
      roomsTotal,
      roomMessages30d,
      activeRooms30dRows,
      pendingInvites,
      sponsoredInvites30d,
      activeSponsoredMembers,
      documentsTotal,
      documents30d,
      artifactsDraft,
      artifactsFinal,
      artifactCreates30d,
      artifactApprovals30d,
      documentAuditActions30d,
      frameworkAcceptancesTotal,
      frameworkAcceptances30d,
      frameworkAcceptancesSigned30d,
      recentFrameworkAcceptances,
      storageSnapshot,
      usersTotal,
      usersByRole,
      materialsPending,
      sourceFeedbackOpen,
      deletionBacklogByStatus,
      serviceAvailabilityRows,
      sentUnopenedPreInquiries
    ] = await Promise.all([
      prisma.chatLog.count({
        where: {
          event: "chat_request",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          createdAt: { gte: since },
          OR: [
            { event: "crisis_detected" },
            { data: { path: ["isCrisis"], equals: true } }
          ]
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "no_context",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "rag_search",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "rag_trace",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "stt_request",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "tts_request",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "rag_error",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "rag_optional_search_error",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "openai_error",
          createdAt: { gte: since }
        }
      }),
      prisma.conversation.count(),
      prisma.conversation.count({
        where: {
          archivedAt: null,
          lastActivityAt: { gte: since }
        }
      }),
      prisma.ragDocument.count(),
      prisma.ragDocument.count({ where: { status: "FAILED" } }),
      prisma.ragDocument.count({
        where: {
          createdAt: { gte: since },
          error: { not: null }
        }
      }),
      prisma.ragDocument.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          audience: true,
          sourceUrl: true,
          fileName: true,
          insertedAt: true,
          createdAt: true,
          updatedAt: true,
          error: true
        }
      }),
      prisma.ragDocument.findMany({
        orderBy: { updatedAt: "desc" },
        take: 1000,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          audience: true,
          sourceUrl: true,
          fileName: true,
          remoteId: true,
          metadata: true,
          insertedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.ragDocument.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.ragDocument.groupBy({ by: ["audience"], _count: { _all: true } }),
      prisma.ragDocument.groupBy({ by: ["type"], _count: { _all: true } }),
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
          OR: [{ validUntil: null }, { validUntil: { gt: now } }]
        }
      }),
      prisma.subscription.count({ where: { createdAt: { gte: since } } }),
      prisma.subscription.count({ where: { canceledAt: { gte: since } } }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: since }
        },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          createdAt: true,
          paidAt: true
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_init_started",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_init_checkout_created",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_init_failed",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_callback_redirect",
          createdAt: { gte: since },
          data: {
            path: ["paymentState"],
            equals: "success"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_callback_redirect",
          createdAt: { gte: since },
          data: {
            path: ["paymentState"],
            equals: "pending"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_callback_redirect",
          createdAt: { gte: since },
          data: {
            path: ["paymentState"],
            equals: "failed"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_callback_redirect",
          createdAt: { gte: since },
          data: {
            path: ["paymentState"],
            equals: "canceled"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_processed",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_processed",
          createdAt: { gte: since },
          // L-13: loe ainult päris töödeldud PAID (updated=true), mitte
          // idempotentne kordus — muidu paid-konversioon ületaks reaalsust.
          AND: [
            { data: { path: ["resultStatus"], equals: "PAID" } },
            { data: { path: ["updated"], equals: true } }
          ]
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_processed",
          createdAt: { gte: since },
          data: {
            path: ["resultStatus"],
            equals: "FAILED"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_processed",
          createdAt: { gte: since },
          data: {
            path: ["resultStatus"],
            equals: "CANCELED"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_processed",
          createdAt: { gte: since },
          data: {
            path: ["resultStatus"],
            equals: "REFUNDED"
          }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_failed",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_invalid_signature",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_invalid_payload",
          createdAt: { gte: since }
        }
      }),
      prisma.chatLog.count({
        where: {
          event: "subscription_webhook_rate_limited",
          createdAt: { gte: since }
        }
      }),
      prisma.helpRequest.count({
        where: {
          status: { in: ["OPEN", "MATCHED"] }
        }
      }),
      prisma.helpOffer.count({
        where: {
          status: { in: ["OPEN", "MATCHED"] }
        }
      }),
      prisma.helpRequest.count({
        where: {
          createdAt: { gte: since }
        }
      }),
      prisma.helpOffer.count({
        where: {
          createdAt: { gte: since }
        }
      }),
      prisma.helpMatch.count({
        where: {
          createdAt: { gte: since }
        }
      }),
      prisma.helpMatch.groupBy({
        by: ["status"],
        where: {
          createdAt: { gte: since }
        },
        _count: { _all: true }
      }),
      prisma.room.count(),
      prisma.roomMessage.count({
        where: {
          createdAt: { gte: since },
          deletedAt: null
        }
      }),
      prisma.roomMessage.groupBy({
        by: ["roomId"],
        where: {
          createdAt: { gte: since },
          deletedAt: null
        },
        _count: { _all: true }
      }),
      prisma.invite.count({
        where: {
          status: "PENDING_PAYMENT"
        }
      }),
      prisma.invite.count({
        where: {
          paymentMode: "SPONSORED_BY_HOST",
          createdAt: { gte: since }
        }
      }),
      prisma.roomMember.count({
        where: {
          billingSource: "SPONSORED_BY_HOST",
          leftAt: null
        }
      }),
      prisma.userDocument.count(),
      prisma.userDocument.count({
        where: {
          createdAt: { gte: since }
        }
      }),
      prisma.agentArtifact.count({
        where: {
          status: "DRAFT"
        }
      }),
      prisma.agentArtifact.count({
        where: {
          status: "FINAL"
        }
      }),
      prisma.agentArtifact.count({
        where: {
          createdAt: { gte: since }
        }
      }),
      prisma.agentArtifact.count({
        where: {
          approvedAt: { gte: since }
        }
      }),
      prisma.documentAudit.groupBy({
        by: ["action"],
        where: {
          createdAt: { gte: since }
        },
        _count: { _all: true }
      }),
      prisma.frameworkAcceptance.count(),
      prisma.frameworkAcceptance.count({
        where: {
          acceptedAt: { gte: since }
        }
      }),
      prisma.frameworkAcceptance.count({
        where: {
          acceptedAt: { gte: since },
          signedDocumentDownloadedAt: { not: null }
        }
      }),
      prisma.frameworkAcceptance.findMany({
        orderBy: { acceptedAt: "desc" },
        take: 20,
        select: {
          id: true,
          frameworkKey: true,
          frameworkVersion: true,
          acceptanceType: true,
          acceptanceSource: true,
          roleAtAcceptance: true,
          locale: true,
          acceptedAt: true,
          reviewDocumentOpenedAt: true,
          signedDocumentDownloadedAt: true,
          document: {
            select: {
              id: true,
              title: true
            }
          },
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      }),
      storageSnapshotPromise,
      prisma.user.count(),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.materialSubmission.count({ where: { status: "pending" } }),
      prisma.sourceFeedback.count({ where: { status: "OPEN" } }),
      prisma.dataDeletionJob.groupBy({
        by: ["status"],
        where: { status: { in: ["pending", "failed"] } },
        _count: { _all: true }
      }),
      prisma.serviceProviderService.findMany({
        where: { status: "PUBLISHED" },
        select: { availabilityStatus: true, availabilityCheckedAt: true }
      }),
      prisma.preInquiry.count({
        where: {
          status: "SENT",
          openedAt: null,
          sentAt: { lt: unopenedPreInquiryCutoff }
        }
      })
    ]);

    const crisisMetric = createCrisisCountMetric(totalCrisis, { computedAt: now, window: "30d" });
    const deletionBacklogCounts = toCountMap(deletionBacklogByStatus, "status");
    const deletionBacklogTotal = Object.values(deletionBacklogCounts)
      .reduce((sum, value) => sum + Number(value || 0), 0);
    const serviceAvailabilityCounts = countServiceAvailabilityStates(
      serviceAvailabilityRows,
      row => getServiceAvailabilityState(row, { now })
    );
    const liveBasis = source => createMetricBasis({ source, window: "live", computedAt: now });

    const ragLogs = await prisma.chatLog.findMany({
      where: {
        event: "rag_search",
        createdAt: { gte: since }
      },
      select: { data: true },
      orderBy: { createdAt: "desc" },
      take: 1000
    });

    const ragTraceLogs = await prisma.chatLog.findMany({
      where: {
        event: "rag_trace",
        createdAt: { gte: since }
      },
      select: { data: true },
      orderBy: { createdAt: "desc" },
      take: 1000
    });

    let avgRagMatchCount = 0;
    let avgGroupCount = 0;
    let avgChosenGroupCount = 0;
    let total = 0;
    let avgRetrievedCandidateCount = 0;
    let avgSelectedContextCount = 0;
    let avgDisplayedSourceCount = 0;
    let avgFilteredOutSourceCount = 0;
    let traceTotal = 0;

    const groundingDistribution = {
      weak: 0,
      ok: 0,
      strong: 0
    };

    const attributionDecisionDistribution = {
      display: 0,
      hide: 0
    };
    const retrieverDistribution = {};
    const queryPlannerModeDistribution = {};
    const queryPlannerQueryOrderDistribution = {};
    const queryPlannerSelectionStrategyDistribution = {};

    for (const row of ragLogs) {
      const data = row?.data || {};
      if (typeof data.ragMatchCount === "number") avgRagMatchCount += data.ragMatchCount;
      if (typeof data.groupCount === "number") avgGroupCount += data.groupCount;
      if (typeof data.chosenGroupCount === "number") avgChosenGroupCount += data.chosenGroupCount;

      const grounding = data.grounding;
      if (grounding === "weak" || grounding === "ok" || grounding === "strong") {
        groundingDistribution[grounding] += 1;
      }

      total += 1;
    }

    if (total > 0) {
      avgRagMatchCount /= total;
      avgGroupCount /= total;
      avgChosenGroupCount /= total;
    }

    for (const row of ragTraceLogs) {
      const data = row?.data || {};
      const retrievedCount = typeof data.retrieved_count === "number"
        ? data.retrieved_count
        : arrayLength(data.retrieved_source_ids);
      const selectedContextCount = typeof data.selected_context_count === "number"
        ? data.selected_context_count
        : arrayLength(data.selected_context_source_ids);

      avgRetrievedCandidateCount += retrievedCount;
      avgSelectedContextCount += selectedContextCount;
      avgDisplayedSourceCount += arrayLength(data.displayed_source_ids);
      avgFilteredOutSourceCount += arrayLength(data.filtered_out_source_ids);

      for (const retriever of Array.isArray(data.retrievers_used) ? data.retrievers_used : []) {
        const key = String(retriever || "").trim();
        if (!key) continue;
        retrieverDistribution[key] = (retrieverDistribution[key] || 0) + 1;
      }

      const queryPlan = data?.query_plan && typeof data.query_plan === "object" ? data.query_plan : null;
      const plannerMode = String(queryPlan?.mode || "").trim();
      if (plannerMode) {
        queryPlannerModeDistribution[plannerMode] = (queryPlannerModeDistribution[plannerMode] || 0) + 1;
      }
      const plannerQueryOrder = String(queryPlan?.query_order || "").trim();
      if (plannerQueryOrder) {
        queryPlannerQueryOrderDistribution[plannerQueryOrder] = (queryPlannerQueryOrderDistribution[plannerQueryOrder] || 0) + 1;
      }
      const plannerSelectionStrategy = String(queryPlan?.selection_strategy || "").trim();
      if (plannerSelectionStrategy) {
        queryPlannerSelectionStrategyDistribution[plannerSelectionStrategy] =
          (queryPlannerSelectionStrategyDistribution[plannerSelectionStrategy] || 0) + 1;
      }

      for (const decision of Array.isArray(data.attribution_decisions) ? data.attribution_decisions : []) {
        if (decision?.decision === "display") attributionDecisionDistribution.display += 1;
        if (decision?.decision === "hide") attributionDecisionDistribution.hide += 1;
      }

      traceTotal += 1;
    }

    if (traceTotal > 0) {
      avgRetrievedCandidateCount /= traceTotal;
      avgSelectedContextCount /= traceTotal;
      avgDisplayedSourceCount /= traceTotal;
      avgFilteredOutSourceCount /= traceTotal;
    }

    let ragDocsFreshnessSource = "prisma_rag_documents";
    let ragServiceFallbackError = null;
    let ragServiceFallbackCount = 0;
    let ragDocsForFreshnessAudit = ragDocsForFreshness;

    if (arrayLength(ragDocsForFreshness) === 0) {
      try {
        const ragServiceDocs = await fetchRagServiceDocumentsForFreshness({ limit: 1000 });
        ragServiceFallbackCount = ragServiceDocs.length;
        if (ragServiceDocs.length > 0) {
          ragDocsFreshnessSource = "rag_service_documents";
          ragDocsForFreshnessAudit = ragServiceDocs;
        }
      } catch (error) {
        ragServiceFallbackError = error?.message || String(error);
      }
    }

    const ragFreshnessAudit = summarizeFreshnessAudit(ragDocsForFreshnessAudit, { now });
    const ragFreshnessIssues = ragFreshnessAudit.items
      .filter(item => item.severity === "error" || item.severity === "warning")
      .sort(sortFreshnessIssue)
      .slice(0, 25)
      .map(compactFreshnessIssue);
    const highRiskFreshness = summarizeHighRiskSourceFreshness(ragTraceLogs, ragFreshnessAudit.items);
    const ragSourceQuality = summarizeRagTraceSourceQuality(ragTraceLogs);
    const sourcePackageSummary = await getSourcePackageSnapshotSummary();

    // E2: stuck INITIATED loendur (ainult-vaade). Reconciliation-worker töötleb
    // neid; admin ei saa neid nupust "PAID"-iks teha.
    const stuckInitiatedMinutes = Math.max(
      5,
      Number(process.env.PAYMENT_RECONCILE_STUCK_MINUTES || 30)
    );
    const stuckInitiatedCutoff = new Date(now.getTime() - stuckInitiatedMinutes * 60 * 1000);
    const stuckInitiatedCount = await prisma.payment.count({
      where: { status: "INITIATED", createdAt: { lt: stuckInitiatedCutoff } }
    });
    // E1: mittesiduv plaani-rolli anomaalia agregaat (ei avalda ühegi kasutaja infot).
    const planRoleAnomalies = await countPlanRoleAnomalies(prisma, { now });

    const paymentPipeline30d = buildPaymentPipelineFromCounts({
      initStarted: paymentEventInitStartedCount,
      checkoutCreated: paymentEventCheckoutCreatedCount,
      initFailed: paymentEventInitFailedCount,
      callbackSuccess: paymentEventCallbackSuccessCount,
      callbackPending: paymentEventCallbackPendingCount,
      callbackFailed: paymentEventCallbackFailedCount,
      callbackCanceled: paymentEventCallbackCanceledCount,
      webhookProcessed: paymentEventWebhookProcessedCount,
      webhookPaid: paymentEventWebhookPaidCount,
      webhookFailed: paymentEventWebhookFailedStatusCount,
      webhookCanceled: paymentEventWebhookCanceledStatusCount,
      webhookRefunded: paymentEventWebhookRefundedStatusCount,
      webhookError: paymentEventWebhookErrorCount,
      webhookInvalidSignature: paymentEventWebhookInvalidSignatureCount,
      webhookInvalidPayload: paymentEventWebhookInvalidPayloadCount,
      webhookRateLimited: paymentEventWebhookRateLimitedCount
    });
    const paymentAlerts30d = buildPaymentAlerts(paymentPipeline30d);

    return json({
      ok: true,
      periodDays: 30,
      basis: createMetricBasis({
        source: "Prisma aggregates and operational ChatLog",
        window: "30d with live operational counters",
        computedAt: now,
        degraded: Boolean(ragServiceFallbackError || sourcePackageSummary.unavailable),
        degradationReason: ragServiceFallbackError
          ? "rag_service_fallback_failed"
          : sourcePackageSummary.unavailable
            ? "source_package_snapshot_unavailable"
            : null
      }),
      sampledBasis: createMetricBasis({
        source: "ChatLog rag_search and rag_trace plus RAG freshness inputs",
        window: "30d",
        computedAt: now,
        sampleLimit: 1000,
        degraded: Boolean(ragServiceFallbackError),
        degradationReason: ragServiceFallbackError ? "rag_service_fallback_failed" : null
      }),
      totalRequests,
      totalCrisis: crisisMetric.value,
      crisis: crisisMetric,
      noContextCount,
      ragSearchCount,
      ragTraceCount,
      requestSplit: buildExclusiveRequestSplit({ totalRequests, ragSearchCount, noContextCount }),
      users: {
        total: usersTotal,
        byRole: toCountMap(usersByRole, "role")
      },
      operations: {
        materialsPending: createMetric(materialsPending, liveBasis("MaterialSubmission status=pending")),
        sourceFeedbackOpen: createMetric(sourceFeedbackOpen, liveBasis("SourceFeedback status=OPEN")),
        deletionBacklog: {
          ...createMetric(deletionBacklogTotal, liveBasis("DataDeletionJob status pending or failed")),
          counts: deletionBacklogCounts
        },
        serviceConfirmations: {
          ...createMetric(serviceAvailabilityCounts.total, liveBasis("published ServiceProviderService availability")),
          counts: serviceAvailabilityCounts
        },
        sentUnopenedPreInquiries: createMetric(
          sentUnopenedPreInquiries,
          createMetricBasis({
            source: "PreInquiry status=SENT and openedAt=null",
            window: "sent more than 7d ago",
            computedAt: now
          })
        )
      },
      chat: {
        conversationsTotal: conversationTotal,
        activeConversations30d,
        sttRequests30d: sttRequestCount,
        ttsRequests30d: ttsRequestCount,
        ragErrors30d: ragErrorCount,
        ragOptionalSearchErrors30d: ragOptionalSearchErrorCount,
        openAiErrors30d: openAiErrorCount
      },
      ragDocs: {
        total: ragDocTotal,
        failed: ragDocFailed,
        error30d: ragDocError30d,
        byStatus: toCountMap(ragDocsByStatus, "status"),
        byAudience: toCountMap(ragDocsByAudience, "audience"),
        byType: toCountMap(ragDocsByType, "type"),
        recent: ragDocsRecent,
        freshness: {
          basis: createMetricBasis({
            source: ragDocsFreshnessSource,
            window: "current RAG document snapshot",
            computedAt: now,
            sampleLimit: 1000,
            degraded: Boolean(ragServiceFallbackError),
            degradationReason: ragServiceFallbackError ? "rag_service_fallback_failed" : null
          }),
          auditSource: ragDocsFreshnessSource,
          audited: ragServiceFallbackError ? null : ragFreshnessAudit.summary.total,
          ragServiceFallbackCount,
          ragServiceFallbackError,
          summary: ragServiceFallbackError ? null : ragFreshnessAudit.summary,
          issues: ragFreshnessIssues,
          highRisk: highRiskFreshness.summary,
          highRiskIssues: highRiskFreshness.issues
        },
        sourceQuality: {
          summary: ragSourceQuality.summary,
          issues: ragSourceQuality.issues
        },
        sourcePackages: sourcePackageSummary
      },
      billing: {
        activeSubscriptions,
        newSubscriptions30d,
        canceledSubscriptions30d,
        paymentsByStatus30d: toCountMap(paymentsByStatus30d, "status"),
        paidAmount30d: paidAmount30d?._sum?.amount ?? "0",
        recentPayments,
        paymentPipeline30d,
        paymentAlerts30d,
        stuckInitiated: {
          count: stuckInitiatedCount,
          olderThanMinutes: stuckInitiatedMinutes
        },
        planRoleAnomalies
      },
      help: {
        openRequests: helpRequestsOpen,
        openOffers: helpOffersOpen,
        newRequests30d: helpRequests30d,
        newOffers30d: helpOffers30d,
        matches30d: helpMatches30d,
        matchesByStatus30d: toCountMap(helpMatchesByStatus, "status")
      },
      collaboration: {
        roomsTotal,
        activeRooms30d: countDistinct(activeRooms30dRows, "roomId"),
        roomMessages30d,
        pendingInvites,
        sponsoredInvites30d,
        activeSponsoredMembers
      },
      documents: {
        total: documentsTotal,
        uploaded30d: documents30d,
        draftArtifacts: artifactsDraft,
        finalArtifacts: artifactsFinal,
        created30d: artifactCreates30d,
        approved30d: artifactApprovals30d,
        actions30d: toCountMap(documentAuditActions30d, "action"),
        frameworkAcceptances: {
          total: frameworkAcceptancesTotal,
          accepted30d: frameworkAcceptances30d,
          signedDownloaded30d: frameworkAcceptancesSigned30d,
          recent: recentFrameworkAcceptances.map(row => ({
            ...row,
            user: row.user
              ? { ...row.user, email: projectAdminEmail(row.user.email) }
              : null
          }))
        },
        storage: storageSnapshot
      },
      averages: {
        avgRagMatchCount,
        avgGroupCount,
        avgChosenGroupCount,
        groundingDistribution,
        avgRetrievedCandidateCount,
        avgSelectedContextCount,
        avgDisplayedSourceCount,
        avgFilteredOutSourceCount,
        attributionDecisionDistribution,
        retrieverDistribution,
        queryPlannerModeDistribution,
        queryPlannerQueryOrderDistribution,
        queryPlannerSelectionStrategyDistribution
      }
    });
  } catch {
    return errorJson("api.admin.analytics.summary_load_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_SUMMARY_GET_FAILED"
    });
  }
}
