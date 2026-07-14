export async function withWellbeingOutputDraftLock(db, draftId, callback) {
  const key = `wellbeingOutputDraft:${String(draftId || "").trim()}`;
  if (typeof db?.$transaction !== "function") return callback(db);

  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    }
    return callback(tx);
  });
}
