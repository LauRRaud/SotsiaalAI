import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { licenceCheckAlarms } from "@/lib/mtr/refresh";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* A4 E6 — admini alarmirada.
   Ilma selleta oleks `licenceCheckAlarms` kood, mida keegi ei kutsu: rikkis
   korje näeks välja nagu edukas ja registri kuju muutus jääks märkamata. */
export async function GET(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) return errorJson("api.common.unauthorized", 401, locale);
  if (!isAdmin(session.user)) return errorJson("api.common.forbidden", 403, locale);

  try {
    const now = new Date();
    const alarms = await licenceCheckAlarms({ now });
    return json({
      ok: true,
      counts: {
        schemaDrift: alarms.schemaDrift.length,
        identityUnresolved: alarms.identityUnresolved.length,
        nameMismatch: alarms.nameMismatch.length,
        repeatedFailures: alarms.repeatedFailures.length,
        staleClaims: alarms.staleClaims.length
      },
      /* Registri sisu ei ole isikuandmed, aga vaade jääb siiski kitsaks:
         ainult see, mille pealt admin otsustab, kas midagi on katki. */
      schemaDrift: alarms.schemaDrift.map((row) => ({
        checkId: row.id,
        organizationName: row.providerProfile?.organizationName || null,
        attemptedAt: row.attemptedAt,
        missingOrderedColumns: row.missingOrderedColumns,
        unknownColumns: row.unknownColumns
      })),
      identityUnresolved: alarms.identityUnresolved.map((row) => ({
        checkId: row.id,
        organizationName: row.providerProfile?.organizationName || null,
        registryCode: row.registryCode,
        entityReason: row.entityReason
      })),
      nameMismatch: alarms.nameMismatch.map((row) => ({
        checkId: row.id,
        profileName: row.providerProfile?.organizationName || null,
        registerName: row.entityName,
        registryCode: row.registryCode
      })),
      repeatedFailures: alarms.repeatedFailures.map((row) => ({
        checkId: row.id,
        organizationName: row.providerProfile?.organizationName || null,
        consecutiveFailureCount: row.consecutiveFailureCount,
        licenceReason: row.licenceReason,
        entityReason: row.entityReason
      })),
      staleClaims: alarms.staleClaims.map((row) => ({
        providerServiceId: row.providerServiceId,
        serviceName: row.providerService?.name || null,
        publicStatus: row.publicStatus,
        publicStatusValidUntil: row.publicStatusValidUntil
      }))
    });
  } catch (error) {
    console.error("[mtr-licence-alarms] load failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}
