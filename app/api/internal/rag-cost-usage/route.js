import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { logEvent } from "@/lib/chat/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RAG_COST_MIRROR_SECRET = String(process.env.RAG_COST_MIRROR_SECRET || "").trim();

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      message: "Unauthorized"
    },
    { status: 401 }
  );
}

function badRequest(message) {
  return NextResponse.json(
    {
      ok: false,
      message
    },
    { status: 400 }
  );
}

export async function POST(req) {
  const authHeader = String(req.headers.get("authorization") || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!RAG_COST_MIRROR_SECRET || !secureEqual(token, RAG_COST_MIRROR_SECRET)) {
    return unauthorized();
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return badRequest("Invalid JSON payload");
  }

  if (String(payload?.event || "") !== "rag_cost_usage") {
    return badRequest("Unsupported event");
  }

  const eventId = String(payload?.event_id || "").trim();
  const route = String(payload?.route || "").trim();
  const stage = String(payload?.stage || "").trim();
  const serviceRoute = String(payload?.service_route || "").trim();
  const serviceStage = String(payload?.service_stage || "").trim();

  if (!eventId || !route || !stage || !serviceRoute || !serviceStage) {
    return badRequest("Missing required rag cost fields");
  }

  const existing = await prisma.chatLog.findFirst({
    where: {
      event: "rag_cost_usage",
      data: {
        path: ["event_id"],
        equals: eventId
      }
    },
    select: {
      id: true
    }
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      event_id: eventId,
      duplicate: true
    });
  }

  await logEvent("rag_cost_usage", payload);

  return NextResponse.json({
    ok: true,
    event_id: eventId
  });
}
