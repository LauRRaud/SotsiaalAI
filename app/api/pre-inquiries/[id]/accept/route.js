import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { getVisiblePreInquiry, serializePreInquiry } from "@/lib/preInquiries";
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

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const inquiry = await getVisiblePreInquiry(auth.userId, await readId(context));
    if (!inquiry) return errorJson("api.common.not_found", 404, locale);
    if (inquiry.recipientOwnerId !== auth.userId) {
      return errorJson("api.common.forbidden", 403, locale);
    }

    const updated = await prisma.preInquiry.update({
      where: { id: inquiry.id },
      data: {
        status: "READY"
      },
      include: {
        recipientEntry: true,
        author: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        recipientOwner: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    return json({
      ok: true,
      inquiry: serializePreInquiry(updated)
    });
  } catch (error) {
    console.error("[pre-inquiries] accept failed", safeError(error));
    return errorJson("pre_inquiries.errors.accept_failed", 500, locale);
  }
}
