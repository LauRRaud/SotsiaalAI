/**
 * TEENUSPÄEVIK-V1 E2 — üksiku teenuskirje muutmine ja kustutamine.
 *
 * DELETE vastab 409-ga, kui säilitusaeg ei ole täis. See on AINUS koht selles
 * moodulis, kus vastus ei ole 404: kasutaja näeb kirjet ja tal on õigus teada,
 * miks ta seda kustutada ei saa (vt lib/serviceLog/errors.js).
 */
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { roleFromSession } from "@/lib/authz";
import { errorJson, json } from "@/lib/documents/server";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { deleteEntry, updateEntry } from "@/lib/serviceLog/entries";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 60;

async function requireProviderUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };
  if (roleFromSession(session) !== "SERVICE_PROVIDER") {
    return { ok: false, status: 403, message: "api.common.forbidden" };
  }
  return { ok: true, userId };
}

function respondToError(error, route) {
  if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
    return errorJson(error.messageKey, error.status);
  }
  console.error(...safeError(`[${route}] unexpected`, error));
  return errorJson("api.common.server_error", 500);
}

async function guard(req, scope) {
  /* VÄRAV ON ESIMENE, ENNE AUTENTIMIST JA ROLLI.
     Kui ta oleks pärast, annaks suletud pind anonüümsele 401 ja valele rollile
     403 — mõlemad ütlevad „see asi on olemas, ainult sina ei pääse ligi".
     Suletud värav peab olema eristamatu olematust marsruudist. */
  if (!isServiceLogEnabled()) {
    return { response: errorJson("service_log.errors.not_found", 404) };
  }

  const auth = await requireProviderUser();
  if (!auth.ok) return { response: errorJson(auth.message, auth.status) };
  const limited = enforceChatRateLimit(req, {
    scope,
    userId: auth.userId,
    limit: MUTATION_LIMIT,
    windowMs: RATE_LIMIT_WINDOW_MS
  });
  if (limited) return { response: limited };
  return { auth };
}

export async function PATCH(req, context) {
  const { response, auth } = await guard(req, "service_entries_patch");
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorJson("service_log.errors.invalid_input", 400);
    }
    const entry = await updateEntry(auth.userId, String(id), body);
    return json({ entry });
  } catch (error) {
    return respondToError(error, "service-entries PATCH");
  }
}

export async function DELETE(req, context) {
  const { response, auth } = await guard(req, "service_entries_delete");
  if (response) return response;

  try {
    const { id } = await context.params;
    const result = await deleteEntry(auth.userId, String(id));
    return json(result);
  } catch (error) {
    return respondToError(error, "service-entries DELETE");
  }
}
