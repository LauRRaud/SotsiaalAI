import { createVerificationTokenSecret } from "./verificationTokens.js";

/**
 * ÜHE IDENTIFIKAATORI LINK SAADETAKSE KORRAGA ÜHE KORRA (SOL-AUTH-15).
 *
 * MIS OLI VALESTI. Paroolitaaste POST mintis uue `VerificationToken` rea, saatis lingi ja
 * kustutas ALLES SEEJÄREL kõik ülejäänud sama identifikaatori tokenid. Järjekord ise oli
 * õige — SOL-AUTH-06 ja -13 õpetasid, et vana link peab elama kuni uus on teele läinud —
 * aga „kõik ülejäänud" luges stale'iks ka selle tokeni, mille teine samaaegne päring oli
 * just välja saatnud. Jadas A:create → B:create → A:send → B:send → A:delete-not-A →
 * B:delete-not-B kustutas A tokeni B ja B tokeni A: kaks näiliselt edukat kirja, null
 * töötavat linki. Topeltklikk või aeglane meilitarne muutis konto taastamise juhuslikult
 * võimatuks.
 *
 * MIS SIIN ON. Mint ja saatmine on üks omand, mitte kaks sõltumatut päringut. Otsus „kas ma
 * tohin selle identifikaatori jaoks lingi välja saata" tehakse identifikaatoripõhise
 * nõuandeluku all ja tema JÄLG on `VerificationLinkDispatch` rida. Teine päring näeb kas
 * käimasolevat saatmist (ja ei mindi ega saada midagi) või vaba lauda — mitte kunagi
 * poolikut vahepilti.
 *
 * ROTATSIOON ON TINGIMUSLIK. Kustutada tohib ainult neid tokeneid, mille peale liisungirida
 * EI näita, ja ainult siis, kui rida näitab ikka veel MINU tokeni peale. `count === 0`
 * tähendab siin sedasama, mida SOL-AUTH-14-s: kas ma olen aegunud omanik või on rida
 * üle võetud — kummalgi juhul EI OLE minu asi teiste ridu kustutada.
 *
 * VANANEMISAKEN ON LEPINGU OSA. Ilma temata lukustaks üks surnud protsess konto taastamise
 * igaveseks (sama argument, mis SOL-DOC-06 transkriptsiooniclaim'is). Aken on saatmise
 * ülempiir, mitte kasutaja ooteaeg: SMTP enda timeout on 15 s.
 *
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu — `$queryRaw` kukub `void`-tüübi
 * deserialiseerimisel (vt `lib/auth/jwtAuthorization.js`).
 */

/** 4711 = sessioon · 4712 = usaldatud seade · 4713 = sisselogimispiir · 4714 = siin. */
export const VERIFICATION_DISPATCH_LOCK_NAMESPACE = 4714;

/** Liisungi vananemisaken. SMTP timeout on 15 s, seega 2 min on saatmise ülempiir. */
export const VERIFICATION_DISPATCH_LEASE_MS = 2 * 60 * 1000;

/**
 * Dispatch rows are concurrency leases, not authentication history. Once the lease has
 * elapsed they no longer protect an in-flight delivery and must not retain an e-mail-derived
 * identifier indefinitely.
 */
export async function cleanupVerificationLinkDispatchRetention(db, {
  now = new Date(),
  leaseMs = VERIFICATION_DISPATCH_LEASE_MS
} = {}) {
  const leaseFloor = new Date(now.getTime() - Math.max(0, leaseMs));
  const result = await db.verificationLinkDispatch.deleteMany({
    where: { claimedAt: { lt: leaseFloor } }
  });
  return Number(result?.count || 0);
}

async function lockIdentifier(tx, identifier) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERIFICATION_DISPATCH_LOCK_NAMESPACE}::int4, hashtext(${identifier})::int4)`;
}

/**
 * Mindib lingi, saadab ta ja alles siis rotreerib vanad välja.
 *
 * `deliver(rawToken)` saab TOORE tokeni — ainsa koha, kus ta üldse eksisteerib. Andmebaasi
 * läheb salvestuskuju (SOL-AUTH-03), seega ka `tokenValue` liisungireal ei ole link.
 *
 * @returns `{ outcome: "sent" }` — kiri läks teele ja tema token on ainus kehtiv;
 *          `{ outcome: "in_flight" }` — teine päring saadab parajasti sama identifikaatori
 *              linki; midagi ei mintitud ega saadetud (idempotentne topeltklikk);
 *          `{ outcome: "delivery_failed", error }` — tarne kukkus; varem saadetud link jääb
 *              kehtima ja liisung vabastatakse kohe, et kordus ei jääks akna taha ootama;
 *          `{ outcome: "superseded" }` — kiri läks teele, aga liisung oli vahepeal üle
 *              võetud; minu token jääb kehtima ja rotatsiooni ma ei tee.
 */
export async function dispatchVerificationLink({
  db,
  identifier,
  expires,
  deliver,
  createSecret = createVerificationTokenSecret,
  now = () => new Date(),
  leaseMs = VERIFICATION_DISPATCH_LEASE_MS
}) {
  const claim = await db.$transaction(async (tx) => {
    await lockIdentifier(tx, identifier);

    const at = now();
    const leaseFloor = new Date(at.getTime() - Math.max(0, leaseMs));
    const dispatch = await tx.verificationLinkDispatch.findUnique({ where: { identifier } });

    // Käimasolev saatmine: tema token on juba olemas, aga kiri veel teel. Uue tokeni mintimine
    // siin ONGI leid — tema rotatsioon tapaks selle lingi, mille teine päring parajasti saadab.
    if (dispatch && !dispatch.sentAt && new Date(dispatch.claimedAt) > leaseFloor) {
      return null;
    }

    const secret = createSecret();
    await tx.verificationToken.create({
      data: { identifier, token: secret.stored, expires }
    });
    await tx.verificationLinkDispatch.upsert({
      where: { identifier },
      create: { identifier, tokenValue: secret.stored, claimedAt: at, sentAt: null },
      update: { tokenValue: secret.stored, claimedAt: at, sentAt: null }
    });

    return secret;
  });

  if (!claim) {
    return { outcome: "in_flight" };
  }

  try {
    await deliver(claim.raw);
  } catch (error) {
    // Minu tokenit EI kustutata: „viskas" ei tähenda „ei jõudnud kohale" — SMTP võib olla kirja
    // vastu võtnud ja alles siis timeout'ida. Kustutamine tapaks siis lingi, mis on kasutaja
    // postkastis. Vabastatakse ainult liisung, et kordus ei ootaks vananemisakent.
    await db.$transaction(async (tx) => {
      await lockIdentifier(tx, identifier);
      await tx.verificationLinkDispatch.deleteMany({
        where: { identifier, tokenValue: claim.stored, sentAt: null }
      });
    });
    return { outcome: "delivery_failed", error };
  }

  return db.$transaction(async (tx) => {
    await lockIdentifier(tx, identifier);

    const marked = await tx.verificationLinkDispatch.updateMany({
      where: { identifier, tokenValue: claim.stored, sentAt: null },
      data: { sentAt: now() }
    });

    if (Number(marked?.count || 0) === 0) {
      return { outcome: "superseded" };
    }

    await tx.verificationToken.deleteMany({
      where: { identifier, NOT: { token: claim.stored } }
    });

    return { outcome: "sent" };
  });
}
