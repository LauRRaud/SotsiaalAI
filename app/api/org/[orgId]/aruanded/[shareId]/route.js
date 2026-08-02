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
import { orgErrorResponse, requireOrgContext } from "../../../_shared";

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
    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(document.originalName, document.mime)
    });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.not_found", "org");
  }
}
