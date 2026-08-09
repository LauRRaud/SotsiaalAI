import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { DangerousActionError } from "@/lib/admin/dangerousActionGate";
import { RAG_RESET_PARTIAL } from "@/lib/admin/rag/kov/ragResetProtocol";
import {
  assertKovRagResetGate,
  previewKovRagReset,
  recordKovRagResetOutcome
} from "@/lib/admin/rag/kov/resetGate";
import {
  executeKovRagStateResetBySlug,
  planKovRagStateResetBySlug
} from "@/lib/admin/rag/kov/resetState";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const confirmReset = body?.confirmReset === true;
  let jti = null;

  try {
    /* DRY-RUN. Tagastab plaani KÕRVAL allkirjastatud token'i ja täpse
       kinnitusteksti — ilma nendeta ei saa kirjutusrada läbida. */
    if (!confirmReset) {
      const plan = await planKovRagStateResetBySlug(slug);
      return json({
        ok: true,
        ...plan,
        ...previewKovRagReset({ plan, body })
      });
    }

    /* SOL-RAGADMIN-04: plaan arvutatakse ÜKS kord ja seesama objekt läheb nii
       väravasse kui täitmisele. Kaks arvutust tähendaks, et kinnitatud plaan ja
       täidetud plaan võivad erineda. */
    const plan = await planKovRagStateResetBySlug(slug);
    const gate = await assertKovRagResetGate({
      db: prisma,
      plan,
      body,
      actorUserId: auth.session?.user?.id || null,
      request
    });
    jti = gate.jti;

    const result = await executeKovRagStateResetBySlug(slug, { plan });

    await recordKovRagResetOutcome({
      db: prisma,
      jti,
      result: {
        status: "success",
        deletedDocCount: result.execution?.deleted_rag_documents?.length || 0,
        archivedSnapshotCount: result.execution?.archived_source_package_snapshots || 0,
        resetAdminRows: result.execution?.reset_kov_admin_rows || 0
      }
    });

    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error("[kov-admin] reset rag state failed", safeError(error));

    /* Värava tagasilükkamine on kasutaja jaoks juhis, mitte serveri viga: ta
       ütleb, KAS teha uus eelvaade, KAS kinnitustekst ei ühtinud või KAS token
       oli juba kasutatud. */
    if (error instanceof DangerousActionError) {
      return errorJson(error.messageKey, error.status, auth.locale, { debugCode: error.code });
    }

    /* SOL-RAGADMIN-02: osaline reset EI OLE `ok: true`. Vastus kannab kaasas, mis
       kustutati, mis jäi alles ja mis läks järjekorda — muidu peaks admin
       ainsa eduteate põhjal arvama. */
    if (error?.code === RAG_RESET_PARTIAL) {
      await recordKovRagResetOutcome({
        db: prisma,
        jti,
        result: {
          status: "partial",
          deletedDocCount: error.execution?.deleted_rag_documents?.length || 0,
          failedDocCount: error.execution?.failed_rag_documents?.length || 0,
          dbStateChanged: false
        }
      });
      return errorJson("api.admin.kov.rag_reset_partial", status, auth.locale, {
        execution: error.execution
      });
    }

    await recordKovRagResetOutcome({ db: prisma, jti, result: { status: "failed" } });
    return errorJson(status === 404 ? "api.common.not_found" : "api.admin.kov.update_failed", status, auth.locale);
  }
}
