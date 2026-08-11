#!/usr/bin/env node
/**
 * SOL-AUTH-09 ja -10 — PIN-katsete piir ja ühtne credential-vastus päris PostgreSQL-is.
 *
 *   npm run auth:throttle:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   -09 „loendur on jagatud ja püsiv" ei ole väide funktsiooni kohta — ta on väide KAHE
 *       PROTSESSI kohta. Vana bucket elas mooduli mälus, seega teine instants alustas alati
 *       nullist; seda ei saa ühe protsessi sees mõõta. Sond käivitab `spawn`-iga päris teise
 *       protsessi ja nõuab, et limiit oleks nendega ÜHINE. Sama laps jooksutatakse ka vana,
 *       mälupõhise loenduriga — seal peab ta lubama kõik.
 *
 *   -10 „tundmatu e-post ja vale PIN näevad ühesugused välja" on marsruudi vastuse omadus:
 *       staatus, kood, sõnum JA ajastus. Ajastust ei saa fake-kliendi all mõõta, sest seal ei
 *       ole bcryptil kulu.
 *
 * Ühtlasi mõõdab sond nende kahe leiu KOKKUPUUTEPUNKTI: kui loendur käiks kasutaja ID järgi,
 * lukustuks ainult olemasolev konto ja 429 ise oleks oraakel.
 *
 * Andmed: ainult `@sol-auth-throttle.invalid` kontod; skript koristab lõpus.
 */

// Enne ühtegi importi: ükski rada ei tohi kirja saata, ja mooduli tasemel loetavad limiidid
// peavad olema laiad, et sondi enda päringud ei jookseks EELVÄRAVA otsa.
process.env.EMAIL_FROM = "";
process.env.SMTP_FROM = "";
process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
process.env.LOGIN_STEP1_RATE_LIMIT_PER_IP = "10000";
process.env.LOGIN_STEP1_RATE_LIMIT_PER_EMAIL = "10000";
process.env.LOGIN_PIN_MAX_ATTEMPTS_PER_EMAIL = "4";
process.env.LOGIN_PIN_MAX_ATTEMPTS_PER_IP = "10000";

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { hash } from "bcrypt";

import prisma from "../lib/prisma.js";
import {
  PIN_THROTTLE_EMAIL_SCOPE,
  clearLoginThrottle,
  consumeLoginThrottle,
  pruneExpiredLoginThrottles,
  throttleSubjectForEmail
} from "../lib/auth/loginThrottle.js";

import { authenticatePinAttempt } from "../lib/auth/pinLoginAttempt.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// `--import` lahendab oma argumendi URL-ina, seega Windowsi `C:\…` annab talle protokolli
// `c:` ja laps sureb `ERR_UNSUPPORTED_ESM_URL_SCHEME`-ga. Skripti tee ise (CHILD) on tavaline
// argument ja tohib jääda teeks.
const LOADER = pathToFileURL(path.join(ROOT, "scripts", "register-node-test-loader.mjs")).href;
const CHILD = path.join(ROOT, "scripts", "probes", "login-throttle-child.mjs");

const SUFFIX = "@sol-auth-throttle.invalid";
const WINDOW_MS = 15 * 60 * 1000;

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const tag = () => Math.random().toString(36).slice(2, 10);

/** Päris teine rakendusinstants — tema mälu on tühi, tema andmebaas on sama. */
function runChild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", LOADER, CHILD, ...args], {
      cwd: ROOT,
      env: process.env
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { err += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(out.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)))
        : reject(new Error(`child exited ${code}: ${err.trim().split("\n").slice(0, 6).join(" | ")}`))
    );
  });
}

const attempt = (subject, limit) =>
  consumeLoginThrottle({
    db: prisma,
    scope: PIN_THROTTLE_EMAIL_SCOPE,
    subject,
    limit,
    windowMs: WINDOW_MS,
    lockMs: WINDOW_MS
  });

async function makeUser(pin = "1234") {
  return prisma.user.create({
    data: {
      email: `owner-${tag()}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: new Date(),
      passwordHash: await hash(pin, 12),
      sessionVersion: 1
    }
  });
}

/** Päris PIN-katse: päris andmebaas, päris bcrypt, päris ajastus. */
const step1 = (email, pin) => authenticatePinAttempt({ db: prisma, email, pin });

async function timedStep1(email, pin) {
  const started = process.hrtime.bigint();
  const result = await step1(email, pin);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { result, ms };
}

async function purgeThrottles() {
  await prisma.authThrottleCounter.deleteMany({ where: { scope: { startsWith: "pin:" } } });
}

async function purge() {
  await purgeThrottles();
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-09/-10 — PIN-katsete piir ja credential-vastus päris andmebaasis\n");
  await purge();

  // === 1. LOENDUR ON PÜSIV JA ATOMAARNE ==================================
  {
    const subject = `subject-${tag()}`;
    const results = [];
    for (let index = 0; index < 5; index += 1) results.push(await attempt(subject, 3));

    expect(
      "limiit 3 lubab täpselt 3 katset",
      results.filter((row) => row.allowed).length === 3,
      JSON.stringify(results.map((row) => row.allowed))
    );
    expect("neljas katse lukustab", results[3].reason === "locked");
    expect("lukk annab retryAfter", results[3].retryAfterSec > 0, String(results[3].retryAfterSec));

    const row = await prisma.authThrottleCounter.findUnique({
      where: { scope_subject: { scope: PIN_THROTTLE_EMAIL_SCOPE, subject } }
    });
    expect("loendur on PÄRIS reas, mitte mälus", Boolean(row) && row.lockedUntil instanceof Date);
  }

  // === 2. PARALLEELSED KATSED EI ÜLETA LIMIITI ===========================
  /* Ilma nõuandelukuta loeksid kõik kuus sama seisu ja kõik kuus saaksid „esimene katse". */
  {
    const subject = `subject-${tag()}`;
    const results = await Promise.all(Array.from({ length: 6 }, () => attempt(subject, 3)));
    const allowed = results.filter((row) => row.allowed).length;
    expect("kuus samaaegset katset annavad täpselt 3 lubatut", allowed === 3, `lubatuid ${allowed}`);
  }

  // === 3. KAKS RAKENDUSINSTANTSI JAGAVAD SAMA LIMIITI ====================
  {
    const subject = `subject-${tag()}`;
    const mine = [];
    for (let index = 0; index < 2; index += 1) mine.push(await attempt(subject, 3));
    expect("vanem kulutas 2 katset", mine.every((row) => row.allowed));

    const [childResult] = await runChild(["persistent", subject, "3", "3"]);
    expect(
      "teine protsess on päriselt teine",
      Number(childResult.pid) > 0 && Number(childResult.pid) !== process.pid,
      `pid ${childResult.pid}`
    );
    expect(
      "teine instants saab kasutada ainult ÜLEJÄÄNUD katset",
      childResult.allowed === 1,
      `laps sai ${childResult.allowed}`
    );

    // === 4. RESTART EI NULLI LOENDURIT ===================================
    const [afterRestart] = await runChild(["persistent", subject, "3", "2"]);
    expect(
      "kolmas, värskelt käivitunud instants ei saa ühtki katset",
      afterRestart.allowed === 0,
      `laps sai ${afterRestart.allowed}`
    );
  }

  // === 5. NEGATIIVKONTROLL: VANA MÄLUPÕHINE LOENDUR ======================
  /* Sama laps, sama limiit, ainult loendur on vana. Kui ta lubaks siin ka ainult ühe, ei
     mõõdaks plokk 3 midagi — siis oleks limiit kuskil mujal. */
  {
    const subject = `subject-${tag()}`;
    const [first] = await runChild(["memory", subject, "3", "2"]);
    const [second] = await runChild(["memory", subject, "3", "3"]);
    expect(
      "negatiivkontroll: mälupõhine loendur annab IGALE instantsile oma täie limiidi",
      first.allowed === 2 && second.allowed === 3,
      `esimene ${first.allowed}, teine ${second.allowed}`
    );
  }

  // === 6. TURVALINE TAASTAMINE JA LUKU AEGUMINE ==========================
  {
    const subject = `subject-${tag()}`;
    for (let index = 0; index < 4; index += 1) await attempt(subject, 3);
    expect("subjekt on lukus", (await attempt(subject, 3)).allowed === false);

    await clearLoginThrottle({ db: prisma, scope: PIN_THROTTLE_EMAIL_SCOPE, subject });
    expect("õnnestunud sisselogimine vabastab loenduri", (await attempt(subject, 3)).allowed === true);

    // Lukk aegub ise: nihutame ta minevikku ja nõuame, et uus aken algaks.
    await prisma.authThrottleCounter.update({
      where: { scope_subject: { scope: PIN_THROTTLE_EMAIL_SCOPE, subject } },
      data: {
        count: 99,
        lockedUntil: new Date(Date.now() - 1000),
        windowEndsAt: new Date(Date.now() - 1000)
      }
    });
    const afterLock = await attempt(subject, 3);
    expect("aegunud lukk avab uue akna, ei jää igaveseks kinni", afterLock.allowed === true);

    await prisma.authThrottleCounter.update({
      where: { scope_subject: { scope: PIN_THROTTLE_EMAIL_SCOPE, subject } },
      data: { windowEndsAt: new Date(Date.now() - 1000), lockedUntil: null }
    });
    const pruned = await pruneExpiredLoginThrottles({ db: prisma });
    expect("aegunud loendurid on koristatavad", pruned >= 1, `pruned ${pruned}`);
  }

  // === 7. SOL-AUTH-10: TUNDMATU E-POST JA VALE PIN ON ERISTAMATUD ========
  {
    await purgeThrottles();
    const user = await makeUser("1234");

    const wrongPin = await timedStep1(user.email, "9999");
    await purgeThrottles();
    const unknown = await timedStep1(`ghost-${tag()}${SUFFIX}`, "9999");
    await purgeThrottles();
    const suspended = await makeUser("1234");
    await prisma.user.update({
      where: { id: suspended.id },
      data: { accessSuspendedAt: new Date() }
    });
    const blocked = await timedStep1(suspended.email, "1234");

    expect(
      "kõik kolm rada annavad sama tulemuse",
      wrongPin.result.outcome === "invalid" &&
        unknown.result.outcome === "invalid" &&
        blocked.result.outcome === "invalid",
      `${wrongPin.result.outcome} / ${unknown.result.outcome} / ${blocked.result.outcome}`
    );
    expect(
      "põhjus jääb ainult serveripoolde, mitte tulemusse",
      wrongPin.result.reason === "wrong_pin" && unknown.result.reason === "unknown_email",
      `${wrongPin.result.reason} vs ${unknown.result.reason}`
    );
    expect(
      "peatatud konto ei anna eraldi rada ka ÕIGE PIN-iga",
      blocked.result.outcome === "invalid" && blocked.result.reason === "no_usable_credential"
    );

    // Ajastus: bcrypt cost 12 peab jooksma MÕLEMAL rajal.
    const ratio = Math.max(wrongPin.ms, unknown.ms) / Math.max(1, Math.min(wrongPin.ms, unknown.ms));
    expect(
      "vastuseaeg on võrreldav (peibutusräsi jookseb ka tundmatul kontol)",
      ratio < 2,
      `${wrongPin.ms.toFixed(0)} ms vs ${unknown.ms.toFixed(0)} ms (suhe ${ratio.toFixed(2)})`
    );

    // Negatiivkontroll ajastusele: ilma bcryptita on tundmatu konto rada kordades kiirem —
    // just see vahe oli enne parandust vastuse sees.
    const bare = process.hrtime.bigint();
    await prisma.user.findUnique({ where: { email: `ghost-${tag()}${SUFFIX}` }, select: { id: true } });
    const bareMs = Number(process.hrtime.bigint() - bare) / 1e6;
    expect(
      "negatiivkontroll: ilma peibutusräsita oleks tundmatu konto rada tunduvalt kiirem",
      bareMs * 3 < unknown.ms,
      `paljas päring ${bareMs.toFixed(0)} ms vs marsruut ${unknown.ms.toFixed(0)} ms`
    );
  }

  // === 8. -09 JA -10 KOKKUPUUDE: LUKUSTUS EI TOHI OLLA ORAAKEL ===========
  /* Kui loendur käiks kasutaja ID järgi, lukustuks ainult OLEMASOLEV konto ja 429 ise ütleks
     ära, kas aadress on registreeritud. Subjekt on e-posti räsi just sellepärast. */
  {
    await purgeThrottles();
    const user = await makeUser("1234");
    const ghost = `ghost-${tag()}${SUFFIX}`;

    const knownOutcomes = [];
    for (let index = 0; index < 6; index += 1) {
      knownOutcomes.push((await step1(user.email, "9999")).outcome);
    }
    const ghostOutcomes = [];
    for (let index = 0; index < 6; index += 1) {
      ghostOutcomes.push((await step1(ghost, "9999")).outcome);
    }

    expect(
      "olemasolev konto lukustub pärast limiiti",
      knownOutcomes.filter((outcome) => outcome === "rate_limited").length > 0,
      knownOutcomes.join(",")
    );
    expect(
      "tundmatu aadress lukustub TÄPSELT SAMAMOODI",
      JSON.stringify(knownOutcomes) === JSON.stringify(ghostOutcomes),
      `${knownOutcomes.join(",")} vs ${ghostOutcomes.join(",")}`
    );

    const ghostRow = await prisma.authThrottleCounter.findUnique({
      where: {
        scope_subject: { scope: PIN_THROTTLE_EMAIL_SCOPE, subject: throttleSubjectForEmail(ghost) }
      }
    });
    expect("ka tundmatul aadressil on päris loendur", Boolean(ghostRow));
    expect("e-post ei seisa loenduri reas toorelt", !JSON.stringify(ghostRow).includes(ghost));
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
