export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import prisma from "@/lib/prisma";
import { readStoredDocument } from "@/lib/documents/server";
import { runFieldOcr, isFieldOcrConfigured } from "@/lib/field/ocr";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

/**
 * User-commanded OCR over a synced photo attachment. The result is an
 * UNSAVED AI_MUSTAND draft; nothing persists until the user confirms it as a
 * note. Owner-scoped: a foreign visit or attachment is a 404.
 */
export async function POST(_request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    if (!isFieldOcrConfigured()) {
      return fieldJson({ ok: false, message: "field.errors.ocr_unavailable" }, 503);
    }
    const params = await context?.params;
    const visit = await prisma.fieldVisit.findFirst({
      where: { id: String(params?.id || "").trim(), ownerUserId: auth.userId },
      select: { id: true }
    });
    if (!visit) return fieldJson({ ok: false, message: "api.common.not_found" }, 404);
    const attachment = await prisma.fieldVisitAttachment.findFirst({
      where: {
        visitId: visit.id,
        clientItemId: String(params?.clientItemId || "").trim(),
        role: "photo"
      },
      select: { document: { select: { id: true, ownerId: true, storagePath: true } } }
    });
    if (!attachment?.document || attachment.document.ownerId !== auth.userId) {
      return fieldJson({ ok: false, message: "api.common.not_found" }, 404);
    }
    const buffer = await readStoredDocument(attachment.document.storagePath);
    const result = await runFieldOcr(buffer);
    return fieldJson({ ok: true, draft: result.text, truncated: result.truncated, provenance: "AI_MUSTAND" });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] ocr failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.ocr_failed");
  }
}
