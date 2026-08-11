#!/usr/bin/env node
/**
 * SOL-AUTH-03 — konto taastamise link ja tema andmebaasirida, päris PostgreSQL-is.
 *
 *   npm run auth:token:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Kaks asja:
 *
 *   1. LEKE. Leid ei ole „vale funktsioon", vaid „reas seisab kasutatav link".
 *      Seda saab ausalt mõõta ainult nii, et rida LOETAKSE andmebaasist ja tema
 *      väärtus esitatakse tarbimisrajale nii, nagu ta oleks kirjast tulnud.
 *      Fake-klient tagastab selle, mille test ise sisse pani — ta ei tõenda,
 *      mis kettale jõudis.
 *
 *   2. ÜHEKORDSUS. Uus tarbimine claim'ib rea `deleteMany`-ga TEHINGU SEES enne
 *      ühtegi kirjutust. Kas see päriselt serialiseerib, otsustab Postgres'i rea
 *      lukk — fake-kliendi all on „loe → otsusta → kirjuta" alati järjestikune
 *      ja ka vana kood oleks roheline.
 *
 * Võistlus on deterministlik, mitte „mahtusid ühte sekundisse": kolmas tehing
 * hoiab tokeni rea lukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad
 * ootavad, alles siis lastakse lukk lahti (`scripts/probe-race-harness.mjs`).
 *
 * Andmed: ainult `@sol-auth-token.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { resetPasswordWithToken, RESET_IDENTIFIER_PREFIX } from "../lib/auth/passwordResetLifecycle.js";
import { createVerificationTokenSecret } from "../lib/auth/verificationTokens.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const SUFFIX = "@sol-auth-token.invalid";
const NOW = new Date();
const HOUR = new Date(Date.now() + 60 * 60 * 1000);

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const hashPin = async (pin) => `hashed:${pin}`;

async function makeUser() {
  const email = `owner-${Math.random().toString(36).slice(2, 10)}${SUFFIX}`;
  return prisma.user.create({
    data: { email, role: "SOCIAL_WORKER", emailVerified: NOW, passwordHash: "hashed:0000", sessionVersion: 1 }
  });
}

/** Täidab kogu sessioonipinna, et paranduse „tühjendab kõik" lubadust saaks MÕÕTA. */
async function fillSessionSurface(user) {
  const tag = Math.random().toString(36).slice(2, 10);
  await prisma.session.create({
    data: { sessionToken: `sess-${tag}`, userId: user.id, expires: HOUR }
  });
  await prisma.trustedDevice.create({
    data: { userId: user.id, deviceTokenHash: `dev-${tag}`, expiresAt: HOUR }
  });
  await prisma.loginTempToken.create({
    data: { userId: user.id, tokenHash: `tmp-${tag}`, expiresAt: HOUR }
  });
  await prisma.emailOtpCode.create({
    data: { userId: user.id, codeHash: `otp-${tag}`, expiresAt: HOUR }
  });
}

async function sessionSurfaceCount(userId) {
  const [sessions, devices, temps, otps] = await Promise.all([
    prisma.session.count({ where: { userId } }),
    prisma.trustedDevice.count({ where: { userId } }),
    prisma.loginTempToken.count({ where: { userId } }),
    prisma.emailOtpCode.count({ where: { userId } })
  ]);
  return sessions + devices + temps + otps;
}

/** Väljastab lingi täpselt nii, nagu `POST /api/auth/password/reset` seda teeb. */
async function issueResetLink(user) {
  const { raw, stored } = createVerificationTokenSecret();
  const identifier = `${RESET_IDENTIFIER_PREFIX}${user.email}`;
  await prisma.verificationToken.create({ data: { identifier, token: stored, expires: HOUR } });
  return { raw, stored, identifier };
}

/** Väljastab lingi VANA moodi: toorväärtus läheb ritta. */
async function issueLegacyResetLink(user) {
  const { raw } = createVerificationTokenSecret();
  const identifier = `${RESET_IDENTIFIER_PREFIX}${user.email}`;
  await prisma.verificationToken.create({ data: { identifier, token: raw, expires: HOUR } });
  return { raw, identifier };
}

const readRow = (identifier) => prisma.verificationToken.findFirst({ where: { identifier } });

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true, email: true } });
  for (const user of users) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: `${RESET_IDENTIFIER_PREFIX}${user.email}` }
    });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-03 — link ja tema rida päris andmebaasis\n");
  await purge();

  // === 1. RIDA EI OLE LINK ===============================================
  {
    const user = await makeUser();
    const { raw, identifier } = await issueResetLink(user);
    const row = await readRow(identifier);

    expect("väljastatud rida ei sisalda toorlinki", row.token !== raw, "rida = link");
    expect("rida kannab räsitud kuju", row.token.startsWith("v2:"), row.token.slice(0, 8));
    expect(
      "toorlink ei ole reas kusagil ka osastringina",
      !row.token.includes(raw),
      "toorväärtus leitav reast"
    );
  }

  // === 2. ANDMEBAASIST LOETUD VÄÄRTUS EI OLE KASUTATAV LINK ===============
  /* Leiu tuum: dump/varukoopia/diagnostikapäring ei tohi anda konto ülevõtmist. */
  {
    const user = await makeUser();
    const { identifier } = await issueResetLink(user);
    const row = await readRow(identifier);

    const result = await resetPasswordWithToken({ db: prisma, token: row.token, pin: "4321", hashPin });
    const after = await prisma.user.findUnique({ where: { id: user.id } });

    expect("reast loetud väärtusega ei saa parooli vahetada", result.ok === false, JSON.stringify(result));
    expect("keeldumine on „vigane token”", result.error?.messageKey === "api.auth.reset.token_invalid", result.error?.messageKey);
    expect("PIN jäi muutmata", after.passwordHash === "hashed:0000", after.passwordHash);
    expect("sessiooniversioon jäi muutmata", after.sessionVersion === 1, String(after.sessionVersion));
    expect("rida jäi alles — võõras ei saa ka teise linki ära põletada", Boolean(await readRow(identifier)));
  }

  // === 3. PÄRIS LINK TÖÖTAB JA TÜHJENDAB KOGU SESSIOONIPINNA =============
  {
    const user = await makeUser();
    await fillSessionSurface(user);
    const { raw, identifier } = await issueResetLink(user);
    expect("sessioonipind on enne täidetud", (await sessionSurfaceCount(user.id)) === 4);

    const result = await resetPasswordWithToken({ db: prisma, token: raw, pin: "4321", hashPin });
    const after = await prisma.user.findUnique({ where: { id: user.id } });

    expect("kirjast tulnud link töötab", result.ok === true, JSON.stringify(result.error || {}));
    expect("uus PIN on kirjas", after.passwordHash === "hashed:4321", after.passwordHash);
    expect("sessiooniversioon kasvas", after.sessionVersion === 2, String(after.sessionVersion));
    expect("kogu sessioonipind on tühi", (await sessionSurfaceCount(user.id)) === 0, String(await sessionSurfaceCount(user.id)));
    expect("token on tarbitud", (await readRow(identifier)) === null);
  }

  // === 4. KAKS SAMAAEGSET TARBIMIST — VÕIDAB TÄPSELT ÜKS =================
  {
    const user = await makeUser();
    const { raw, stored, identifier } = await issueResetLink(user);

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "VerificationToken" WHERE token = ${stored} FOR UPDATE`,
      first: () => resetPasswordWithToken({ db: prisma, token: raw, pin: "1111", hashPin }),
      second: () => resetPasswordWithToken({ db: prisma, token: raw, pin: "2222", hashPin }),
      label: "sama link kaks korda",
      expect
    });

    const winners = [resultA, resultB].filter((result) => result.value?.ok === true);
    const losers = [resultA, resultB].filter((result) => result.value?.ok === false);
    const after = await prisma.user.findUnique({ where: { id: user.id } });

    expect("võidab täpselt üks", winners.length === 1, `võitjaid ${winners.length}`);
    expect("kaotaja ei saa erindit, vaid ausa keeldumise", losers.length === 1 && !resultA.error && !resultB.error);
    expect(
      "kaotaja keeldumine on „vigane token”",
      losers[0]?.value?.error?.messageKey === "api.auth.reset.token_invalid",
      losers[0]?.value?.error?.messageKey
    );
    expect("PIN vahetus täpselt üks kord", after.sessionVersion === 2, `sessionVersion ${after.sessionVersion}`);
    expect("token on tarbitud", (await readRow(identifier)) === null);
  }

  // === 5. NEGATIIVKONTROLL A: VANA VÄLJASTUS = REST LOETUD TÖÖTAV LINK ====
  /* Ilma selleta ei teaks me, kas plokk 2 roheline on paranduse teene või lihtsalt
     see, et tarbimisrada ei tööta. Vana reas seisab toorväärtus — ja ta TÖÖTAB. */
  {
    const user = await makeUser();
    await issueLegacyResetLink(user);
    const identifier = `${RESET_IDENTIFIER_PREFIX}${user.email}`;
    const row = await readRow(identifier);

    const result = await resetPasswordWithToken({ db: prisma, token: row.token, pin: "9999", hashPin });
    const after = await prisma.user.findUnique({ where: { id: user.id } });

    expect(
      "negatiivkontroll: VANA rea väärtus ON töötav link (leke oli päris)",
      result.ok === true && after.passwordHash === "hashed:9999",
      JSON.stringify(result.error || {})
    );
    expect("pärandrida tarbitakse ära, mitte ei jäeta rippuma", (await readRow(identifier)) === null);
  }

  // === 6. NEGATIIVKONTROLL B: VANA CLAIM SAMA VÕISTLUSE ALL ==============
  /* Vana järjekord oli „kirjuta, siis kustuta unikaalse võtme järgi". Kaotaja
     `delete` viskab P2025 → kogu tehing rullub tagasi ja kasutaja saab 500.
     See mõõdab ühtlasi, et plokis 4 tekkis PÄRIS võistlus. */
  {
    const user = await makeUser();
    const { stored, identifier } = await issueResetLink(user);

    const legacyConsume = async (pin) => {
      const row = await prisma.verificationToken.findFirst({ where: { identifier } });
      if (!row) throw new Error("token_invalid");
      return prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: `hashed:${pin}`, sessionVersion: { increment: 1 } } });
        await tx.verificationToken.delete({
          where: { identifier_token: { identifier: row.identifier, token: row.token } }
        });
        return { ok: true };
      });
    };

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "VerificationToken" WHERE token = ${stored} FOR UPDATE`,
      first: () => legacyConsume("1111"),
      second: () => legacyConsume("2222"),
      label: "vana muster",
      expect
    });

    const thrown = [resultA, resultB].filter((result) => result.error).length;
    expect(
      "negatiivkontroll: vana muster viskab kaotaja peal erindi (uus annab 400)",
      thrown === 1,
      `erindeid ${thrown} — kui 0, ei tekkinud võistlust`
    );
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
