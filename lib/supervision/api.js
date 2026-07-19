import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import {
  SUPERVISION_PUBLIC_ERRORS,
  requireSupervisionAdmin,
  requireSupervisionMember,
  requireSupervisionUser
} from "./shared.js";

async function loadSession() {
  return getServerSession(authConfig).catch(() => null);
}

/**
 * Toores sessioon teenusekihile (teenusefunktsioonid teevad auth-i ise:
 * requireSupervisionUser/Member viskavad 401/403). Detail-/muteerimisrajad
 * annavad selle otse edasi.
 */
export async function getSupervisionSession() {
  return loadSession();
}

/** Autenditud kasutaja ILMA rolliväravata — detail-/skoobitud rajad (404-norm). */
export async function requireSupervisionUserAuth() {
  return requireSupervisionUser(await loadSession());
}

/** Liikmeroll SW/SP värav — loend/loomine (403 mitte-liikmele). */
export async function requireSupervisionMemberAuth() {
  return requireSupervisionMember(await loadSession());
}

/** Admin-värav grant-haldusele (404-norm mitte-adminile). */
export async function requireSupervisionAdminAuth() {
  return requireSupervisionAdmin(await loadSession());
}

export function supervisionLocale(request) {
  return localeFromRequest(request);
}

/**
 * Ühtne veavastus. Avalikud (<500) veakoodid antakse edasi ainult siis, kui
 * need on allowlistis või supervision./api.common. nimeruumis; muidu üldine
 * fallback. 5xx logitakse safeError'iga (ei leki stacki/sisu).
 */
export function supervisionErrorResponse(error, locale, context, fallback = "supervision.errors.request_failed") {
  const status = Number(error?.status) || 500;
  const messageKey = typeof error?.message === "string" ? error.message : "";
  const isPublic =
    SUPERVISION_PUBLIC_ERRORS[messageKey] === status ||
    messageKey.startsWith("supervision.errors.") ||
    messageKey.startsWith("api.common.");
  if (status >= 500 && context) {
    console.error(context, safeError(error));
  }
  return errorJson(status < 500 && isPublic ? messageKey : fallback, status >= 500 ? 500 : status, locale);
}
