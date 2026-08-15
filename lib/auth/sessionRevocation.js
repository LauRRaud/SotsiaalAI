/**
 * SOL-AUTH-14 — ühe seadme väljalogimine, mille tulemus on kasutajale nähtav.
 *
 * Jälgitav `Session` rida ON revoke: iga JWT-kutse nõuab, et rida oleks olemas ja kehtiv
 * (`hasActiveTrackedSession`), ja tema puudumine annab `SESSION_REVOKED`. Seega rea
 * kustutamise ÕNNESTUMINE on ainus asi, mis kopeeritud tokeni tapab.
 *
 * Vana põhirada kustutas rea NextAuthi `signOut` eventis best-effort'ina: iga viga peale
 * `P2025` läks logisse ja väljalogimine lõppes eduga. Kasutaja brauser kaotas küpsise ja
 * ta nägi end väljas, aga sama JWT varem kopeerinud osapool jätkas kuni rea või tokeni
 * aegumiseni. Nähtav tulemus ja serveripoolne revokatsioon lahknesid vaikselt.
 *
 * Siin on nad seotud: kutsuja saab teada, KAS rida kadus, ja alles siis tohib küpsist
 * eemaldada. Ebaõnnestumine on aus ja korratav — kasutaja jääb sisse logituks, mis on
 * ainus seis, mida server suudab tõeselt kirjeldada.
 */

export const SESSION_REVOKE_OK = "revoked";
export const SESSION_REVOKE_ALREADY_GONE = "already_gone";
export const SESSION_REVOKE_FOREIGN = "foreign_session";

export async function revokeTrackedSession({ db, userId, sessionRecordId }) {
  const id = String(sessionRecordId || "");
  const owner = String(userId || "");
  if (!id || !owner) return { ok: false, reason: "missing_session_reference" };

  // Tingimuslik kustutus: `userId` on WHERE-s, mitte mälus kontrollitud. Ilma selleta
  // saaks võõra `sessionRecordId` kandev token kustutada kellegi teise sessiooni.
  const deleted = await db.session.deleteMany({ where: { id, userId: owner } });
  if (deleted.count > 0) return { ok: true, outcome: SESSION_REVOKE_OK };

  // Null kustutatud rida tähendab kahte täiesti eri asja ja neid ei tohi ühte lugeda:
  // kas rida oli juba läinud (soovitud lõppseis) või ta on olemas ja kuulub kellelegi
  // teisele (siis EI OLE me midagi tühistanud).
  const existing = await db.session.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: true, outcome: SESSION_REVOKE_ALREADY_GONE };

  return { ok: false, reason: SESSION_REVOKE_FOREIGN };
}

/**
 * Varuvõrk NextAuthi avalikule signout-rajale. Põhirada jääb `/api/profile/logout`,
 * sest ainult see saab revokatsiooni ebaõnnestumise korral küpsise eemaldamise peatada.
 * Otsene NextAuthi rada peab siiski sama omanikuga sessioonirea kustutama, et vana klient
 * ega vaikimisi `/api/auth/signout` ei jätaks kopeeritud JWT-d pärast väljalogimist kehtima.
 */
export async function revokeTrackedSessionFromSignOut(message, { db }) {
  const sessionRecordId = message?.token?.sessionRecordId;
  const userId = message?.token?.id;
  if (!sessionRecordId || !userId) return;

  const result = await revokeTrackedSession({ db, userId, sessionRecordId });
  if (!result.ok) {
    throw new Error(`tracked_session_revocation_failed:${result.reason}`);
  }
}
