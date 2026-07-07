export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/auth/pin-login";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};

const COPY = {
  et: {
    okTitle: "Sisenemine kinnitatud",
    okBody: "Võid selle akna sulgeda ja naasta SotsiaalAI aknasse.",
    invalidTitle: "Kinnituslink ei kehti",
    invalidBody: "Link on aegunud või juba kasutatud. Palun alusta sisselogimist uuesti."
  },
  en: {
    okTitle: "Sign-in confirmed",
    okBody: "You can close this window and return to the SotsiaalAI window.",
    invalidTitle: "Confirmation link is invalid",
    invalidBody: "The link has expired or has already been used. Please start sign-in again."
  },
  ru: {
    okTitle: "Вход подтвержден",
    okBody: "Можно закрыть это окно и вернуться в окно SotsiaalAI.",
    invalidTitle: "Ссылка подтверждения недействительна",
    invalidBody: "Ссылка устарела или уже использована. Начните вход заново."
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlResponse(locale, ok) {
  const copy = COPY[locale] || COPY.et;
  const title = ok ? copy.okTitle : copy.invalidTitle;
  const body = ok ? copy.okBody : copy.invalidBody;
  return new NextResponse(`<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#17120f;color:#fff4e8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:34rem;padding:2rem;text-align:center}
      h1{font-size:1.6rem;font-weight:600;margin:0 0 .8rem}
      p{font-size:1rem;line-height:1.55;color:rgba(255,244,232,.78);margin:0}
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
    </main>
  </body>
</html>`, {
    status: ok ? 200 : 400,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const locale = normalizeServerLocale(url.searchParams.get("locale")) || "et";

  if (!token) return htmlResponse(locale, false);

  try {
    const now = new Date();
    const result = await prisma.loginTempToken.updateMany({
      where: {
        emailLinkTokenHash: hashOpaqueToken(token),
        requiresOtp: true,
        otpVerifiedAt: null,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        otpVerifiedAt: now,
        emailLinkTokenHash: null
      }
    });

    return htmlResponse(locale, result.count > 0);
  } catch (error) {
    console.error("login-confirm error", safeError(error), { locale });
    return htmlResponse(locale, false);
  }
}
