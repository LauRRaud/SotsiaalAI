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

    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(document.originalName, document.mime)
    });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.not_found", "org");
  }
}
