/**
 * TEENUSPÄEVIK — juht avab talle saadetud kuuaruande (E10a).
 *
 * AVAMINE JA LUGEMINE ON ÜKS TOIMING. Kaks eraldi kutset ("märgi avatuks",
 * "lae fail") tähendaks, et faili saab lugeda ilma avamise jälge jätmata — ja
 * just see jälg on see, mida töötaja peab nägema: kas juht luges või mitte.
 *
 * OMANIKUKONTROLLI EI TEHTA SIIN. `openShareForRecipient` lubab lugeda AINULT
 * seda dokumenti, mis on selle liikmesuse jagamise küljes; teekonda dokumendi
 * ID-lt failini siin ei ole.
 */
import { buildDownloadHeaders, readStoredDocument } from "@/lib/documents/server";
import { createPdfBufferFromText, isPdfTextSupported } from "@/lib/chat/exportDocument";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { openShareForRecipient } from "@/lib/serviceLog/reportShare";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    if (!isServiceLogEnabled()) return orgErrorResponse({ status: 404 }, "org.errors.not_found", "org");

    const params = await context?.params;
    const shareId = String(params?.shareId || "").trim();
    const membershipId = auth.context?.membership?.id;

    const document = await openShareForRecipient(shareId, {
      membershipIds: membershipId ? [membershipId] : [],
      actorUserId: auth.userId
    });

    const fileBuffer = await readStoredDocument(document.storagePath);

    /**
     * EELVAADE: aruanne LOETAVAKS, mitte ainult allalaaditavaks.
     *
     * Omanik proovis päris kontoga: „sain salvestada, aga vaadata ei saanud."
     * CSV läheb brauserist mööda otse ketta peale ja juht, kes tahab lihtsalt
     * üle vaadata, peab avama teise programmi. Aruanne on meie enda andmetest —
     * tema näitamine ei vaja midagi juurde peale ühe vaate.
     *
     * AVAMINE ON JUBA MÄRGITUD: `openShareForRecipient` tegi seda ülal.
     * Vaatamine JA allalaadimine on mõlemad avamine — kui eelvaade seda ei
     * märgiks, näeks saatja „avamata" ka siis, kui juht luges.
     *
     * AINULT CSV. PDF ja DOCX ei ole tekst ja nende „eelvaade" oleks prügi —
     * siis jääb allalaadimine ainsaks teeks ja seda öeldakse kliendile välja.
     */
    if (new URL(request.url).searchParams.get("eelvaade") === "1") {
      const isCsv = String(document.mime || "").includes("csv");
      if (!isCsv) return orgJson({ ok: true, previewable: false, fileName: document.originalName });
      const rows = fileBuffer
        .toString("utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim().length)
        /* Eksport kasutab semikoolonit (Exceli eesti lokaat). Jutumärkides
           välja siin ei ole — CSV-süsti kaitse eemaldas nad juba ekspordis. */
        .map((line) => line.split(";"))
        .slice(0, 500);
      return orgJson({ ok: true, previewable: true, fileName: document.originalName, rows });
    }

    /**
     * VORMINGU VALIK ALLALAADIMISEL.
     *
     * KAKS ERI ASJA JA SEDA EI TOHI SEGADA:
     *
     *   CSV = ESITATUD FAIL. Külmutatud bait'id, mille räsi tõendab, et see on
     *   täpselt see, mis KOV-ile läks. Vaidluses kõlbab ainult tema.
     *
     *   PDF = LUGEMISEKS. Sünnib samadest ridadest, aga ta on RENDER, mitte
     *   esitatud dokument. Ta on mugav (avaneb ise, saab välja printida), aga
     *   teda ei tohi kunagi esitada tõendina — ja seepärast kannab ta seda
     *   lauset ka failis endas.
     */
    if (new URL(request.url).searchParams.get("vorming") === "pdf") {
      const isCsv = String(document.mime || "").includes("csv");
      if (!isCsv) return orgJson({ ok: false, message: "org.reports.no_pdf" }, 400);

      const text = [
        document.originalName,
        "",
        /* AUS PÄIS. Ilma temata võiks keegi selle PDF-i KOV-ile edasi saata ja
           arvata, et ta on esitatud dokument. */
        "Lugemiseks renditud koopia. Esitatud fail on CSV.",
        "",
        ...fileBuffer
          .toString("utf8")
          .split(/\r?\n/)
          .filter((line) => line.trim().length)
          .map((line) => line.split(";").join("  "))
      ].join("\n");

      /* PDF-kirjutaja on WinAnsi: kirillitsa asendamine küsimärkidega oleks
         vaikne andmekadu. Parem aus tõrge ja CSV, mis kannab kõike. */
      if (!isPdfTextSupported(text)) return orgJson({ ok: false, message: "org.reports.no_pdf" }, 422);

      const name = document.originalName.replace(/\.csv$/i, "") + ".pdf";
      return new Response(createPdfBufferFromText(text), {
        status: 200,
        headers: buildDownloadHeaders(name, "application/pdf")
      });
    }

    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(document.originalName, document.mime)
    });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.not_found", "org");
  }
}
