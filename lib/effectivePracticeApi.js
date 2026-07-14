import { errorJson, localeFromRequest } from "./documents/server.js";
import { requireCovisionAuth } from "./covisionApi.js";
import { EFFECTIVE_PRACTICE_PUBLIC_ERRORS } from "./effectivePractices.js";
import { safeError } from "./privacy/safeError.js";

export { requireCovisionAuth as requireEffectivePracticeAuth };

export function effectivePracticeLocale(request) {
  return localeFromRequest(request);
}

export function effectivePracticeErrorResponse(error, locale, context) {
  const messageKey = Object.prototype.hasOwnProperty.call(EFFECTIVE_PRACTICE_PUBLIC_ERRORS, error?.message)
    ? error.message
    : "effective_practices.errors.request_failed";
  const status = EFFECTIVE_PRACTICE_PUBLIC_ERRORS[messageKey] || 500;
  if (status >= 500 && context) console.error(context, safeError(error));
  return errorJson(messageKey, status, locale);
}
