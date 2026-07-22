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
    okBody: "Sisselogimine jätkus automaatselt aknas, kus sisestasid PIN-koodi. Võid selle akna sulgeda.",
    invalidTitle: "Kinnituslink ei kehti",
    invalidBody: "Link on aegunud või juba kasutatud. Palun alusta sisselogimist uuesti.",
    openLabel: "Ava SotsiaalAI"
  },
  en: {
    okTitle: "Sign-in confirmed",
    okBody: "Sign-in continued automatically in the window where you entered your PIN. You can close this window.",
    invalidTitle: "Confirmation link is invalid",
    invalidBody: "The link has expired or has already been used. Please start sign-in again.",
    openLabel: "Open SotsiaalAI"
  },
  ru: {
    okTitle: "Вход подтвержден",
    okBody: "Вход продолжился автоматически в окне, где вы ввели PIN-код. Это окно можно закрыть.",
    invalidTitle: "Ссылка подтверждения недействительна",
    invalidBody: "Ссылка устарела или уже использована. Начните вход заново.",
    openLabel: "Открыть SotsiaalAI"
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Proxy taga on req.url origin localhost:3000 — avalik link peab minema
// x-forwarded-host/host origini pihta.
function resolvePublicOrigin(requestUrl, headers) {
  const fallback = new URL(requestUrl).origin;
  const forwardedHost = String(headers?.get?.("x-forwarded-host") || "").trim();
  const directHost = String(headers?.get?.("host") || "").trim();
  const forwardedProto = String(headers?.get?.("x-forwarded-proto") || "").trim();
  const resolvedHost = forwardedHost || directHost;
  if (!resolvedHost) return fallback;
  const protocol = forwardedProto || (fallback.startsWith("https://") ? "https" : "http");
  return `${protocol}://${resolvedHost}`;
}

function htmlResponse(locale, ok, homeUrl) {
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
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at 18% 14%, rgba(197,113,113,0.10), transparent 26%),
          radial-gradient(circle at 82% 84%, rgba(122,58,56,0.14), transparent 32%),
          linear-gradient(180deg, #16100e 0%, #251a16 100%);
        color: #e9ded8;
      }
      main {
        width: min(100%, 31rem);
        border-radius: 2rem;
        padding: clamp(2rem, 4vw, 2.4rem);
        background: linear-gradient(180deg, rgba(44,32,28,0.66) 0%, rgba(30,21,19,0.78) 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow:
          0 1.4rem 3.6rem rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(20px) saturate(118%);
        -webkit-backdrop-filter: blur(20px) saturate(118%);
        display: grid;
        justify-items: center;
        gap: 1.1rem;
        text-align: center;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 3vw, 2.2rem);
        line-height: 1.1;
        letter-spacing: 0.02em;
        color: #f0e4de;
        font-weight: 400;
      }
      p {
        margin: 0;
        max-width: 24rem;
        font-size: 1.04rem;
        line-height: 1.56;
        color: ${ok ? "#cdbdb5" : "#e8a3a3"};
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3.4rem;
        min-width: 11rem;
        padding: 0 1.7rem;
        margin-top: 0.4rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.30);
        text-decoration: none;
        background:
          radial-gradient(130% 130% at 18% 14%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 58%),
          linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%);
        color: #f2e9e4;
        font-size: 1.1rem;
        font-weight: 500;
        letter-spacing: 0.02em;
        box-shadow:
          0 0.6rem 1.4rem rgba(0,0,0,0.35),
          inset 0 1px 0 rgba(255,255,255,0.22);
        transition: box-shadow 180ms ease, transform 180ms ease, filter 180ms ease;
      }
      .button:hover,
      .button:focus-visible {
        box-shadow:
          0 0.75rem 1.7rem rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.30);
        outline: none;
        filter: brightness(1.12);
      }
      .button:active { transform: translateY(1px); }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      <a class="button" href="${escapeHtml(homeUrl)}">${escapeHtml(copy.openLabel)}</a>
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
  const homeUrl = `${resolvePublicOrigin(request.url, request.headers)}/`;

  if (!token) return htmlResponse(locale, false, homeUrl);

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

    return htmlResponse(locale, result.count > 0, homeUrl);
  } catch (error) {
    console.error("login-confirm error", safeError(error), { locale });
    return htmlResponse(locale, false, homeUrl);
  }
}
