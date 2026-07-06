import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }
  return {
    ok: true,
    userId
  };
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "jah", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "ei", "off"].includes(normalized)) return false;
  return false;
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        acceptsPreInquiries: true,
        role: true,
        isAdmin: true
      }
    });
    return json({
      ok: true,
      preferences: {
        acceptsPreInquiries: Boolean(user?.acceptsPreInquiries),
        role: user?.role || "CLIENT",
        isAdmin: Boolean(user?.isAdmin || user?.role === "ADMIN")
      }
    });
  } catch (error) {
    console.error("[pre-inquiries] preferences load failed", safeError(error));
    return errorJson("pre_inquiries.errors.preferences_load_failed", 500, locale);
  }
}

export async function PUT(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        acceptsPreInquiries: normalizeBoolean(body.acceptsPreInquiries)
      },
      select: {
        acceptsPreInquiries: true,
        role: true,
        isAdmin: true
      }
    });
    return json({
      ok: true,
      preferences: {
        acceptsPreInquiries: Boolean(user.acceptsPreInquiries),
        role: user.role,
        isAdmin: Boolean(user.isAdmin || user.role === "ADMIN")
      }
    });
  } catch (error) {
    console.error("[pre-inquiries] preferences save failed", safeError(error));
    return errorJson("pre_inquiries.errors.preferences_save_failed", 500, locale);
  }
}
