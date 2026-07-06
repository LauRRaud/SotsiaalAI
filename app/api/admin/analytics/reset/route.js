import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";

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

const RESET_ACTIONS = {
  clear_logs: async tx => {
    const deleted = await tx.chatLog.deleteMany({});
    return { ChatLog: deleted.count };
  },
  clear_conversations: async tx => {
    const deletedMessages = await tx.conversationMessage.deleteMany({});
    const deletedRuns = await tx.conversationRun.deleteMany({});
    const deletedConversations = await tx.conversation.deleteMany({});
    return {
      ConversationMessage: deletedMessages.count,
      ConversationRun: deletedRuns.count,
      Conversation: deletedConversations.count
    };
  },
  clear_rooms: async tx => {
    const deletedMessages = await tx.roomMessage.deleteMany({});
    const deletedInvites = await tx.invite.deleteMany({});
    const deletedMembers = await tx.roomMember.deleteMany({});
    const deletedRooms = await tx.room.deleteMany({});
    return {
      RoomMessage: deletedMessages.count,
      Invite: deletedInvites.count,
      RoomMember: deletedMembers.count,
      Room: deletedRooms.count
    };
  },
  clear_auth_tokens: async tx => {
    const deletedVerification = await tx.verificationToken.deleteMany({});
    const deletedLoginTemp = await tx.loginTempToken.deleteMany({});
    const deletedOtp = await tx.emailOtpCode.deleteMany({});
    const deletedTrustedDevices = await tx.trustedDevice.deleteMany({});
    return {
      VerificationToken: deletedVerification.count,
      LoginTempToken: deletedLoginTemp.count,
      EmailOtpCode: deletedOtp.count,
      TrustedDevice: deletedTrustedDevices.count
    };
  },
  clear_usage_metrics: async tx => {
    const deleted = await tx.analyzeUsage.deleteMany({});
    return { AnalyzeUsage: deleted.count };
  },
  clear_billing: async tx => {
    const deletedPayments = await tx.payment.deleteMany({});
    const deletedSubscriptions = await tx.subscription.deleteMany({});
    return {
      Payment: deletedPayments.count,
      Subscription: deletedSubscriptions.count
    };
  }
};

const RESET_COUNT_QUERIES = {
  clear_logs: async tx => ({
    ChatLog: await tx.chatLog.count()
  }),
  clear_conversations: async tx => ({
    ConversationMessage: await tx.conversationMessage.count(),
    ConversationRun: await tx.conversationRun.count(),
    Conversation: await tx.conversation.count()
  }),
  clear_rooms: async tx => ({
    RoomMessage: await tx.roomMessage.count(),
    Invite: await tx.invite.count(),
    RoomMember: await tx.roomMember.count(),
    Room: await tx.room.count()
  }),
  clear_auth_tokens: async tx => ({
    VerificationToken: await tx.verificationToken.count(),
    LoginTempToken: await tx.loginTempToken.count(),
    EmailOtpCode: await tx.emailOtpCode.count(),
    TrustedDevice: await tx.trustedDevice.count()
  }),
  clear_usage_metrics: async tx => ({
    AnalyzeUsage: await tx.analyzeUsage.count()
  }),
  clear_billing: async tx => ({
    Payment: await tx.payment.count(),
    Subscription: await tx.subscription.count()
  })
};

function sumCounts(items) {
  return Object.values(items || {}).reduce((acc, value) => acc + Number(value || 0), 0);
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
    const action = String(body?.action || "").trim().toLowerCase();
    const dryRun = body?.dryRun === true;

    const countFn = RESET_COUNT_QUERIES[action];
    const deleteFn = RESET_ACTIONS[action];

    if (!countFn || !deleteFn) {
      return errorJson("api.admin.analytics.reset_invalid_action", 400, locale);
    }

    const counted = await countFn(prisma);
    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        action,
        counts: counted,
        total: sumCounts(counted)
      });
    }

    const deleted = await prisma.$transaction(async tx => deleteFn(tx));
    return json({
      ok: true,
      dryRun: false,
      action,
      deleted,
      total: sumCounts(deleted)
    });
  } catch (error) {
    console.error("admin analytics reset POST failed", error);
    return errorJson("api.admin.analytics.reset_failed", 500, locale, {
      debugCode: "ADMIN_ANALYTICS_RESET_POST_FAILED"
    });
  }
}
