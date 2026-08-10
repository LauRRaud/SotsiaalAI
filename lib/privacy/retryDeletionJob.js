import { RAG_ADMIN_FILE_RESOURCE } from "../admin/rag/fileSwap.js";
import { confirmEgressStopped, createConfiguredEgressProvider } from "../calls/egress.js";
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

/**
 * SOL-CALL-01 — püsiva taasproovi provider-pool. Kinnitusreegel EI OLE siin uuesti
 * kirjutatud: `confirmEgressStopped` on sama funktsioon, mida kasutab teenusekiht.
 */
async function stopCallEgress({ egressId }) {
  return confirmEgressStopped({ provider: createConfiguredEgressProvider(), egressId });
}

/**
 * SOL-CALL-03 — orvuks jäänud egress, mille id-d me kunagi teada ei saanud (start
 * aegus, vastus kadus). Otsime ruumi pealt ja peatame iga mitteterminaalse.
 *
 * `cleared` on tõene AINULT siis, kui ühtegi kirjutavat egress'i enam alles ei ole.
 * Tühi loend on samuti puhas tulemus: siis start ei jõudnudki providerini.
 */
async function stopOrphanRoomEgress({ providerRoomName }) {
  const provider = createConfiguredEgressProvider();
  const active = await provider.listActiveRoomEgress({ providerRoomName });
  if (!active.length) return { cleared: true, stopped: 0 };
  let remaining = 0;
  for (const row of active) {
    const stop = await confirmEgressStopped({ provider, egressId: row.egressId });
    if (!stop.stopped) remaining += 1;
  }
  return {
    cleared: remaining === 0,
    stopped: active.length - remaining,
    errorCode: remaining ? "orphan_egress_not_stopped" : null
  };
}

export const retryDeletionJob = createDeletionJobRetryService({
  db: prisma,
  deleteDocument: deleteStoredDocument,
  deleteMaterial: deleteStoredMaterial,
  deleteRag: deleteRagDocument,
  deleteRagAdminFile,
  deleteUser: (job, context) => retryUserPrivacyDeletion({ job, ...context }),
  stopCallEgress,
  stopOrphanRoomEgress
});
