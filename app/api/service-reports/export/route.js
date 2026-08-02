/**
 * TEENUSPÄEVIK-V1 E6 — ekspordi API.
 *
 * Periood + saaja + mall → fail. See marsruut lunastab DoD punktid 2 ja 3:
 * kuu lõpus sünnib esitis juba sisestatud kirjetest ja mitut KOV-i teenindav
 * osutaja saab igaühele TEMA read.
 */
import { errorJson, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";
import { buildServiceLogExport, exportFileName, exportToCsv } from "@/lib/serviceLog/exportService";
import { EXPORT_FORMAT, FORMAT_MIME, isExportFormat } from "@/lib/serviceLog/export/render";
import { exportToDocx } from "@/lib/serviceLog/export/docx";
import { exportToPdf } from "@/lib/serviceLog/export/pdf";
import { buildStarPayload, starPayloadToJson } from "@/lib/serviceLog/export/star";
import { TEMPLATE } from "@/lib/serviceLog/export/templates";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { ServiceLogDisabledError, isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { archiveMonthlyReport } from "@/lib/serviceLog/reportArchive";

/* VEATEATED KASUTAJA KEELES. `errorJson` lokaadi vaikeväärtus on "en" — ilma
   `localeFromRequest`-ita tuli eestikeelsele kasutajale ingliskeelne teade.
   Brauserikontroll näitas seda: kinnitamise tõrge kuvati kujul „The entry is
   already final." keset eestikeelset pinda. `i18n:check` ei püüa seda kinni,
   sest ta kontrollib võtmete PARITEETI, mitte kasutuskohta. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  // Värav enne autentimist — suletud pind on eristamatu olematust marsruudist.
  if (!isServiceLogEnabled()) return errorJson("service_log.errors.not_found", 404, localeFromRequest(req));
  const { response, userId, locale } = await guardServiceLogRequest(req, {
    scope: "service_reports_export",
    limit: 30
  });
  if (response) return response;

  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const template = url.searchParams.get("template");
    const kovName = url.searchParams.get("kovName");

    const { document, provider, period, month: resolvedMonth, template: resolvedTemplate } =
      await buildServiceLogExport(userId, {
        month,
        template,
        kovName,
        referralId: url.searchParams.get("referralId"),
        variant: url.searchParams.get("variant") || undefined,
        includeDrafts: url.searchParams.get("includeDrafts") === "1",
        includeClientConfirmation: url.searchParams.get("clientConfirmation") === "1",
        includeTravelTime: url.searchParams.get("travelTime") === "1"
      });

    /* Tundmatu vorming EI OLE viga, vaid vaikeväärtus: link, mille keegi on
       kuskile salvestanud, peab andma faili ka siis, kui parameeter on kadunud. */
    const requested = String(url.searchParams.get("format") || "").toLowerCase();
    const format = isExportFormat(requested) ? requested : EXPORT_FORMAT.CSV;
    const generatedAt = new Date().toISOString();

    let body;
    if (format === EXPORT_FORMAT.STAR) {
      /* STAR-kuju sünnib AINULT mallist D. Teised mallid kannavad isikuandmeid
         (nimed, suunamisnumbrid) ja riigi statistika neid ei vaja — vale malli
         lubamine tähendaks vaikset üleliigset edastust.

         VASTUS ON 400, MITTE 500: see on kutsuja valik, mille ta saab ise
         parandada, mitte serveri tõrge. */
      if (document.template !== TEMPLATE.D_STATISTICS) {
        return errorJson("service_log.errors.star_requires_statistics", 400, locale);
      }
      body = starPayloadToJson(buildStarPayload(document, { provider, period, generatedAt }));
    } else if (format === EXPORT_FORMAT.DOCX) {
      body = exportToDocx(document, { generatedAt });
    } else if (format === EXPORT_FORMAT.PDF) {
      const pdf = exportToPdf(document, { generatedAt });
      /* PDF-kirjutaja on WinAnsi. Kirillitsa asendamine küsimärkidega oleks
         vaikne andmekadu ARVE ALUSDOKUMENDIS — parem aus tõrge ja suunamine
         DOCX-ile, mis sama sisu ilma kaota kannab. */
      if (!pdf.ok) return errorJson("service_log.errors.pdf_unsupported_characters", 422, locale);
      body = pdf.buffer;
    } else {
      body = exportToCsv(document);
    }

    const fileName = exportFileName({ month, template, kovName, extension: format });

    /* ESITATU JÄÄB ALLES. Kuni siiani läks fail brauserisse ja platvorm ei
       teadnud hiljem, MIS täpselt KOV-ile esitati — kirjeid tohib RPS §10 korras
       parandada, seega hilisem uus eksport ei tõenda seda, mis tookord teele
       läks.

       ARHIVEERIMINE EI TOHI ALLALAADIMIST KATKESTADA (vt reportArchive.js):
       tulemus tuleb päisena kaasa, et kasutajaliides saaks NÄIDATA, kui koopiat
       ei tekkinud. Vaikne puudumine oleks halvem kui puudumine ise. */
    const archived = await archiveMonthlyReport({
      userId,
      month: resolvedMonth,
      template: resolvedTemplate,
      format,
      kovName,
      fileName,
      mime: FORMAT_MIME[format],
      body,
      entryCount: Array.isArray(document.rows) ? document.rows.length : null,
      generatedAt
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": FORMAT_MIME[format],
        "Content-Disposition": `attachment; filename="${fileName}"`,
        /* Kliendile loetav seis: „1" = koopia on /documents lehel olemas. */
        "X-Service-Report-Archived": archived.ok ? "1" : "0",
        ...(archived.ok ? { "X-Service-Report-Document": archived.documentId } : {}),
        /* Eksport on isikuandmetega fail — vahemällu teda ei panda. */
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof ServiceLogDisabledError || error instanceof ServiceLogError) {
      return errorJson(error.messageKey, error.status, locale);
    }
    console.error("[service-reports export] unexpected", safeError(error));
    return errorJson("api.common.server_error", 500, locale);
  }
}
