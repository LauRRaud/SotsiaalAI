import { buildNationalRtXmlIngestPayload } from "@/lib/admin/rag/kov/rtXml";
import { json, errorJson, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_XML_BYTES = 5 * 1024 * 1024;

function normalizeFileName(value) {
  return String(value || "").trim() || "riigiteataja.xml";
}

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return errorJson("admin.rag.errors.rt_xml_required", 400, auth.locale);
    }

    const fileName = normalizeFileName(file.name);
    if (!fileName.toLowerCase().endsWith(".xml")) {
      return errorJson("admin.rag.errors.rt_xml_invalid", 400, auth.locale);
    }

    const size = Number(file.size || 0);
    if (size <= 0) {
      return errorJson("admin.rag.errors.rt_xml_required", 400, auth.locale);
    }
    if (size > MAX_XML_BYTES) {
      return errorJson("admin.rag.errors.rt_xml_too_large", 400, auth.locale);
    }

    const xmlText = Buffer.from(await file.arrayBuffer()).toString("utf8").trim();
    if (!xmlText) {
      return errorJson("admin.rag.errors.rt_xml_required", 400, auth.locale);
    }

    const payload = buildNationalRtXmlIngestPayload({
      xmlText,
      sourceFile: fileName,
      sourcePath: `admin-upload/${fileName}`
    });

    const result = await ragServiceRequest(
      "/ingest/text",
      {
        method: "POST",
        headers: buildRagHeaders("application/json", {
          route: "admin/rag/ingest",
          stage: "national_rt_xml_ingest"
        }),
        body: JSON.stringify(payload)
      },
      "admin.rag.errors.rt_xml_ingest_failed"
    );

    return json({
      ok: true,
      docId: payload.doc_id,
      inserted: result?.inserted ?? payload.chunks.length,
      title: payload.metadata.title,
      actReference: payload.metadata.act_reference,
      sourceUrl: payload.metadata.source_url,
      collectionId: payload.metadata.collection_id,
      jurisdictionLevel: payload.metadata.jurisdiction_level
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error("[rag-admin] national RT XML ingest failed", safeError(error));
    return errorJson("admin.rag.errors.rt_xml_ingest_failed", status, auth.locale, {
      message: String(error?.message || "RT XML ingest failed").slice(0, 500)
    });
  }
}
