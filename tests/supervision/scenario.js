import {
  createSupervisionDb,
  seedUser,
  resetIds,
  memberSession
} from "./harness.js";
import { issueGrant } from "../../lib/supervision/grants.js";
import {
  createProcess,
  createContractVersion,
  activateContractVersion,
  inviteParticipant,
  respondToInvite,
  getProcessDetail
} from "../../lib/supervision/service.js";

/** Baasstend: admin + SV + kaks osalejat + client + kõrvaline. */
export function setupBase() {
  resetIds();
  const db = createSupervisionDb();
  seedUser(db, "admin1", "ADMIN");
  seedUser(db, "sv1", "SOCIAL_WORKER");
  seedUser(db, "os1", "SERVICE_PROVIDER");
  seedUser(db, "os2", "SOCIAL_WORKER");
  seedUser(db, "client1", "CLIENT");
  seedUser(db, "outsider", "SOCIAL_WORKER");
  return db;
}

export const sv = () => memberSession("sv1", "SOCIAL_WORKER");
export const os1 = () => memberSession("os1", "SERVICE_PROVIDER");
export const os2 = () => memberSession("os2", "SOCIAL_WORKER");

/**
 * Ehitab ACTIVE grupiprotsessi: grant → protsess → kontraktiversioon →
 * aktiveerimine → kutse os1 → os1 accept. Tagastab id-d järgnevaks kasutuseks.
 */
export async function makeActiveProcess(db, { invite = ["os1"], accept = ["os1"], ensureGrant = true } = {}) {
  if (ensureGrant) {
    await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "ESCU-2026" }, { db });
  }
  const process = await createProcess(
    { session: sv(), input: { type: "GROUP", title: "Kevadgrupp", goal: "Toetada" } },
    { db }
  );
  const cv = await createContractVersion(
    { processId: process.id, session: sv(), input: { body: "Kontrakt v1" } },
    { db }
  );
  const contractVersionId = cv.contractVersion.id;
  await activateContractVersion(
    { processId: process.id, versionId: contractVersionId, session: sv(), input: { expectedVersion: process.version } },
    { db }
  );
  const participationIds = {};
  for (const uid of invite) {
    const detail = await inviteParticipant(
      { processId: process.id, session: sv(), input: { userId: uid } },
      { db }
    );
    participationIds[uid] = detail.participants.find((p) => p.userId === uid).id;
  }
  for (const uid of accept) {
    const session = memberSession(uid, uid === "os1" ? "SERVICE_PROVIDER" : "SOCIAL_WORKER");
    await respondToInvite(
      { participationId: participationIds[uid], session, input: { action: "accept", contractVersionId } },
      { db }
    );
  }
  return { processId: process.id, contractVersionId, participationIds };
}

export { getProcessDetail };
