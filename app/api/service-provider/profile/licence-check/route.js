import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { isAdmin, roleFromSession } from "@/lib/authz";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { CHECK_SKIPPED, CHECK_TRIGGER, licenceStatusesForProfile, runLicenceCheck } from "@/lib/mtr/licenceCheckService";
import { internalLicenceStatus, publicLicenceBadge } from "@/lib/mtr/statusText";
import { getServiceProviderProfileForOwner } from "@/lib/serviceProviderProfiles";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Osutaja näeb AINULT oma profiili loakontrolli. Võõra profiili seis ei ole
   siit kättesaadav ka siis, kui id on teada — profiil leitakse sessiooni
   omaniku järgi, mitte päringu parameetrist. */
async function requireOwnProfile() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return { ok: false, status: 401, message: "api.common.unauthorized" };

  const role = roleFromSession(session);
  if (!isAdmin(session.user) && role !== "SERVICE_PROVIDER") {
    return { ok: false, status: 403, message: "api.common.forbidden" };
  }

  const profile = await getServiceProviderProfileForOwner(userId);
  if (!profile) return { ok: false, status: 404, message: "service_provider_profile.errors.load_failed" };
  return { ok: true, profile };
}

function serialize(rows, now) {
  return rows.map((row) => ({
    serviceId: row.serviceId,
    name: row.name,
    serviceKey: row.serviceKey,
    publicStatus: row.publicStatus,
    publicClaimIsCurrent: row.publicClaimIsCurrent,
    verifiedAt: row.verifiedAt,
    /* Kaks eri vaadet samast seisust: mida avalikkus näeb ja mida osutaja
       näeb. Neid ei tuletata liideses seisu-stringist. */
    badge: publicLicenceBadge({ ...(row.assessment || {}), publicStatus: row.publicStatus, verifiedAt: row.verifiedAt }, { now }),
    internal: internalLicenceStatus(row.assessment, { now }),
    registryCodeUsed: row.assessment?.statusSource?.registryCode || null,
    lastAttemptAt: row.assessment?.lastAttempt?.attemptedAt || null
  }));
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnProfile();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const now = new Date();
    const rows = await licenceStatusesForProfile({ providerProfileId: auth.profile.id, now });
    return json({ ok: true, services: serialize(rows, now) });
  } catch (error) {
    console.error("[mtr-licence-check] load failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnProfile();
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
      return json({ ok: false, skipped: result.skipped, retryAfter: result.retryAfter }, 429);
    }

    const rows = await licenceStatusesForProfile({ providerProfileId: auth.profile.id, now });
    return json({
      ok: true,
      /* `completed` ≠ `succeeded`: töö võis lõpuni jõuda ka siis, kui register
         ei vastanud. Liides peab neid eristama. */
      completed: Boolean(result.completed),
      succeeded: Boolean(result.succeeded),
      skipped: result.skipped || null,
      services: serialize(rows, now)
    });
  } catch (error) {
    console.error("[mtr-licence-check] check failed", safeError(error));
    return errorJson("service_provider_profile.errors.save_failed", 500, locale);
  }
}
