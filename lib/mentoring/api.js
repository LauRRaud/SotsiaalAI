import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import {
  MENTORING_PUBLIC_ERRORS,
  requireMentoringAdmin,
  requireMentoringMember
} from "./shared.js";

export async function requireMentoringMemberAuth() {
  const session = await getServerSession(authConfig).catch(() => null);
  return requireMentoringMember(session);
}

export async function requireMentoringAdminAuth() {
  const session = await getServerSession(authConfig).catch(() => null);
  return requireMentoringAdmin(session);
}

export function mentoringLocale(request) {
  return localeFromRequest(request);
}

export function mentoringErrorResponse(error, locale, context, fallback = "mentoring.errors.request_failed") {
  const status = Number(error?.status) || 500;
  const messageKey = typeof error?.message === "string" ? error.message : "";
  const isPublic = MENTORING_PUBLIC_ERRORS[messageKey] === status
    || messageKey.startsWith("mentoring.errors.")
    || messageKey.startsWith("api.common.");
  if (status >= 500 && context) {
    console.error(context, safeError(error));
  }
  return errorJson(status < 500 && isPublic ? messageKey : fallback, status >= 500 ? 500 : status, locale);
}
