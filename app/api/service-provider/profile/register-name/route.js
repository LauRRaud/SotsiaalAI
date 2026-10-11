import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { checkRegisterName, registerNamesMeta } from "@/lib/businessRegisterNames";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { consumeServiceProviderProfileRateLimit } from "@/lib/serviceProviderProfileBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Teenuseprofiili vormi nimekontroll: kas kirjutatud nimi vastab äriregistrile.
   POST { registryCode, organizationName } → { result, registerName, registerDate }.
   Midagi ei muuda. Keha, mitte aadressirida: registrikoodita profiili nimi võib olla inimese nimi.
   Sama kontrolli teeb server uuesti kinnitamisel ja avaldamisel; see vastus on ainult vormile. */
const MAX_CODE_LENGTH = 40;
const MAX_NAME_LENGTH = 300;

async function requireProvider() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };
  if (!isAdmin(session.user) && roleFromSession(session) !== "SERVICE_PROVIDER") {
    return { ok: false, status: 403, message: "api.common.forbidden" };
  }
  return { ok: true, userId };
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireProvider();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);
  try {
    const limit = await consumeServiceProviderProfileRateLimit({ operation: "register:lookup", userId: auth.userId });
    if (!limit.allowed) {
      return errorJson("api.common.rate_limited", 429, locale, { retryAfterSeconds: limit.retryAfterSeconds }, {
        "Retry-After": String(limit.retryAfterSeconds)
      });
    }
    const body = await request.json().catch(() => ({}));
    const [check, meta] = await Promise.all([
      checkRegisterName({
        registryCode: String(body?.registryCode ?? "").slice(0, MAX_CODE_LENGTH),
        organizationName: String(body?.organizationName ?? "").slice(0, MAX_NAME_LENGTH)
      }),
      registerNamesMeta()
    ]);
    return json({
      ok: true,
      result: check.result,
      registerName: check.registerName,
      /* Registri seis, mille vastu kontrolliti: uus või ümber nimetatud asutus võib failist puududa. */
      registerDate: meta?.sourceLastModified || meta?.builtAt || null
    });
  } catch (error) {
    console.error("[service-provider-register-name] check failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}
