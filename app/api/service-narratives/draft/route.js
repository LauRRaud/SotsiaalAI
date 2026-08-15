/**
 * TEENUSPÄEVIK E5 — kuunarratiivi AI-mustand (REPORT_DRAFT).
 *
 * KOLM JÄRJEKORRAREEGLIT, mis on siin tahtlikud:
 *
 * 1. VÄRAV JA SKOOP ENNE KVOOTI. Kvoodi broneerimine enne skoobi kontrolli
 *    tähendaks, et võõra suunamise pärimine maksab kutsujale ühe genereerimise.
 *
 * 2. KVOOT ENNE MUDELIT, `commit` PÄRAST. Mudel on ainus koht, kus raha
 *    päriselt kulub; broneering enne kaitseb võidujooksu eest ja `commit`
 *    pärast tähendab, et ebaõnnestunud genereerimine ei võta kvooti.
 *
 * 3. SALVESTUS EI KÄI SIIT LÄBI. Vastus on MUSTAND — inimene toimetab ja tema
 *    `PUT /api/service-narratives` teeb temast narratiivi. Ilma selleta tekiks
 *    aruanne, mille all on inimese nimi ja mille sisu ta ei ole lugenud.
 */
import { errorJson, json, usageErrorJson } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { getNarrativeSeed } from "@/lib/serviceLog/narratives";
import {
  buildNarrativeInstruction,
  buildNarrativeSourceText,
  wrapNarrativeDraft
} from "@/lib/serviceLog/narrativeDraft";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError } from "@/lib/serviceLog/flags";
import { generateArtifactDraftContent } from "@/lib/documents/generation";
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest
} from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req) {
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_narrative_draft",
    /* Madalam kui mujal: iga kutse maksab kvoodist ja mudeliaega. */
    limit: 10
  });
  if (response) return response;

  let usageHandle = null;
  try {
    const body = await req.json().catch(() => null);
    const month = typeof body?.month === "string" ? body.month : "";
    const referralId = body?.referralId || null;

    /* `getNarrativeSeed` võtab AASTA ja KUU eraldi, mitte „AAAA-KK" stringi.
       Esimene versioon saatis stringi ja sai iga kutse peale „periood on
       vigane" — brauserikontroll näitas seda kohe, testid mitte, sest nad ei
       läinud marsruudist läbi. Lahutamine on siin, mitte kliendis: marsruut
       peab võtma vastu sama kuju, mida kogu ülejäänud teema kasutab. */
    const [periodYear, periodMonth] = month.split("-");

    /* Koond on ka SKOOBIKONTROLL: `getNarrativeSeed` viskab 404, kui suunamine
       ei ole kutsuja oma. See juhtub ENNE kvoodi broneerimist. */
    const seed = await getNarrativeSeed(userId, {
      referralId,
      clientUserId: body?.clientUserId || null,
      clientDisplayName: body?.clientDisplayName || null,
      periodYear,
      periodMonth
    });

    const sourceMaterialText = buildNarrativeSourceText(seed, { month });
    if (!sourceMaterialText.trim() || !seed?.entryCount) {
      /* Tühjast kuust ei ole mõtet aruannet genereerida — mudel kirjutaks
         sisuka välimusega teksti mitte millegi kohta ja kasutaja maksaks
         selle eest kvoodist. */
      return errorJson("service_log.errors.narrative_no_entries", 400, locale);
    }

    try {
      usageHandle = await reserveUsageForRequest({
        request: req,
        userId,
        metric: "DOCUMENT_GENERATE",
        scope: "service_log.narrative_draft",
        idempotencyKey: body?.idempotencyKey,
        metadata: { month: String(month || ""), entryCount: seed.entryCount }
      });
    } catch (error) {
      return usageErrorJson(error, "service_log.narrative_draft", locale);
    }

    /* Sellel endpoint'il ei ole püsistatud tulemust, mida sama võtmega
       korduspäringule tagastada. Seetõttu ei tohi taaskasutatud broneeringuga
       uut mudelikutsungit teha: COMMITTED broneeringu commit on idempotentne
       ning värske genereerimine jääks muidu kvoodis arvestamata. */
    if (usageHandle.reused) {
      usageHandle = null;
      return errorJson("api.common.invalid_request", 409, locale);
    }

    const result = await generateArtifactDraftContent({
      type: "REPORT_DRAFT",
      documents: [],
      sourceMaterialText,
      sourceMaterialName: "Teenuspäevik — kuu koond",
      instruction: buildNarrativeInstruction(),
      language: "et",
      observabilityRoute: "api/service-narratives/draft",
      observabilityStage: "document_generate",
      userId,
      userRole: "SERVICE_PROVIDER"
    });

    await commitUsageForRequest(usageHandle);
    usageHandle = null;

    return json({
      draft: wrapNarrativeDraft(result?.content || "", {
        month,
        generatedAt: new Date().toISOString()
      }),
      /* Koond tuleb KAASA, et inimene saaks mustandit allikaga kõrvutada ilma
         teist päringut tegemata. Just see kõrvutamine on see, mis teeb
         AI-mustandi kontrollitavaks. */
      seed
    });
  } catch (error) {
    /* Broneering vabastatakse, kui mudel kukkus: ebaõnnestunud genereerimine
       ei tohi kvoodist võtta. */
    if (usageHandle) await releaseUsageForRequest(usageHandle).catch(() => {});
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    /* GENERAATORI ENDA VEAD TULEVAD LÄBI, mitte ei muutu „serveri veaks".
       `createArtifactError` paneb `status`-e ja tõlkevõtme `message`-sse; kõige
       tavalisem neist on `ai_unavailable` (503) ja kasutaja saab sellega midagi
       peale hakata — „proovi hiljem" on tegu, „serveri viga" ei ole. Mõõdetud:
       ilma võtmeta keskkonnas andis see marsruut 500 asemel, mis oleks. */
    if (Number.isInteger(error?.status) && typeof error?.message === "string" && error.message.includes(".")) {
      return errorJson(error.message, error.status, locale);
    }
    console.error("[service-narratives draft] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
