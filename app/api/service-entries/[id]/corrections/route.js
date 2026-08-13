import { errorJson, json } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { listEntryCorrections } from "@/lib/serviceLog/entries";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req, context) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_entry_corrections"
  });
  if (response) return response;

  try {
    const { id } = await context.params;
    return json({ corrections: await listEntryCorrections(userId, String(id)) });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale, error.details || {});
    }
    console.error("[service-entry corrections] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
