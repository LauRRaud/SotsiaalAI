/* Postgres advisory-lock ümbris. Fake-prisma (ilma $transaction'ita)
   korral jookseb callback lukuta — sama tagavaratee, mis oli
   withWellbeingOutputDraftLock'il algusest peale. */
export async function withWellbeingAdvisoryLock(db, key, callback) {
  const normalizedKey = String(key || "");
  if (typeof db?.$transaction !== "function") return callback(db);

  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedKey}))`;
    }
    return callback(tx);
  });
}

export async function withWellbeingOutputDraftLock(db, draftId, callback) {
  return withWellbeingAdvisoryLock(db, `wellbeingOutputDraft:${String(draftId || "").trim()}`, callback);
}
