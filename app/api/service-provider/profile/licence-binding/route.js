import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { licenceStatusesForProfile } from "@/lib/mtr/licenceCheckService";
import { requireOwnLicenceProfile, serializeLicenceRows } from "@/lib/mtr/ownProfileLicence";
import { BINDING_ERROR, bindOwnServiceKey, ownBindingOverview } from "@/lib/mtr/serviceBinding";
import { safeError } from "@/lib/privacy/safeError";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* A4 — osutaja kinnitab OMA teenuse liigi (omanik 10.10.2026: „alguses inimene
   ise kinnitab või paneb kontrolli tööle"). Kinnitus käivitab kohe esimese
   kontrolli; edasi kordab seda öine korje umbes kord kuus.

   Kinnitus EI OLE tõend: tõend on registri vastus. Osutaja ütleb ainult, MIDA
   kontrollida, ja valida saab ainult loakohustuslike liikide seast. */

/* Iga muudatus käivitab kuus päringut võõrasse registrisse (mõõdetud 30 s kuni
   2 min). Tavaline osutaja kinnitab liigi iga teenuse kohta ühe korra ja suurel
   osutajal on loakohustuslikke teenuseid mitu; piir peatab klõpsimise, mis
   koormaks registrit. */
const BIND_LIMIT = 12;
const BIND_WINDOW_MS = 60 * 60 * 1000;

async function overview(profileId, now) {
  const [binding, rows] = await Promise.all([
    ownBindingOverview({ providerProfileId: profileId }),
    licenceStatusesForProfile({ providerProfileId: profileId, now })
  ]);
  return { binding, services: serializeLicenceRows(rows, now) };
}

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnLicenceProfile();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const binding = await ownBindingOverview({ providerProfileId: auth.profile.id });
    if (!binding.ok) return errorJson("service_provider_profile.errors.load_failed", 404, locale);
    return json({
      ok: true,
      hasRegistryCode: binding.hasRegistryCode,
      kinds: binding.kinds,
      bindings: binding.services
    });
  } catch (error) {
    console.error("[mtr-own-binding] load failed", safeError(error));
    return errorJson("service_provider_profile.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireOwnLicenceProfile();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const body = await request.json().catch(() => ({}));
    const providerServiceId = String(body?.providerServiceId || "").trim();
    if (!providerServiceId) return errorJson("service_provider_profile.errors.save_failed", 400, locale);

    const limit = consumeRateLimit(`mtr-own-binding:${auth.userId}`, BIND_LIMIT, BIND_WINDOW_MS);
    if (!limit.allowed) {
      return errorJson(
        "service_provider_profile.licence.internal.bind_rate_limited",
        429,
        locale,
        { retryAfterSeconds: limit.retryAfterSec },
        { "Retry-After": String(limit.retryAfterSec) }
      );
    }

    const result = await bindOwnServiceKey({
      providerProfileId: auth.profile.id,
      providerServiceId,
      /* `null` on lubatud väärtus: osutaja võtab kinnituse tagasi. */
      serviceKey: body?.serviceKey ?? null,
      actorUserId: auth.userId
    });

    if (!result.ok) {
      const status = result.error === BINDING_ERROR.SERVICE_NOT_FOUND ? 404 : 400;
      return errorJson("service_provider_profile.licence.internal.bind_failed", status, locale, { code: result.error });
    }

    const view = await overview(auth.profile.id, new Date());
    return json({
      ok: true,
      changed: result.changed,
      serviceKey: result.serviceKey,
      /* OSALINE ÕNNESTUMINE on 200: liik ON kinnitatud, ainult kohene kontroll
         jäi tegemata. 500 paneks osutaja arvama, et midagi ei salvestunud. */
      checkError: result.checkError || null,
      hasRegistryCode: view.binding.ok ? view.binding.hasRegistryCode : null,
      kinds: view.binding.ok ? view.binding.kinds : [],
      bindings: view.binding.ok ? view.binding.services : [],
      services: view.services
    });
  } catch (error) {
    console.error("[mtr-own-binding] bind failed", safeError(error));
    return errorJson("service_provider_profile.licence.internal.bind_failed", 500, locale);
  }
}
