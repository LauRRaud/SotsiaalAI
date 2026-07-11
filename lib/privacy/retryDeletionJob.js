import { deleteStoredDocument } from "../documents/server.js";
import { deleteRagDocument } from "../documents/ragService.js";
import { deleteStoredMaterial } from "../materials/server.js";
import { prisma } from "../prisma.js";
import { createDeletionJobRetryService } from "./deletionJobRetryService.js";
import { retryUserPrivacyDeletion } from "./userDeletion.js";

export { createDeletionJobRetryService } from "./deletionJobRetryService.js";

export const retryDeletionJob = createDeletionJobRetryService({
  db: prisma,
  deleteDocument: deleteStoredDocument,
  deleteMaterial: deleteStoredMaterial,
  deleteRag: deleteRagDocument,
  deleteUser: (job, context) => retryUserPrivacyDeletion({ job, ...context })
});
