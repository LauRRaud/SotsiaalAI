/**
 * TEENUSPÄEVIK — aadressisoovitused Maa-ameti aadressiregistrist (in-ADS).
 *
 * MIKS SEE ON OMA MARSRUUT, mitte teenusekaardi oma taaskasutus: teenusekaardi
 * soovitusrada on osutaja HALDUSE oma (capability, org-skoop) ja tema avamine
 * välitöövaatele tähendaks õiguste segamist. Sisu tuleb samast funktsioonist
 * (`suggestServiceMapAddresses`), seega kaks kohta ei saa lahku minna.
 *
 * MIKS ÜLDSE: külastuse aadress oli vaba tekst. Kirjaviga tähendas kolme asja
 * korraga — navigatsioon viis valesse kohta, geokodeerimine ei leidnud midagi
 * ja sõidulõik jäi mõõtmata. Registrist valitud aadress lahendab kõik kolm.
 */
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";
import { suggestServiceMapAddresses } from "@/lib/serviceMap/geocoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  if (!isServiceLogDayRouteEnabled()) {
    return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  }
  const { response, userId } = await guardServiceLogRequest(req, {
    scope: "service_visits_address",
    /* Kirjutamise ajal käib päring iga paari tähemärgi järel — piir on kõrgem
       kui mujal, aga ta on OLEMAS: väline register ei ole meie oma ja teda ei
       tohi meie kasutajate klaviatuuriga üle koormata. */
    limit: 300
  });
  if (response) return response;
  if (!userId) return json({ suggestions: [] });

  try {
    const query = new URL(req.url).searchParams.get("q");
    const result = await suggestServiceMapAddresses(query);
    return json({
      /* AINULT NIMI JA KOORDINAAT. Registri toorvastus kannab veel välju, mida
         välitöövaade ei vaja — vähem andmeid liikvel on vähem andmeid lekkida. */
      suggestions: (result?.suggestions || []).slice(0, 8).map((item) => ({
        label: item.normalizedAddress || item.rawAddress || item.label || "",
        lat: item.latitude ?? null,
        lng: item.longitude ?? null,
        adsId: item.adsObjectId || null
      }))
    });
  } catch (error) {
    /* Väline register EI TOHI vormi katki teha: tühi soovitus tähendab lihtsalt
       „kirjuta ise", mitte tõrget. */
    console.error("[service-visits address] suggest failed", safeError(error));
    return json({ suggestions: [] });
  }
}
