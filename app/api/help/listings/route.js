import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  listHelpOfferListingViews,
  listHelpRequestListingViews,
} from "@/lib/help";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return null;
    return {
      userId: session.user.id,
      role: session.user.role
    };
  } catch {
    return null;
  }
}

function normalizeKind(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "offer" ? "offer" : normalized === "request" ? "request" : "";
}

function resolveModel(kind = "") {
  return kind === "offer" ? prisma.helpOffer : prisma.helpRequest;
}

function resolveListingLoader(kind = "") {
  return kind === "offer" ? listHelpOfferListingViews : listHelpRequestListingViews;
}

function createStatusFilter(status = "") {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized ? { status: normalized } : {};
}

async function loadMineListings({
  kind,
  userId,
  status,
  locale,
  limit,
  offset
}) {
  const listViews = resolveListingLoader(kind);
  const filters = {
    userId,
    limit: limit + 1,
    offset,
    ...createStatusFilter(status)
  };
  const items = await listViews(filters, { locale });
  return {
    items: items.slice(0, limit).map((item) => ({
      ...item,
      isOwn: true
    })),
    nextOffset: items.length > limit ? offset + limit : null
  };
}

async function loadGlobalListingsWithOwnPinned({
  kind,
  userId,
  status,
  locale,
  limit,
  offset
}) {
  const model = resolveModel(kind);
  const listViews = resolveListingLoader(kind);
  const statusFilter = createStatusFilter(status);

  const [ownTotal, othersTotal] = await Promise.all([
    model.count({
      where: {
        userId,
        ...statusFilter
      }
    }),
    model.count({
      where: {
        NOT: {
          userId
        },
        ...statusFilter
      }
    })
  ]);

  const total = ownTotal + othersTotal;
  if (offset >= total) {
    return {
      items: [],
      nextOffset: null
    };
  }

  const pageWithSentinel = limit + 1;
  const ownOffset = offset < ownTotal ? offset : ownTotal;

  let ownItems = [];
  if (ownOffset < ownTotal) {
    ownItems = await listViews(
      {
        userId,
        limit: pageWithSentinel,
        offset: ownOffset,
        ...statusFilter
      },
      { locale }
    );
  }

  const ownNormalized = ownItems.map((item) => ({
    ...item,
    isOwn: true
  }));

  const othersOffset = Math.max(0, offset - ownTotal);
  const remainingSlots = Math.max(0, pageWithSentinel - ownNormalized.length);

  let otherItems = [];
  if (remainingSlots > 0) {
    otherItems = await listViews(
      {
        excludeUserId: userId,
        limit: remainingSlots,
        offset: othersOffset,
        ...statusFilter
      },
      { locale }
    );
  }

  const merged = [
    ...ownNormalized,
    ...otherItems.map((item) => ({
      ...item,
      isOwn: false
    }))
  ];

  const hasMore = offset + limit < total;

  return {
    items: merged.slice(0, limit),
    nextOffset: hasMore ? offset + limit : null
  };
}

export async function GET(request) {
  const auth = await requireUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const kind = normalizeKind(url.searchParams.get("kind"));
  const scope = String(url.searchParams.get("scope") || "global").trim().toLowerCase() === "mine" ? "mine" : "global";
  const locale = String(url.searchParams.get("locale") || "et").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 10));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  if (!kind) {
    return json({ ok: false, message: "HELP_LISTING_KIND_REQUIRED" }, 400);
  }

  const payload =
    scope === "mine"
      ? await loadMineListings({
          kind,
          userId: auth.userId,
          status,
          locale,
          limit,
          offset
        })
      : await loadGlobalListingsWithOwnPinned({
          kind,
          userId: auth.userId,
          status,
          locale,
          limit,
          offset
        });

  return json({
    ok: true,
    kind,
    scope,
    items: payload.items,
    nextOffset: payload.nextOffset
  });
}
