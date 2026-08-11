import {
  generateOpaqueToken,
  getTrustedDeviceMaxForUser,
  hashOpaqueToken,
  pickTrustedDeviceIdsToEvict
} from "@/lib/auth/pin-login";

/**
 * Nõuandeluku nimeruum usaldatud seadmetele. `SESSION_LOCK_NAMESPACE` (4711) on
 * sessioonide oma — kaks eri piiri, kaks eri järjekorda, sama muster.
 */
export const TRUSTED_DEVICE_LOCK_NAMESPACE = 4712;

export const LOGIN_ATTEMPT_SETTLED = "LOGIN_ATTEMPT_SETTLED";
export const LOGIN_ATTEMPT_DEVICE_ISSUED = "LOGIN_ATTEMPT_DEVICE_ISSUED";

export class LoginAttemptClaimError extends Error {
  constructor(code) {
    super(code);
    this.name = "LoginAttemptClaimError";
    this.code = code;
  }
}

/**
 * Kinnitab ühe sisselogimiskatse ja väljastab valikuliselt ÜHE usaldatud seadme.
 *
 * Vana rada (SOL-AUTH-11) luges tokeni ja kontrollis `usedAt` väljaspool tehingut,
 * lõi seadme ja jättis tokeni tarbimata — `usedAt` täitis alles hilisem NextAuth
 * `authorize()`. Sama toortokeniga sai seega enne `signIn`-i teha mitu step2
 * POST-i ja saada mitu püsivat teise faktori möödapääsu, ka üle konto limiidi,
 * sest kõik paralleelsed päringud lugesid sama seadmete arvu.
 *
 * Kaks piiri, mõlemad andmebaasis:
 *
 *   1. **Kasutajapõhine nõuandelukk** serialiseerib „loe seadmed → tõsta välja →
 *      loo uus" ka kahe ERI tokeni vahel. Ilma temata on limiit ainult lootus.
 *   2. **Tingimuslik claim `trustedDeviceId: null` peal** teeb SAMAST katsest
 *      ühekordse seadmeväljastaja. Claim on tehingu sees ja tema kukkumine
 *      viskab, seega kaotaja loodud seaderida rullub tagasi — teda ei ole
 *      kunagi olnud.
 *
 * `usedAt` jääb NextAuthi claim'ida: sessiooni loomine on eraldi samm ja tema
 * CAS on `auth.js`-is. Siin on ainult see, mida step2 ise lõplikult otsustab.
 */
export async function verifyLoginAttempt({
  db,
  loginToken,
  rememberDevice = false,
  deviceName = null,
  fingerprint = null,
  ipRange = null,
  deviceExpiresAt,
  now = new Date(),
  generateToken = () => generateOpaqueToken(32),
  hashToken = hashOpaqueToken
}) {
  return db.$transaction(async (tx) => {
    let trustedDeviceId = null;
    let deviceToken = null;

    if (rememberDevice) {
      if (typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRUSTED_DEVICE_LOCK_NAMESPACE}::int4, hashtext(${loginToken.userId})::int4)`;
      }

      await tx.trustedDevice.deleteMany({
        where: { userId: loginToken.userId, expiresAt: { lte: now } }
      });

      const activeTrustedDevices = await tx.trustedDevice.findMany({
        where: { userId: loginToken.userId, expiresAt: { gt: now } },
        select: { id: true, lastUsedAt: true, createdAt: true }
      });

      const evictIds = pickTrustedDeviceIdsToEvict(
        activeTrustedDevices,
        Math.max(1, getTrustedDeviceMaxForUser(loginToken.user))
      );
      if (evictIds.length > 0) {
        await tx.trustedDevice.deleteMany({ where: { id: { in: evictIds } } });
      }

      deviceToken = generateToken();
      const record = await tx.trustedDevice.create({
        data: {
          userId: loginToken.userId,
          name: deviceName,
          deviceTokenHash: hashToken(deviceToken),
          userAgentFingerprint: fingerprint,
          ipRange,
          expiresAt: deviceExpiresAt,
          lastUsedAt: now
        }
      });
      trustedDeviceId = record.id;
    }

    // The claim decides. `trustedDeviceId: null` is what makes a second device
    // impossible for this attempt; without it the row above would simply stay.
    const claim = await tx.loginTempToken.updateMany({
      where: {
        id: loginToken.id,
        usedAt: null,
        ...(rememberDevice ? { trustedDeviceId: null } : {})
      },
      data: {
        otpVerifiedAt: now,
        // Never clear an already issued link: a later remember_device=false call
        // must not detach the device this attempt already handed out.
        ...(rememberDevice ? { trustedDeviceId } : {})
      }
    });

    if (Number(claim?.count || 0) !== 1) {
      throw new LoginAttemptClaimError(
        rememberDevice ? LOGIN_ATTEMPT_DEVICE_ISSUED : LOGIN_ATTEMPT_SETTLED
      );
    }

    return { trustedDeviceId, deviceToken };
  });
}
