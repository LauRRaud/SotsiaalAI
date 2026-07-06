import { NextResponse } from "next/server";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";
import { localizePath } from "@/lib/localizePath";
import {
  extractProviderPaymentId,
  getMaksekeskusSecretKey,
  parseMaksekeskusFormMessage,
  verifyMaksekeskusMac,
} from "@/lib/payments/maksekeskus";

function mapCallbackState(rawStatus) {
  const status = String(rawStatus || "")
    .toLowerCase()
    .trim();
  if (!status) return "pending";
  if (["paid", "success", "succeeded", "completed", "ok"].includes(status)) {
    return "success";
  }
  if (["failed", "error", "declined"].includes(status)) return "failed";
  if (["canceled", "cancelled", "aborted", "expired"].includes(status)) return "canceled";
  if (["pending", "processing", "initiated", "created", "approved"].includes(status)) return "pending";
  return "pending";
}

function pickLocale(url, req, payload = null) {
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale"));
  if (fromQuery) return fromQuery;
  const fromPayload =
    normalizeServerLocale(payload?.customer?.locale) ||
    normalizeServerLocale(payload?.locale);
  if (fromPayload) return fromPayload;
  const fromHeader = normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || "en";
}

function buildTarget(req, locale, paymentState, roomId = "", inviteId = "", ref = "") {
  const target = new URL(localizePath("/vestlus", locale), req.url);
  target.searchParams.set("invitePayment", paymentState);
  if (roomId) target.searchParams.set("roomId", roomId);
  if (inviteId) target.searchParams.set("inviteId", inviteId);
  if (ref) target.searchParams.set("ref", ref);
  return target;
}

export async function GET(req) {
  const url = new URL(req.url);
  const locale = pickLocale(url, req);
  const paymentState = mapCallbackState(
    url.searchParams.get("status") ||
      url.searchParams.get("payment_status") ||
      url.searchParams.get("transaction_status")
  );
  const roomId = String(url.searchParams.get("roomId") || "").trim();
  const inviteId = String(url.searchParams.get("inviteId") || "").trim();
  const ref = String(
    url.searchParams.get("reference") ||
      url.searchParams.get("providerPaymentId") ||
      url.searchParams.get("transaction_id") ||
      ""
  ).trim();

  return NextResponse.redirect(buildTarget(req, locale, paymentState, roomId, inviteId, ref), {
    status: 302,
  });
}

export async function POST(req) {
  const url = new URL(req.url);
  const rawBody = await req.text().catch(() => "");
  const parsed = parseMaksekeskusFormMessage(rawBody);
  const payload = parsed.payload;

  if (!parsed.jsonText || !payload) {
    return NextResponse.redirect(
      buildTarget(
        req,
        pickLocale(url, req),
        "failed",
        String(url.searchParams.get("roomId") || "").trim(),
        String(url.searchParams.get("inviteId") || "").trim()
      ),
      {
        status: 302,
      }
    );
  }

  if (!verifyMaksekeskusMac(parsed.jsonText, parsed.mac, getMaksekeskusSecretKey())) {
    return NextResponse.redirect(
      buildTarget(
        req,
        pickLocale(url, req, payload),
        "failed",
        String(url.searchParams.get("roomId") || "").trim(),
        String(url.searchParams.get("inviteId") || "").trim()
      ),
      {
        status: 302,
      }
    );
  }

  const locale = pickLocale(url, req, payload);
  const paymentState = mapCallbackState(payload?.status || payload?.transaction?.status);
  const roomId = String(url.searchParams.get("roomId") || "").trim();
  const inviteId = String(url.searchParams.get("inviteId") || "").trim();
  const ref = extractProviderPaymentId(payload);

  return NextResponse.redirect(buildTarget(req, locale, paymentState, roomId, inviteId, ref), {
    status: 302,
  });
}
