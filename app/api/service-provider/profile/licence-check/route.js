import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { CHECK_SKIPPED, CHECK_TRIGGER, licenceStatusesForProfile, runLicenceCheck } from "@/lib/mtr/licenceCheckService";
import { requireOwnLicenceProfile, serializeLicenceRows } from "@/lib/mtr/ownProfileLicence";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnLicenceProfile();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const now = new Date();
    const rows = await licenceStatusesForProfile({ providerProfileId: auth.profile.id, now });
    return json({ ok: true, services: serializeLicenceRows(rows, now) });
  } catch (error) {
    console.error("[mtr-licence-check] load failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnLicenceProfile();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const now = new Date();
    const result = await runLicenceCheck({
      providerProfileId: auth.profile.id,
      trigger: CHECK_TRIGGER.MANUAL,
      now
    });

    /* Jahtumisaeg ei ole viga, vaid vastus: ütleme, millal tohib uuesti. */
    if (result.skipped === CHECK_SKIPPED.COOLDOWN) {
      /* `json(data, status)` — teine argument on staatus, MITTE Response init.
         Vale kuju andis siin 500 ja jahtumisaeg oleks paistnud serverivena. */
      const retryAfterSeconds = Math.max(1, Math.ceil((result.retryAfter.getTime() - now.getTime()) / 1000));
      return json(
        { ok: false, skipped: result.skipped, retryAfter: result.retryAfter },
        429,
        { "Retry-After": String(retryAfterSeconds) }
      );
    }

    const rows = await licenceStatusesForProfile({ providerProfileId: auth.profile.id, now });
    return json({
      ok: true,
      /* `completed` ≠ `succeeded`: töö võis lõpuni jõuda ka siis, kui register
         ei vastanud. Liides peab neid eristama. */
      completed: Boolean(result.completed),
      succeeded: Boolean(result.succeeded),
      skipped: result.skipped || null,
      services: serializeLicenceRows(rows, now)
    });
  } catch (error) {
    console.error("[mtr-licence-check] check failed", safeError(error));
    return errorJson("service_provider_profile.errors.save_failed", 500, locale);
  }
}
