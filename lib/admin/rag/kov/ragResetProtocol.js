/**
 * SOL-RAGADMIN-02 — KOV RAG reseti AUS lõppseis.
 *
 * MIDA SEE FAIL LAHENDAB. Reset kustutas RAG-dokumendid, KOGUS tõrked massiivi
 * `failed_rag_documents` ja jätkas nagu midagi ei oleks juhtunud: arhiveeris
 * aktiivsed snapshot'id, viis admini ingest-oleku „mitte-ingestitud" seisu ja
 * tagastas `ok: true`. UI vaatas ainult HTTP-staatust ja `payload.ok`-i ning
 * kuvas ühemõttelise eduteate. Tulemus: dokument jäi RAG-teenuses AKTIIVSEKS ja
 * mõjutas edasi otsingutulemusi, aga andmebaas ja admin ütlesid, et pakett on
 * lähtestatud.
 *
 * KOGU PROTOKOLL SEISAB ÜHE LAUSE PEAL: **admini olek ei tohi kunagi väita
 * puhtamat maailma, kui RAG-is päriselt on.** Sellest tuleneb kõik muu.
 *
 *   · Kustutus käib ESIMESENA ja DB-olek muutub alles siis, kui iga dokument on
 *     päriselt läinud. Kustutamata dokument katkestab reseti ENNE ühtki
 *     DB-kirjutust — nii jääb admini olek „ingestitud", mis on TÕSI.
 *   · Osaline tulemus EI OLE `ok: true`. Ta on 502 + `PARTIAL`, mis kannab kaasas
 *     nii kustutatud kui allesjäänud dokumendid.
 *   · Allesjäänud dokument läheb PÜSIVASSE järjekorda (`DataDeletionJob`,
 *     `RAG_DELETE`), mida admin näeb „Kustutus- ja puhastustööde" all ja saab
 *     uuesti proovida. Massiiv vastuses kaob koos vahekaardiga.
 *
 * MIKS „katkesta enne DB-d" JA MITTE „muuda DB olek ära ja märgi PARTIAL".
 * Kordamine on siin ohutu: plaan arvutatakse uuesti ja juba kustutatud dokument
 * annab RAG-ist 404, mille `deleteRagDocument` loeb sihilikult eduks. Seega aus
 * katkestus on TÄIELIKULT taastuv — admin vajutab uuesti ja reset läheb lõpuni.
 * „Muuda ära ja märgi" jätaks pärandiks oleku, mille tõesus sõltub sellest, kas
 * keegi juhtus märget lugema.
 */

import { createDataDeletionJob, DELETION_STATUS } from "@/lib/privacy/deletionJobs";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

/** Erindi kood, mille järgi marsruut osalise reseti ära tunneb. */
export const RAG_RESET_PARTIAL = "rag_reset_partial";

/** Püsiva järjekorra rida, millega allesjäänud dokument uuesti proovitakse. */
export const RAG_RESET_RETRY_JOB = Object.freeze({
  ACTION: "RAG_DELETE",
  RESOURCE_TYPE: "MunicipalityKovAdmin"
});

/**
 * Tõrke lühikood. `deleteRagDocument` erindi TEADE on `messageKey` — kohati
 * kaugteenuse omast payload'ist — seega siia läheb ainult kood/klass ja
 * HTTP-staatus, mitte teade (sama reegel mis SOL-RAGADMIN-01 orvurea juures).
 */
export function ragDeleteFailureCode(result) {
  const error = result?.error;
  const status = Number(error?.status ?? error?.payload?.status);
  const base = String(result?.reason || error?.code || "rag_delete_failed").trim() || "rag_delete_failed";
  const code = Number.isFinite(status) && status > 0 ? `${base}:${status}` : base;
  return code.slice(0, 120);
}

/**
 * Paneb allesjäänud dokumendi püsivasse järjekorda. EI VISKA: järjekorda
 * panemise tõrge ei tohi varjata seda, mis päriselt katki on — kutsuja kukutab
 * päringu nii või teisiti, ja `retry_queued: false` ütleb ausalt välja, et rida
 * ei tekkinud.
 *
 * `db` ja `createJob` on SÜSTITAVAD, et testid saaksid järjekorda TÕENDADA.
 */
export async function queueRagDocumentDeleteRetry({
  docId,
  resourceId = null,
  actorUserId = null,
  error = null,
  db = prisma,
  createJob = createDataDeletionJob
} = {}) {
  const normalizedDocId = String(docId || "").trim();
  if (!normalizedDocId) return null;

  /* Sama dokumendi kohta ei teki uut rida, kui lahtine rida on juba olemas:
     järjekord, mis täitub ühe ja sama tööga, matab nähtavuse enda alla. */
  try {
    const existing = await db.dataDeletionJob.findFirst({
      where: {
        action: RAG_RESET_RETRY_JOB.ACTION,
        resourceType: RAG_RESET_RETRY_JOB.RESOURCE_TYPE,
        externalRef: normalizedDocId,
        status: { in: [DELETION_STATUS.PENDING, DELETION_STATUS.FAILED] }
      },
      select: { id: true }
    });
    if (existing?.id) return existing;
  } catch (lookupError) {
    /* Dedupe on mugavus, mitte kaitse: pigem üks rida liiga palju kui mitte
       ühtegi rida. */
    try {
      console.error("[kov-rag-reset] retry job lookup failed", safeError(lookupError));
    } catch {}
  }

  return createJob({
    actorUserId,
    action: RAG_RESET_RETRY_JOB.ACTION,
    resourceType: RAG_RESET_RETRY_JOB.RESOURCE_TYPE,
    /* KOV admini kirje leitakse just slug'i järgi (`loadAdminRow`) ja admin näeb
       teda järjekorra loendis. */
    resourceId,
    externalRef: normalizedDocId,
    /* `storagePath` JÄÄB TÜHJAKS. `executeDeletionJob` valib haru `action` järgi
       ja RAG_DELETE tuleb enne FILE_DELETE-i — aga kui `externalRef` peaks
       kunagi kaduma, siis suunaks siia pandud vabatekst töö failikustutajale. */
    status: DELETION_STATUS.PENDING,
    lastError: ragDeleteFailureCode({ error })
  });
}

/**
 * RESET. Kustutab kõik plaanitud RAG-dokumendid ja laseb DB-oleku muutuse läbi
 * ALLES SIIS, kui ükski kustutus ei jäänud võlgu.
 *
 * @param {object} input
 * @param {string[]} input.docIds plaanitud RAG doc_id-d
 * @param {(docId: string) => Promise<{ ok?: boolean, error?: unknown, reason?: string }>} input.deleteDocument
 * @param {() => Promise<object|void>} input.commit DB-olek (arhiveerimine + admini rida)
 * @param {(input: object) => Promise<{ id?: string }|null>} [input.queueRetry] püsiv järjekord
 * @returns {Promise<object>} täieliku õnnestumise korral `reset_state: "DONE"`
 * @throws erind koodiga {@link RAG_RESET_PARTIAL}, `status: 502` ja `execution`
 *   väljaga, kui kas või üks dokument jäi alles. DB-d ei ole siis puudutatud.
 */
export async function commitRagReset({
  docIds = [],
  deleteDocument,
  commit,
  queueRetry = queueRagDocumentDeleteRetry,
  resourceId = null,
  actorUserId = null
}) {
  const deleted = [];
  const failed = [];

  for (const docId of docIds) {
    const result = await deleteDocument(docId);
    if (result?.ok === true) {
      deleted.push({ docId });
      continue;
    }

    /* Rida sünnib ENNE erindit: erind kaob ekraanilt, rida jääb. */
    const job = await queueRetry({ docId, resourceId, actorUserId, error: result?.error });
    failed.push({
      docId,
      error: ragDeleteFailureCode(result),
      retry_queued: Boolean(job?.id),
      retry_job_id: job?.id || null
    });
  }

  if (failed.length > 0) {
    const error = new Error("KOV RAG reset left documents in the RAG service");
    error.status = 502;
    error.code = RAG_RESET_PARTIAL;
    error.execution = {
      reset_state: "PARTIAL",
      db_state_changed: false,
      deleted_rag_documents: deleted,
      failed_rag_documents: failed,
      archived_source_package_snapshots: 0,
      reset_kov_admin_rows: 0,
      retry_queued_count: failed.filter(row => row.retry_queued).length,
      retry_not_queued_count: failed.filter(row => !row.retry_queued).length
    };
    throw error;
  }

  const committed = (await commit()) || {};
  return {
    ...committed,
    reset_state: "DONE",
    db_state_changed: true,
    deleted_rag_documents: deleted,
    failed_rag_documents: [],
    retry_queued_count: 0,
    retry_not_queued_count: 0
  };
}
