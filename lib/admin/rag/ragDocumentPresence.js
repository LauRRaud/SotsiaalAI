/**
 * SOL-RAGADMIN-03 — „kas see dokument on RAG-is olemas?"
 *
 * MIKS OMA FAIL. Lepitus (`ingestReconcile.js`) on puhas protokoll ja peab olema
 * testitav ilma serveri-ainult moodulite ahelat (`ragService` → `ragAuth` →
 * `server-only`) kaasa vedamata. Kohalolu LUGEMINE on ainus osa, mis päris
 * teenust vajab, seega ta elab eraldi ja antakse lepitusele ette.
 */

import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { safeError } from "@/lib/privacy/safeError";

import { RAG_PRESENCE } from "./ingestReconcile";

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * EI VISKA. Lepitus, mis kutsuja kukutab, oleks halvem kui lepitus, mis ütleb
 * „ei tea" — ja „ei tea" on siin lubatud vastus, mille peale ei otsustata midagi.
 *
 * @returns {Promise<{ presence: string, lastIngested: Date|null }>}
 */
export async function readRagDocumentPresence(docId, observability = null) {
  const normalizedDocId = String(docId || "").trim();
  if (!normalizedDocId) return { presence: RAG_PRESENCE.UNKNOWN, lastIngested: null };

  try {
    const payload = await ragServiceRequest(
      `/documents/${encodeURIComponent(normalizedDocId)}`,
      {
        method: "GET",
        headers: buildRagHeaders(
          null,
          observability || { route: "admin/rag/ingest-reconcile", stage: "ingest_reconcile" }
        )
      },
      "api.rag.document_status_failed"
    );

    return {
      presence: RAG_PRESENCE.PRESENT,
      lastIngested: parseDate(payload?.lastIngested) || parseDate(payload?.updatedAt)
    };
  } catch (error) {
    const status = Number(error?.status || error?.payload?.status || 0);
    if (status === 404) return { presence: RAG_PRESENCE.MISSING, lastIngested: null };

    try {
      console.error("[rag-admin/ingest-reconcile] presence unknown", {
        docId: normalizedDocId,
        status,
        error: safeError(error)
      });
    } catch {}
    return { presence: RAG_PRESENCE.UNKNOWN, lastIngested: null };
  }
}
