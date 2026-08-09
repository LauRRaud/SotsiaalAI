import { RAG_ADMIN_FILE_RESOURCE } from "../admin/rag/fileSwap.js";
import { deleteStoredKovFile } from "../admin/rag/kov/storage.js";
import { deleteStoredOrganizationFile } from "../admin/rag/organizations/storage.js";
import { deleteStoredDocument } from "../documents/server.js";
import { deleteRagDocument } from "../documents/ragService.js";
import { deleteStoredMaterial } from "../materials/server.js";
import { prisma } from "../prisma.js";
import { createDeletionJobRetryService } from "./deletionJobRetryService.js";
import { retryUserPrivacyDeletion } from "./userDeletion.js";

export { createDeletionJobRetryService } from "./deletionJobRetryService.js";

/**
 * SOL-RAGADMIN-01 — orvuks jäänud RAG-admini fail.
 *
 * Tagastab `true`, kui ta tundis tüübi ära ja koristas. `false` tähendab
 * „ei ole minu oma" ja kutsuja jätkab tavalise dokumendirajaga — vaikne `true`
 * kataks kirjaviga tüübinimes kinni ja fail jääks igaveseks alles.
 */
async function deleteRagAdminFile(job) {
  if (job?.resourceType === RAG_ADMIN_FILE_RESOURCE.KOV) {
    await deleteStoredKovFile(job.storagePath);
    return true;
  }
  if (job?.resourceType === RAG_ADMIN_FILE_RESOURCE.ORGANIZATION) {
    await deleteStoredOrganizationFile(job.storagePath);
    return true;
  }
  return false;
}

export const retryDeletionJob = createDeletionJobRetryService({
  db: prisma,
  deleteDocument: deleteStoredDocument,
  deleteMaterial: deleteStoredMaterial,
  deleteRag: deleteRagDocument,
  deleteRagAdminFile,
  deleteUser: (job, context) => retryUserPrivacyDeletion({ job, ...context })
});
