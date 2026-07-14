import { assertCovisionLegacyWriteAllowed } from "./covisionAccessShared.js";

export async function withCovisionLegacyWriteLock(db, auth, id, findVisible, callback) {
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`covisionSession:${id}`}))`;
    }
    const covisionCase = await findVisible(tx, auth, id);
    if (!covisionCase) {
      const error = new Error("api.common.not_found");
      error.status = 404;
      throw error;
    }
    assertCovisionLegacyWriteAllowed(covisionCase);
    return callback(tx, covisionCase);
  });
}
