export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";
import { getMailer } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { confirmEmailChangeByToken } from "@/lib/profile/emailChange";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const CONFIRM_RATE_LIMIT_WINDOW_MS = Number(
  process.env.EMAIL_CHANGE_CONFIRM_RATE_WINDOW_MS || 60 * 60 * 1000
);
const CONFIRM_RATE_LIMIT_PER_IP = Number(
  process.env.EMAIL_CHANGE_CONFIRM_RATE_PER_IP || 60
);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function localeFromRequest(request, directLocale) {
  const direct = normalizeServerLocale(directLocale);
  if (direct) return direct;

  const raw = String(request?.headers?.get("accept-language") || "");
  const parts = raw
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeServerLocale(part);
    if (normalized) return normalized;
  }
  return "en";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage({ locale, title, body, actionLabel, actionUrl, isError = false }) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);

  return new NextResponse(
    `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background: linear-gradient(180deg, #0d0d0d 0%, #161616 100%); color: #e4e4e4;
      }
      .card {
        width: min(100%, 31rem); border-radius: 2rem; padding: clamp(2rem, 4vw, 2.4rem);
        background: linear-gradient(180deg, rgba(34,34,34,0.66) 0%, rgba(23,23,23,0.78) 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 1.4rem 3.6rem rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(20px) saturate(118%); -webkit-backdrop-filter: blur(20px) saturate(118%);
      }
      .stack { display: grid; justify-items: center; gap: 1.1rem; }
      h1 { margin: 0; font-size: clamp(2rem, 3vw, 2.3rem); line-height: 1.08; text-align: center; color: #e6e6e6; font-weight: 400; }
      p { margin: 0; max-width: 24rem; font-size: 1.04rem; line-height: 1.56; color: ${isError ? "#e8a3a3" : "#c4c4c4"}; text-align: center; }
      .actions { display: flex; justify-content: center; padding-top: 0.5rem; }
      .button {
        display: inline-flex; align-items: center; justify-content: center; min-height: 3.4rem; min-width: 11rem;
        padding: 0 1.7rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.30); text-decoration: none;
        background: radial-gradient(130% 130% at 18% 14%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 58%), linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%);
        color: #ececec; font-size: 1.12rem; font-weight: 500; letter-spacing: 0.02em;
        box-shadow: 0 0.6rem 1.4rem rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.22);
      }
      .button:hover, .button:focus-visible { outline: none; filter: brightness(1.02); }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="stack">
        <h1>${safeTitle}</h1>
        ${safeBody ? `<p>${safeBody}</p>` : ""}
        <div class="actions"><a class="button" href="${safeActionUrl}">${safeActionLabel}</a></div>
      </div>
    </main>
  </body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE_HEADERS }
    }
  );
}

// Security notice to the OLD address after a successful email change. Carries no
// PIN, token or the new address — only that a change occurred and how to react.
async function sendEmailChangedNotice(oldEmail, locale) {
  if (!oldEmail) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) return;

  const mailer = getMailer("email-changed-notice");
  await mailer.sendMail({
    to: oldEmail,
    from,
    subject: serverT(locale, "email.account.email_changed_notice.subject"),
    text: serverT(locale, "email.account.email_changed_notice.text"),
    html: serverT(locale, "email.account.email_changed_notice.html")
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const locale = localeFromRequest(request, url.searchParams.get("locale"));
  const token = String(url.searchParams.get("token") || "").trim();
  const loginUrl = new URL(localizePath("/vestlus", locale), url.origin);
  loginUrl.searchParams.set("login", "1");
  loginUrl.searchParams.set("reason", "email-changed");
  const continueLabel = serverT(locale, "profile.email_update.confirm_page.continue");

  const genericError = () =>
    renderPage({
      locale,
      title: serverT(locale, "profile.email_update.confirm_page.error_title"),
      body: serverT(locale, "profile.email_update.confirm_page.error_body"),
      actionLabel: continueLabel,
      actionUrl: loginUrl.toString(),
      isError: true
    });

  try {
    const ip = getRequestIpFromRequest(request);
    const ipLimit = consumeRateLimit(
      `email-change-confirm:ip:${ip}`,
      CONFIRM_RATE_LIMIT_PER_IP,
      CONFIRM_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return genericError();
    }

    if (!token) {
      return genericError();
    }

    const result = await confirmEmailChangeByToken({ db: prisma, token });
    if (!result.ok) {
      // invalid / expired / foreign / competing token: one generic page, no leak
      return genericError();
    }

    try {
      await sendEmailChangedNotice(result.oldEmail, locale);
    } catch (sendError) {
      // The security notice failing must not roll back a completed change.
      console.error("email-change notice send failed", safeError(sendError));
    }

    return renderPage({
      locale,
      title: serverT(locale, "profile.email_update.confirm_page.success_title"),
      body: serverT(locale, "profile.email_update.confirm_page.success_body"),
      actionLabel: continueLabel,
      actionUrl: loginUrl.toString()
    });
  } catch (error) {
    console.error("email-change confirm error", safeError(error));
    return genericError();
  }
}
