#!/usr/bin/env node
/**
 * SOL-AUTH-07 ja -11 — sisselogimiskatse elutsükkel päris PostgreSQL-is.
 *
 *   npm run auth:attempt:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   -07 PIN-i vahetus ei tühistanud enne vahetust alustatud sisselogimist.
 *       „Ei saa enam sessiooni" ei ole rea puudumine — see on `authorize()`
 *       vastus. Sond kutsub seepärast NextAuthi PÄRIS credentials-provideri
 *       `authorize()` funktsiooni, mitte ei mõõda tabelit ja looda.
 *
 *   -11 sama katse sai väljastada mitu usaldatud seadet, sest `usedAt` täideti
 *       alles hiljem NextAuthis. Kas tingimuslik claim ja kasutajapõhine
 *       nõuandelukk päriselt serialiseerivad, otsustab ainult Postgres:
 *       fake-kliendi all on „loe → otsusta → kirjuta" alati järjestikune.
 *
 * Võistlus on deterministlik (`scripts/probe-race-harness.mjs`): kolmas tehing
 * hoiab lukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad.
 *
 * Andmed: ainult `@sol-auth-attempt.invalid` kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { generateOpaqueToken, hashOpaqueToken } from "../lib/auth/pin-login.js";
import {
  LoginAttemptClaimError,
  TRUSTED_DEVICE_LOCK_NAMESPACE,
  verifyLoginAttempt
} from "../lib/auth/loginAttemptVerification.js";
import { updateProfileForUser } from "../lib/profile/accountLifecycle.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const { authConfig } = await import("../auth.js");
/**
 * NB: `provider.authorize` on next-auth'i enda TÜHI vaikeväärtus (`() => null`);
 * päris funktsioon elab `provider.options.authorize` all ja liidetakse peale alles
 * provideri normaliseerimisel. Vale viide oleks andnud alati `null` — ja seega
 * oleks „vana token ei saa enam sessiooni" olnud triviaalselt roheline VALEL
 * põhjusel. Just selleks on allpool baasjoone kontroll „enne vahetust ANNAB".
 */
const provider = authConfig?.providers?.[0];
const credentialsAuthorize = provider?.options?.authorize || provider?.authorize;

const SUFFIX = "@sol-auth-attempt.invalid";
const NOW = new Date();
const HOUR = new Date(Date.now() + 60 * 60 * 1000);
const MONTH = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const tag = () => Math.random().toString(36).slice(2, 10);

async function makeUser() {
  return prisma.user.create({
    data: {
      email: `owner-${tag()}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: NOW,
      passwordHash: "hashed:0000",
      sessionVersion: 1
    }
  });
}

/** Loob sisselogimiskatse täpselt nii, nagu login-step1 seda teeb. */
async function startLoginAttempt(user, { requiresOtp = false, otpVerified = true } = {}) {
  const raw = generateOpaqueToken(32);
  const row = await prisma.loginTempToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(raw),
      requiresOtp,
      otpVerifiedAt: otpVerified ? NOW : null,
      expiresAt: HOUR
    }
  });
  return { raw, row: { id: row.id, userId: user.id, user: { role: user.role, isAdmin: false } } };
}

async function fillCredentialSurface(user) {
  const t = tag();
  await prisma.emailOtpCode.create({ data: { userId: user.id, codeHash: `otp-${t}`, expiresAt: HOUR } });
  await prisma.trustedDevice.create({ data: { userId: user.id, deviceTokenHash: `dev-${t}`, expiresAt: MONTH } });
  await prisma.session.create({ data: { sessionToken: `sess-${t}`, userId: user.id, expires: MONTH } });
}

async function surfaceCounts(userId) {
  const [temp, otp, device, session] = await Promise.all([
    prisma.loginTempToken.count({ where: { userId } }),
    prisma.emailOtpCode.count({ where: { userId } }),
    prisma.trustedDevice.count({ where: { userId } }),
    prisma.session.count({ where: { userId } })
  ]);
  return { temp, otp, device, session, total: temp + otp + device + session };
}

const changePin = (user) =>
  updateProfileForUser({
    db: prisma,
    userId: user.id,
    request: new Request("https://probe.invalid/api/profile", { headers: { "x-forwarded-for": "203.0.113.9" } }),
    nextPassword: "5678",
    currentPassword: "1234",
    verifyCurrentPassword: async () => ({ ok: true }),
    hashPin: async (pin) => `hashed:${pin}`
  });

const activeDevices = (userId) => prisma.trustedDevice.count({ where: { userId } });

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    await prisma.loginTempToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.emailOtpCode.deleteMany({ where: { userId: { in: ids } } });
    await prisma.trustedDevice.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-07/-11 — sisselogimiskatse päris andmebaasis\n");
  expect("NextAuthi credentials-provideri authorize() on kutsutav", typeof credentialsAuthorize === "function");
  await purge();

  // === 1. SOL-AUTH-07: PIN-i VAHETUS LÕPETAB KOGU EELMISE VOLITUSPINNA =====
  {
    const user = await makeUser();
    await fillCredentialSurface(user);
    const attempt = await startLoginAttempt(user);

    const before = await surfaceCounts(user.id);
    expect("enne: volituspind on täidetud", before.total === 4, JSON.stringify(before));

    // Vana PIN-i teadja sai sisse — see on lähtepunkt, mitte tulemus.
    const beforeAuth = await credentialsAuthorize({ temp_login_token: attempt.raw });
    expect("enne vahetust annab vana katse sessiooni", beforeAuth?.id === user.id);

    // Uus katse, sest eelmine on nüüd tarbitud; tema peal me vahetuse mõõdame.
    const pending = await startLoginAttempt(user);
    const result = await changePin(user);
    expect("PIN-i vahetus õnnestub", result.ok === true, JSON.stringify(result.error || {}));

    const after = await surfaceCounts(user.id);
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });

    expect("kõik neli volituspinda on tühjad", after.total === 0, JSON.stringify(after));
    expect("sessiooniversioon kasvas", userAfter.sessionVersion === 2, String(userAfter.sessionVersion));

    const afterAuth = await credentialsAuthorize({ temp_login_token: pending.raw });
    expect("VANA PIN-iga alustatud katse ei anna enam sessiooni", afterAuth === null, JSON.stringify(afterAuth));
  }

  // === 2. NEGATIIVKONTROLL: VANA KÄITUMINE (AINULT sessionVersion) =========
  /* Ilma selleta ei teaks me, kas plokk 1 roheline on paranduse teene või lihtsalt
     see, et token oli niikuinii kehtetu. */
  {
    const user = await makeUser();
    const pending = await startLoginAttempt(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: "hashed:5678", sessionVersion: { increment: 1 } }
    });

    const legacyAuth = await credentialsAuthorize({ temp_login_token: pending.raw });
    expect(
      "negatiivkontroll: ainult sessionVersion EI tühista pooleliolevat sisselogimist",
      legacyAuth?.id === user.id && legacyAuth?.sessionVersion === 2,
      JSON.stringify(legacyAuth)
    );
  }

  // === 3. SOL-AUTH-11: SAMA KATSE EI VÄLJASTA KAHTE SEADET =================
  {
    const user = await makeUser();
    const attempt = await startLoginAttempt(user);

    const issue = () =>
      verifyLoginAttempt({
        db: prisma,
        loginToken: attempt.row,
        rememberDevice: true,
        deviceExpiresAt: MONTH,
        now: new Date()
      });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "LoginTempToken" WHERE id = ${attempt.row.id} FOR UPDATE`,
      first: issue,
      second: issue,
      label: "sama katse kaks korda",
      expect
    });

    const winners = [resultA, resultB].filter((result) => !result.error);
    const losers = [resultA, resultB].filter((result) => result.error);

    expect("võidab täpselt üks", winners.length === 1, `võitjaid ${winners.length}`);
    expect(
      "kaotaja saab nimelise claim-vea, mitte suvalise erindi",
      losers[0]?.error instanceof LoginAttemptClaimError,
      String(losers[0]?.error)
    );
    expect("seadmeid on täpselt üks", (await activeDevices(user.id)) === 1, String(await activeDevices(user.id)));
  }

  // === 4. NEGATIIVKONTROLL: VANA MUSTER SAMA VÕISTLUSE ALL =================
  /* Vana rada: loo seade, seejärel `update({ where: { id } })` ilma tingimuseta. */
  {
    const user = await makeUser();
    const attempt = await startLoginAttempt(user);

    const legacyIssue = async () =>
      prisma.$transaction(async (tx) => {
        const device = await tx.trustedDevice.create({
          data: {
            userId: user.id,
            deviceTokenHash: hashOpaqueToken(generateOpaqueToken(32)),
            expiresAt: MONTH,
            lastUsedAt: new Date()
          }
        });
        await tx.loginTempToken.update({
          where: { id: attempt.row.id },
          data: { otpVerifiedAt: new Date(), trustedDeviceId: device.id }
        });
        return device.id;
      });

    await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "LoginTempToken" WHERE id = ${attempt.row.id} FOR UPDATE`,
      first: legacyIssue,
      second: legacyIssue,
      label: "vana muster",
      expect
    });

    const count = await activeDevices(user.id);
    expect(
      "negatiivkontroll: vana muster väljastab samast katsest KAKS seadet",
      count === 2,
      `seadmeid ${count} — kui 1, ei tekkinud võistlust`
    );
  }

  // === 5. SOL-AUTH-11: LIMIIT PEAB KA KAHE ERI KATSE ALL PAIKA PIDAMA ======
  /* Siin ei ole ühist tokenirida, seega ainus, mis neid järjestab, on nõuandelukk. */
  {
    const user = await makeUser();
    const max = 3;
    for (let index = 0; index < max; index += 1) {
      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          deviceTokenHash: `existing-${tag()}`,
          expiresAt: MONTH,
          lastUsedAt: new Date(2026, 0, index + 1)
        }
      });
    }
    const first = await startLoginAttempt(user);
    const second = await startLoginAttempt(user);

    const issue = (attempt) => () =>
      verifyLoginAttempt({
        db: prisma,
        loginToken: attempt.row,
        rememberDevice: true,
        deviceExpiresAt: MONTH,
        now: new Date()
      });

    await raceOnLockedRow({
      prisma,
      lockRow: (tx) =>
        tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRUSTED_DEVICE_LOCK_NAMESPACE}::int4, hashtext(${user.id})::int4)`,
      first: issue(first),
      second: issue(second),
      label: "kaks eri katset, täis limiit",
      expect
    });

    const count = await activeDevices(user.id);
    expect("limiiti ei ületata ka paralleelselt", count <= max, `seadmeid ${count}, limiit ${max}`);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const left = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  console.log(`  leftovers: ${left} users`);
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("\nUNCAUGHT", error);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
