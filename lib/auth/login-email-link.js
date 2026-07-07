import { getMailer, resolveBaseUrl } from "@/lib/mailer";
import { serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
import { OTP_TTL_MINUTES } from "@/lib/auth/pin-login";

function getRequestBaseUrl(request) {
  const configured = resolveBaseUrl();
  if (configured) return configured.replace(/\/+$/g, "");

  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host");
  if (!host) return "";
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/g, "");
}

export function buildLoginConfirmUrl(request, token, locale) {
  const baseUrl = getRequestBaseUrl(request);
  const url = new URL("/api/auth/login-confirm", baseUrl || "http://localhost:3000");
  url.searchParams.set("token", token);
  if (locale) url.searchParams.set("locale", locale);
  return url.toString();
}

export async function sendLoginLinkEmail(email, confirmUrl, locale) {
  const mailer = getMailer("login-link");
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    console.info("[login-link][dev] generated login confirmation link", {
      email,
      confirmUrl
    });
  }

  if (!from) {
    if (isDev) return;
    throw new Error("api.auth.login.email_from_missing");
  }

  const values = {
    confirmUrl,
    minutes: OTP_TTL_MINUTES
  };

  try {
    if (!isDev) {
      await mailer.sendMail({
        to: email,
        from,
        subject: serverT(locale, "email.auth.login_link.subject", values),
        text: serverT(locale, "email.auth.login_link.text", values),
        html: serverT(locale, "email.auth.login_link.html", values)
      });
    }
  } catch (error) {
    console.error("[login-link] send failed", safeError(error));
    if (!isDev) throw error;
  }
}
