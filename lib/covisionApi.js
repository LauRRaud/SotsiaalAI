import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionRole } from "@/lib/covision";
import { safeError } from "@/lib/privacy/safeError";

export async function requireCovisionAuth() {
  const session = await getServerSession(authConfig).catch(() => null);
  return requireCovisionRole(session);
}

export function covisionLocale(request) {
  return localeFromRequest(request);
}

function isMissingTableError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "P2021" ||
    message.includes("does not exist in the current database") ||
    /relation\s+["`']?.*["`']?\s+does not exist/i.test(message)
  );
}

export function covisionErrorResponse(error, locale, context, fallback = "covision.errors.request_failed") {
  const missingTable = isMissingTableError(error);
  const status = missingTable ? 503 : Number(error?.status) || 500;
  if (status >= 500 && context) {
    console.error(context, safeError(error));
  }
  const messageKey = status >= 500
    ? missingTable
      ? "covision.errors.schema_missing"
      : fallback
    : error?.message || fallback;
  return errorJson(messageKey, status, locale);
}
