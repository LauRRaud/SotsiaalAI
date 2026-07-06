export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { DEVICE_COOKIE_NAME } from "@/lib/auth/pin-login";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { prisma } from "@/lib/prisma";

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

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      ok: false,
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  );
}

function localeFromRequest(request, bodyLocale) {
  const direct = normalizeServerLocale(bodyLocale);
  if (direct) return direct;

  const raw = String(request?.headers?.get("accept-language") || "");
  const parts = raw
    .split(",")
    .map(part => part.split(";")[0].trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeServerLocale(part);
    if (normalized) return normalized;
  }

  return "en";
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locale = localeFromRequest(request, body?.locale || body?.lang);

  try {
    const session = await getServerSession(authConfig);
    const userId = session?.user?.id;
    if (!userId) {
      return errorJson("api.common.unauthorized", 401, locale);
    }

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: {
          id: userId
        },
        data: {
          sessionVersion: {
            increment: 1
          }
        }
      });

      await tx.trustedDevice.deleteMany({
        where: {
          userId
        }
      });

      await tx.session.deleteMany({
        where: {
          userId
        }
      });

      await tx.loginTempToken.deleteMany({
        where: {
          userId
        }
      });

      await tx.emailOtpCode.deleteMany({
        where: {
          userId
        }
      });
    });

    const response = json({
      ok: true,
      loggedOutEverywhere: true
    });

    response.cookies.set(DEVICE_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error("profile logout-all error", error);
    return errorJson("profile.logout_all_failed", 500, locale);
  }
}
