export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  claimVerificationTokenRow,
  createVerificationTokenSecret,
  verificationTokenLookupValues
} from "@/lib/auth/verificationTokens";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";
import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";

const TOKEN_EXPIRY_HOURS = Number(process.env.EMAIL_VERIFY_HOURS || 24);
const VERIFY_RATE_LIMIT_WINDOW_MS = Number(
  process.env.VERIFY_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000
);
const VERIFY_RATE_LIMIT_PER_IP = Number(process.env.VERIFY_RATE_LIMIT_PER_IP || 30);
const VERIFY_RATE_LIMIT_PER_EMAIL = Number(
  process.env.VERIFY_RATE_LIMIT_PER_EMAIL || 5
);
const EMAIL_VERIFY_IDENTIFIER_PREFIX = "email-verify:";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

const mailer = getMailer("email-verify");
const VERIFY_PAGE_COPY = {
  et: {
    title: "Kinnita e-post",
    intro: "Konto aktiveerimiseks kinnita oma e-posti aadress alloleva nupuga.",
    confirm: "Kinnitan",
    successTitle: "E-post on kinnitatud",
    successBody: "Võid nüüd jätkata tellimuse aktiveerimise või sisselogimisega.",
    continueLabel: "Jätka"
  },
  en: {
    title: "Confirm your email address",
    intro: "To activate your account, confirm your email address using the button below.",
    confirm: "Confirm email",
    successTitle: "Email confirmed",
    successBody: "You can now continue to subscription activation or sign in.",
    continueLabel: "Continue"
  },
  ru: {
    title: "Подтвердите email",
    intro: "Чтобы активировать аккаунт, подтвердите email кнопкой ниже.",
    confirm: "Подтвердить email",
    successTitle: "Email подтверждён",
    successBody: "Теперь можно продолжить активацию подписки или войти.",
    continueLabel: "Продолжить"
  }
};

VERIFY_PAGE_COPY.et.successBody = "Võid nüüd jätkata platvormile sisenemisega.";
VERIFY_PAGE_COPY.et.continueLabel = "Jätka";
VERIFY_PAGE_COPY.en.successBody = "You can now continue to the platform and sign in.";
VERIFY_PAGE_COPY.ru = {
  title: "Подтвердите email",
  intro: "Чтобы активировать аккаунт, подтвердите email с помощью кнопки ниже.",
  confirm: "Подтвердить email",
  successTitle: "Email подтвержден",
  successBody: "Теперь можно продолжить и войти на платформу.",
  continueLabel: "Продолжить"
};

// Auto-kinnituse tekst (leht kinnitab kohe ise; nupp on JS-ita varuks).
VERIFY_PAGE_COPY.et.autoConfirming = "Kinnitame su e-posti aadressi…";
VERIFY_PAGE_COPY.en.autoConfirming = "Confirming your email address…";
VERIFY_PAGE_COPY.ru.autoConfirming = "Подтверждаем ваш адрес электронной почты…";

function json(payload = {}, status = 200) {
  return NextResponse.json(
    {
      ok: status < 400,
      ...payload
    },
    {
      status,
      headers: NO_STORE_HEADERS
    }
  );
}

function errorJson(messageKey, status = 400, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json(
    {
      messageKey,
      message: translated,
      error: translated,
      ...extras
    },
    status
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getVerifyCopy(locale) {
  return VERIFY_PAGE_COPY[locale] || VERIFY_PAGE_COPY.en;
}

function renderVerifyPage({
  locale,
  title,
  body,
  actionLabel,
  actionUrl,
  isError = false,
  postForm = null
}) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const hasBody = Boolean(safeBody);

  // postForm: POST-vorm + auto-submit skript (real brauser POST-ib kohe ise →
  // kasutaja ei pea "Kinnitan" nupule vajutama). Bot/skanner ei käivita JS-i
  // ega POST-i → ei kinnita kogemata; JS-ita kasutajale jääb nähtav nupp.
  const actionMarkup = postForm
    ? `<form id="verify-confirm-form" method="POST" action="${escapeHtml(
        postForm.action
      )}">${Object.entries(postForm.fields)
        .map(
          ([key, value]) =>
            `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(
              String(value)
            )}" />`
        )
        .join(
          ""
        )}<button class="button" type="submit">${safeActionLabel}</button></form><script>try{document.getElementById("verify-confirm-form").submit();}catch(e){}</script>`
    : `<a class="button" href="${safeActionUrl}">${safeActionLabel}</a>`;

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
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at 18% 14%, rgba(255,255,255,0.05), transparent 26%),
          radial-gradient(circle at 82% 84%, rgba(255,255,255,0.03), transparent 32%),
          linear-gradient(180deg, #0d0d0d 0%, #161616 100%);
        color: #e4e4e4;
      }
      .card {
        width: min(100%, 31rem);
        border-radius: 2rem;
        padding: clamp(2rem, 4vw, 2.4rem);
        background: linear-gradient(180deg, rgba(34,34,34,0.66) 0%, rgba(23,23,23,0.78) 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow:
          0 1.4rem 3.6rem rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(20px) saturate(118%);
        -webkit-backdrop-filter: blur(20px) saturate(118%);
      }
      .card--compact {
        padding-top: clamp(2.15rem, 4vw, 2.55rem);
        padding-bottom: clamp(2.15rem, 4vw, 2.55rem);
      }
      .stack {
        display: grid;
        justify-items: center;
        gap: 1.1rem;
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 3vw, 2.3rem);
        line-height: 1.08;
        text-align: center;
        letter-spacing: 0.02em;
        color: #e6e6e6;
        text-shadow: 0 0.18rem 0.44rem rgba(0,0,0,0.35);
        font-family: Arial, sans-serif;
        font-weight: 400;
      }
      p {
        margin: 0;
        max-width: 24rem;
        font-size: 1.04rem;
        line-height: 1.56;
        color: ${isError ? "#e8a3a3" : "#c4c4c4"};
        text-align: center;
      }
      .actions {
        display: flex;
        justify-content: center;
        padding-top: ${hasBody ? "0.5rem" : "0.9rem"};
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3.55rem;
        min-width: 11.75rem;
        padding: 0 1.7rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, ${isError ? "0.22" : "0.30"});
        text-decoration: none;
        background: ${
          isError
            ? "linear-gradient(180deg, rgba(122,50,48,0.55) 0%, rgba(84,32,30,0.60) 100%)"
            : "radial-gradient(130% 130% at 18% 14%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 58%), linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)"
        };
        color: ${isError ? "#f0c9c9" : "#ececec"};
        font-size: 1.14rem;
        font-weight: 500;
        line-height: 1.1;
        letter-spacing: 0.02em;
        box-shadow:
          0 0.6rem 1.4rem rgba(0,0,0,0.35),
          inset 0 1px 0 rgba(255,255,255,0.22);
        transition: box-shadow 180ms ease, transform 180ms ease, filter 180ms ease;
        backdrop-filter: blur(12px) saturate(118%);
        -webkit-backdrop-filter: blur(12px) saturate(118%);
      }
      .button:hover,
      .button:focus-visible {
        box-shadow:
          0 0.75rem 1.7rem rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.30);
        outline: none;
        filter: brightness(1.12);
      }
      .button:active {
        transform: translateY(1px);
      }
    </style>
  </head>
  <body>
    <main class="card${hasBody ? "" : " card--compact"}">
      <div class="stack">
        <h1>${safeTitle}</h1>
        ${hasBody ? `<p>${safeBody}</p>` : ""}
        <div class="actions">
          ${actionMarkup}
        </div>
      </div>
    </main>
  </body>
</html>`,
    {
      status: isError ? 400 : 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...NO_STORE_HEADERS
      }
    }
  );
}

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function buildEmailVerifyIdentifier(email) {
  return `${EMAIL_VERIFY_IDENTIFIER_PREFIX}${normalizeEmail(email)}`;
}

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

function buildVerifyUrl(email, token, locale) {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("api.auth.verify.base_url_missing");
  }

  const params = new URLSearchParams({ email, token });
  if (locale) params.set("locale", locale);

  return `${baseUrl.replace(/\/$/, "")}/api/verify-email?${params.toString()}`;
}

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

function buildHomeUrl({ requestUrl, locale, headers }) {
  const redirectBase = resolvePublicOrigin(requestUrl, headers);
  return new URL(localizePath("/", locale), redirectBase);
}

function buildPostVerifyUrl({ requestUrl, locale, headers }) {
  const url = buildHomeUrl({ requestUrl, locale, headers });
  url.searchParams.set("reason", "email-verified");
  return url;
}

async function confirmVerification({ email, token }) {
  if (!email || !token) {
    return {
      ok: false,
      status: 400,
      messageKey: "api.auth.verify.invalid_link",
      code: "INVALID_LINK"
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.emailVerified) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: buildEmailVerifyIdentifier(email) }
    });
    return { ok: true, alreadyVerified: true };
  }

  const prefixedIdentifier = buildEmailVerifyIdentifier(email);
  // The link carries the raw secret; the row carries its hash. `identifier: email`
  // is the pre-prefix legacy namespace and stays a lookup candidate.
  const lookupValues = verificationTokenLookupValues(token);
  const verificationToken = lookupValues.length
    ? await prisma.verificationToken.findFirst({
        where: {
          token: { in: lookupValues },
          identifier: { in: [prefixedIdentifier, email] }
        }
      })
    : null;

  if (!verificationToken) {
    return {
      ok: false,
      status: 400,
      messageKey: "api.auth.verify.link_invalid_or_used",
      code: "INVALID_LINK"
    };
  }

  if (verificationToken.expires < new Date()) {
    await claimVerificationTokenRow({
      db: prisma,
      identifier: verificationToken.identifier,
      token: verificationToken.token
    });
    return {
      ok: false,
      status: 410,
      messageKey: "api.auth.verify.link_expired",
      code: "LINK_EXPIRED"
    };
  }

  if (!user) {
    await claimVerificationTokenRow({
      db: prisma,
      identifier: verificationToken.identifier,
      token: verificationToken.token
    });
    return {
      ok: false,
      status: 404,
      messageKey: "api.auth.verify.user_not_found",
      code: "USER_NOT_FOUND"
    };
  }

  // The claim decides, and it comes before the effect: a second confirmation of
  // the same link blocks on the row lock and then writes nothing.
  let claimed = false;
  await prisma.$transaction(async (tx) => {
    claimed = await claimVerificationTokenRow({
      db: tx,
      identifier: verificationToken.identifier,
      token: verificationToken.token
    });
    if (!claimed) return;

    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() }
    });
    // NB: deleteMany filter ei tunne identifier_token liitselektorit
    // (see on findUnique/delete where-sisend) — kasuta tavalisi väljafiltreid.
    await tx.verificationToken.deleteMany({
      where: {
        identifier: { in: [prefixedIdentifier, email] }
      }
    });
  });

  if (!claimed) {
    return {
      ok: false,
      status: 400,
      messageKey: "api.auth.verify.link_invalid_or_used",
      code: "INVALID_LINK"
    };
  }

  return { ok: true, alreadyVerified: false };
}

async function sendVerificationEmail(to, verifyUrl, locale) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    throw new Error("api.auth.verify.email_from_missing");
  }

  const info = await mailer.sendMail({
    to,
    from,
    subject: serverT(locale, "email.auth.verify.subject"),
    text: serverT(locale, "email.auth.verify.text", { verifyUrl }),
    html: serverT(locale, "email.auth.verify.html", { verifyUrl })
  });

  if (info?.message && process.env.NODE_ENV !== "production") {
    console.info("[email-verify] mock email message", info.message.toString());
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const locale = localeFromRequest(request, url.searchParams.get("locale"));
  const copy = getVerifyCopy(locale);
  const email = normalizeEmail(url.searchParams.get("email"));
  const token = String(url.searchParams.get("token") || "").trim();
  const wantsConfirm = url.searchParams.get("confirm") === "1";

  try {
    if (!wantsConfirm) {
      if (!email || !token) {
        return renderVerifyPage({
          locale,
          title: copy.title,
          body: serverT(locale, "api.auth.verify.invalid_link", undefined, copy.intro),
          actionLabel: copy.continueLabel,
          actionUrl: buildHomeUrl({ requestUrl: request.url, locale, headers: request.headers }).toString(),
          isError: true
        });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.emailVerified) {
        return NextResponse.redirect(buildPostVerifyUrl({ requestUrl: request.url, locale, headers: request.headers }));
      }

      // Auto-kinnitus: leht POST-ib kohe ise (JS) → e-post kinnitatakse ilma
      // et kasutaja peaks eraldi "Kinnitan" nupule vajutama. See oli 23.07
      // päris-testi UX-lõks (kasutaja klõpsas meililingi, aga jättis 2. sammu
      // tegemata). Vana GET-põhine confirm=1 rada jääb tagavaraks alles.
      return renderVerifyPage({
        locale,
        title: copy.title,
        body: copy.autoConfirming,
        actionLabel: copy.confirm,
        actionUrl: "",
        postForm: {
          action: new URL(request.url).pathname,
          fields: {
            email,
            token,
            locale: locale || "",
            intent: "confirm"
          }
        }
      });
    }

    const result = await confirmVerification({ email, token });
    if (!result.ok) {
      return renderVerifyPage({
        locale,
        title: copy.title,
        body: serverT(locale, result.messageKey, undefined, copy.intro),
        actionLabel: copy.continueLabel,
        actionUrl: buildHomeUrl({ requestUrl: request.url, locale, headers: request.headers }).toString(),
        isError: true
      });
    }

    return NextResponse.redirect(buildPostVerifyUrl({ requestUrl: request.url, locale, headers: request.headers }));
  } catch (error) {
    console.error("verify-email GET error", safeError(error));
    return renderVerifyPage({
      locale,
      title: copy.title,
      body: serverT(
        locale,
        "api.auth.verify.confirm_failed",
        undefined,
        copy.successBody
      ),
      actionLabel: copy.continueLabel,
      actionUrl: buildHomeUrl({ requestUrl: request.url, locale, headers: request.headers }).toString(),
      isError: true
    });
  }
}

export async function POST(request) {
  // Auto-kinnituse vorm saadab form-data; resend-API (LoginModal/registreerimine)
  // saadab JSON-i. Loeme kehatüübi järgi.
  const contentType = String(request.headers.get("content-type") || "");
  let body = {};
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      body = {};
    }
  } else {
    body = await request.json().catch(() => ({}));
  }
  const locale = localeFromRequest(request, body?.locale);

  // Auto-kinnituse rada: verify-lehe vorm (JS auto-submit VÕI käsitsi nupp).
  // Eristub resend-POST-ist intent-välja järgi → kinnita e-post ja suuna
  // koju (Post/Redirect/Get 303).
  if (body?.intent === "confirm") {
    const copy = getVerifyCopy(locale);
    try {
      const email = normalizeEmail(body?.email);
      const token = String(body?.token || "").trim();
      const result = await confirmVerification({ email, token });
      if (!result.ok) {
        return renderVerifyPage({
          locale,
          title: copy.title,
          body: serverT(locale, result.messageKey, undefined, copy.intro),
          actionLabel: copy.continueLabel,
          actionUrl: buildHomeUrl({ requestUrl: request.url, locale, headers: request.headers }).toString(),
          isError: true
        });
      }
      return NextResponse.redirect(
        buildPostVerifyUrl({ requestUrl: request.url, locale, headers: request.headers }),
        303
      );
    } catch (error) {
      console.error("verify-email POST confirm error", safeError(error));
      return renderVerifyPage({
        locale,
        title: copy.title,
        body: serverT(locale, "api.auth.verify.confirm_failed", undefined, copy.successBody),
        actionLabel: copy.continueLabel,
        actionUrl: buildHomeUrl({ requestUrl: request.url, locale, headers: request.headers }).toString(),
        isError: true
      });
    }
  }

  try {
    const email = normalizeEmail(body?.email);
    const ip = getRequestIpFromRequest(request);

    const ipLimit = consumeRateLimit(
      `verify-post:ip:${ip}`,
      VERIFY_RATE_LIMIT_PER_IP,
      VERIFY_RATE_LIMIT_WINDOW_MS
    );
    if (!ipLimit.allowed) {
      return errorJson("api.auth.verify.rate_limited", 429, locale, {
        code: "RATE_LIMITED"
      });
    }

    if (email) {
      const emailLimit = consumeRateLimit(
        `verify-post:email:${email}`,
        VERIFY_RATE_LIMIT_PER_EMAIL,
        VERIFY_RATE_LIMIT_WINDOW_MS
      );
      if (!emailLimit.allowed) {
        return errorJson("api.auth.verify.rate_limited", 429, locale, {
          code: "RATE_LIMITED"
        });
      }
    }

    if (!email || !email.includes("@")) {
      return errorJson("api.auth.verify.invalid_email", 400, locale, {
        code: "INVALID_EMAIL"
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return json();
    }

    // raw goes into the link, stored goes into the row — never the reverse.
    const { raw: token, stored } = createVerificationTokenSecret();
    const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const identifier = buildEmailVerifyIdentifier(email);

    await prisma.verificationToken.create({
      data: {
        identifier,
        token: stored,
        expires
      }
    });

    const verifyUrl = buildVerifyUrl(email, token, locale);
    await sendVerificationEmail(email, verifyUrl, locale);
    await prisma.verificationToken.deleteMany({
      where: {
        identifier,
        NOT: { token: stored }
      }
    });

    try {
      await prisma.user.update({
        where: { email },
        data: { emailVerificationSentAt: new Date() }
      });
    } catch {
      // do not fail if metadata update fails
    }

    return json();
  } catch (error) {
    console.error("verify-email POST error", safeError(error));

    if (
      typeof error?.message === "string" &&
      error.message.startsWith("api.auth.verify.")
    ) {
      return errorJson(error.message, 500, locale, {
        code: "VERIFY_CONFIG_ERROR"
      });
    }

    return errorJson("api.auth.verify.send_failed", 500, locale, {
      code: "VERIFY_SEND_FAILED"
    });
  }
}
