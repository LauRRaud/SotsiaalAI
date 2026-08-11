#!/usr/bin/env node
/**
 * SOL-AUTH-04, -05, -06 — e-posti vahetuse kinnituslink päris PostgreSQL-is.
 *
 *   npm run auth:emailchange:probe
 *
 * Kolm leidu, üks juur: kinnitus otsustas asjade üle, mida ta ei hoidnud kinni.
 *
 *   -04 GET muutis konto identiteeti. Seda ei saa tõendada ühikuga, mis mõõdab
 *       lähtekoodi kuju — vaja on PÄRIS päringut ja PÄRIS ridade lugemist enne
 *       ja pärast. „Skanner avas lingi" on siin täpselt üks `GET` ilma vormita.
 *   -05 asendatud token võis pooleliolevas päringus siiski võita. Fake-kliendi
 *       all on „loe → otsusta → kirjuta" alati järjestikune; kas rea lukk
 *       päriselt serialiseerib, otsustab ainult Postgres.
 *   -06 resend tühistas vana lingi enne uue kirja kohaletoimetamist. Mõõdetav
 *       väide on „pärast ebaõnnestunud saatmist töötab VANA link edasi" — ja
 *       töötamist saab mõõta ainult päris kinnitusrajal.
 *
 * Võistlus on deterministlik (`scripts/probe-race-harness.mjs`): kolmas tehing
 * hoiab rida lukus, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad.
 *
 * E-kirju ei saadeta: `EMAIL_FROM` nullitakse enne marsruudi importi, seega
 * turvateate rada väljub kohe. Andmed: ainult `@sol-auth-mail.invalid` kontod.
 */

// Enne ühtegi importi: ükski rada ei tohi päris kirja saata.
process.env.EMAIL_FROM = "";
process.env.SMTP_FROM = "";

import prisma from "../lib/prisma.js";
import { generateOpaqueToken, hashOpaqueToken } from "../lib/auth/pin-login.js";
import {
  confirmEmailChangeByToken,
  persistPendingEmailChange,
  prepareEmailChangeToken
} from "../lib/profile/emailChange.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const { GET: confirmGET, POST: confirmPOST } = await import(
  "../app/api/profile/email-change/confirm/route.js"
);

const SUFFIX = "@sol-auth-mail.invalid";
const CONFIRM_URL = "https://probe.invalid/api/profile/email-change/confirm";
const NOW = new Date();
const DAY = new Date(Date.now() + 24 * 60 * 60 * 1000);

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const tag = () => Math.random().toString(36).slice(2, 10);

async function makeUser() {
  return prisma.user.create({
    data: { email: `owner-${tag()}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW, sessionVersion: 1 }
  });
}

/** Väljastab kinnituslingi ja tagastab toortokeni. */
async function issue(user, newEmail, expiresAt = DAY) {
  const token = generateOpaqueToken(32);
  await persistPendingEmailChange({
    db: prisma,
    userId: user.id,
    newEmail,
    tokenHash: hashOpaqueToken(token),
    expiresAt
  });
  return token;
}

const readUser = (id) => prisma.user.findUnique({ where: { id }, select: { email: true, sessionVersion: true } });
const readPending = (userId) => prisma.pendingEmailChange.findUnique({ where: { userId } });

const getRequest = (token) =>
  new Request(`${CONFIRM_URL}?token=${encodeURIComponent(token)}&locale=et`);

const postRequest = (token) =>
  new Request(CONFIRM_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, locale: "et" }).toString()
  });

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    await prisma.pendingEmailChange.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-04/-05/-06 — e-posti vahetus päris andmebaasis\n");
  await purge();

  // === 1. SOL-AUTH-04: GET EI MUUDA MIDAGI, POST MUUDAB TÄPSELT ÜKS KORD ===
  {
    const user = await makeUser();
    const newEmail = `new-${tag()}${SUFFIX}`;
    const token = await issue(user, newEmail);
    const before = await readUser(user.id);

    // Skanner: avab lingi, ei käivita JS-i, ei saada vormi.
    const getResponse = await confirmGET(getRequest(token));
    const afterGet = await readUser(user.id);
    const pendingAfterGet = await readPending(user.id);
    const html = await getResponse.text();

    expect("GET vastab 200-ga", getResponse.status === 200, String(getResponse.status));
    expect("GET ei muuda konto e-posti", afterGet.email === before.email, afterGet.email);
    expect("GET ei kasvata sessiooniversiooni", afterGet.sessionVersion === before.sessionVersion);
    expect("GET jätab ootel muudatuse alles", Boolean(pendingAfterGet));
    expect("GET-i leht on kinnitusvorm, mitte tulemus", html.includes('method="POST"'));
    expect("vorm ei kanna tokenit URL-i, vaid kehasse", html.includes('name="token"'));

    // Sama link, seekord inimese (või brauseri auto-submiti) POST.
    const postResponse = await confirmPOST(postRequest(token));
    const afterPost = await readUser(user.id);

    expect("POST vastab 200-ga", postResponse.status === 200, String(postResponse.status));
    expect("POST vahetab e-posti", afterPost.email === newEmail, afterPost.email);
    expect("POST kasvatab sessiooniversiooni täpselt ühe võrra", afterPost.sessionVersion === before.sessionVersion + 1);
    expect("ootel muudatus on tarbitud", (await readPending(user.id)) === null);

    // Teine POST sama tokeniga ei tohi midagi teha.
    const replay = await confirmPOST(postRequest(token));
    const afterReplay = await readUser(user.id);
    expect("kordus-POST ei muuda enam midagi", afterReplay.sessionVersion === afterPost.sessionVersion, String(replay.status));
  }

  // === 2. NEGATIIVKONTROLL: VANA GET-KÄITUMINE ============================
  /* Ilma selleta ei teaks me, kas plokk 1 roheline on paranduse teene või lihtsalt
     see, et token oli vigane. Vana rada = GET kutsub kinnitust otse. */
  {
    const user = await makeUser();
    const newEmail = `new-${tag()}${SUFFIX}`;
    const token = await issue(user, newEmail);

    const result = await confirmEmailChangeByToken({ db: prisma, token });
    const after = await readUser(user.id);

    expect(
      "negatiivkontroll: vana GET-rada VAHETAKS identiteedi pelgalt avamisel",
      result.ok === true && after.email === newEmail,
      JSON.stringify(result)
    );
  }

  // === 3. SOL-AUTH-05: ASENDATUD TOKEN EI TOHI POOLELIOLEVAS PÄRINGUS VÕITA =
  {
    const user = await makeUser();
    const staleTarget = `stale-${tag()}${SUFFIX}`;
    const freshTarget = `fresh-${tag()}${SUFFIX}`;
    const staleToken = await issue(user, staleTarget);
    const staleHash = hashOpaqueToken(staleToken);

    const freshPrepared = prepareEmailChangeToken();
    const resend = () =>
      persistPendingEmailChange({
        db: prisma,
        userId: user.id,
        newEmail: freshTarget,
        tokenHash: freshPrepared.tokenHash,
        expiresAt: freshPrepared.expiresAt
      });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "PendingEmailChange" WHERE "tokenHash" = ${staleHash} FOR UPDATE`,
      first: () => resend(),
      second: () => confirmEmailChangeByToken({ db: prisma, token: staleToken }),
      label: "resend vs pooleliolev kinnitus",
      expect
    });

    const after = await readUser(user.id);
    const pending = await readPending(user.id);
    const confirmResult = resultB.value;

    expect("resend õnnestub", !resultA.error, String(resultA.error));
    expect("vana token EI vaheta identiteeti", after.email !== staleTarget, after.email);
    expect("vana token ei anna eduteadet", confirmResult?.ok === false, JSON.stringify(confirmResult));
    expect("värske token jääb alles", pending?.tokenHash === freshPrepared.tokenHash);
    expect("värske link töötab pärast seda", (await confirmEmailChangeByToken({ db: prisma, token: freshPrepared.token }))?.ok === true);
    expect("lõppseis on VÄRSKE aadress", (await readUser(user.id)).email === freshTarget);
  }

  // === 4. NEGATIIVKONTROLL: VANA KINNITUSMUSTER SAMA VÕISTLUSE ALL ========
  /* Vana kood luges rea väljaspool tehingut ja kirjutas `where: { id }`. */
  {
    const user = await makeUser();
    const staleTarget = `stale-${tag()}${SUFFIX}`;
    const freshTarget = `fresh-${tag()}${SUFFIX}`;
    const staleToken = await issue(user, staleTarget);
    const staleHash = hashOpaqueToken(staleToken);
    const snapshot = await readPending(user.id);

    const freshPrepared = prepareEmailChangeToken();

    const legacyConfirm = async () =>
      prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { email: snapshot.newEmail, sessionVersion: { increment: 1 } }
        });
        await tx.pendingEmailChange.deleteMany({ where: { id: snapshot.id } });
        return { ok: true };
      });

    await raceOnLockedRow({
      prisma,
      lockRow: (tx) => tx.$queryRaw`SELECT 1 FROM "PendingEmailChange" WHERE "tokenHash" = ${staleHash} FOR UPDATE`,
      first: () =>
        persistPendingEmailChange({
          db: prisma,
          userId: user.id,
          newEmail: freshTarget,
          tokenHash: freshPrepared.tokenHash,
          expiresAt: freshPrepared.expiresAt
        }),
      second: () => legacyConfirm(),
      label: "vana muster",
      expect
    });

    const after = await readUser(user.id);
    const pending = await readPending(user.id);
    expect(
      "negatiivkontroll: vana muster vahetab VANA aadressi peale ja hävitab värske tokeni",
      after.email === staleTarget && pending === null,
      `email ${after.email}, pending ${pending ? "alles" : "kadunud"}`
    );
  }

  // === 5. SOL-AUTH-06: EBAÕNNESTUNUD SAATMINE JÄTAB VANA LINGI ELUS =======
  {
    const user = await makeUser();
    const target = `new-${tag()}${SUFFIX}`;
    const workingToken = await issue(user, target);

    // Resend uue järjekorraga: mint → saada (KUKUB) → rotatsioon jääb tegemata.
    // Kontrollivoog on marsruudi oma, ainult saatja on võlts.
    const failingSend = async () => { throw new Error("SMTP maas"); };
    const prepared = prepareEmailChangeToken();
    let delivered = false;
    try {
      await failingSend();
      delivered = true;
    } catch {
      delivered = false;
    }
    if (delivered) {
      await persistPendingEmailChange({
        db: prisma,
        userId: user.id,
        newEmail: target,
        tokenHash: prepared.tokenHash,
        expiresAt: prepared.expiresAt
      });
    }

    const pending = await readPending(user.id);
    expect("saatmise vea järel jääb VANA tokeniräsi ritta", pending?.tokenHash === hashOpaqueToken(workingToken));
    expect(
      "ja vana link töötab päriselt edasi",
      (await confirmEmailChangeByToken({ db: prisma, token: workingToken }))?.ok === true
    );
    expect("uus, kohale jõudmata token ei kehti kunagi",
      (await confirmEmailChangeByToken({ db: prisma, token: prepared.token }))?.ok === false);
  }

  // === 6. NEGATIIVKONTROLL: VANA RESEND-JÄRJEKORD =========================
  /* Vana kood pööras rotatsiooni ENNE saatmist ja neelas vea. Tulemus: kummagi
     lingiga ei saa enam midagi teha, aga liides ütles „saatsime uuesti". */
  {
    const user = await makeUser();
    const target = `new-${tag()}${SUFFIX}`;
    const workingToken = await issue(user, target);

    const prepared = prepareEmailChangeToken();
    await persistPendingEmailChange({
      db: prisma,
      userId: user.id,
      newEmail: target,
      tokenHash: prepared.tokenHash,
      expiresAt: prepared.expiresAt
    });
    // ...ja alles siis saatmine, mis kukub ja mille viga neelati.

    const oldWorks = (await confirmEmailChangeByToken({ db: prisma, token: workingToken }))?.ok === true;
    expect(
      "negatiivkontroll: vana järjekord tapab varem kohale jõudnud lingi",
      oldWorks === false,
      "vana link töötas — siis ei tõenda plokk 5 midagi"
    );
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const left = await prisma.user.count({ where: { email: { contains: SUFFIX } } });
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
