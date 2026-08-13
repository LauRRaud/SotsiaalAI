/**
 * Ühine PostgreSQL-i lukk suunamise elutsüklile ja tema alla kirje loomisele.
 *
 * Ainult `status`-e kontrollist ei piisa: kirje loomine võib lugeda ACTIVE ja
 * lõpetamine sama rea ENDED-iks muuta enne kirje INSERT-i. Mõlemad rajad
 * lukustavad seepärast sama rea ning loevad otsustava seisu alles luku järel.
 */
export async function withLockedReferral(db, { referralId, providerProfileId }, work) {
  const run = async (tx) => {
    if (typeof tx.$queryRaw === "function") {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ServiceReferral"
        WHERE "id" = ${referralId}
          AND "providerProfileId" = ${providerProfileId}
        FOR UPDATE
      `;
    }

    const referral = await tx.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId }
    });
    return work(tx, referral);
  };

  if (typeof db.$transaction === "function") return db.$transaction(run);
  return run(db);
}
