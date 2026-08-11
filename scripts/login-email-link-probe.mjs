#!/usr/bin/env node
/**
 * SOL-AUTH-08, -12 ja -13 — sisselogimise e-kirja link päris PostgreSQL-is.
 *
 *   npm run auth:emaillink:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   -08 „skanner ei kinnita midagi" ei ole väide funktsiooni kohta, vaid PÄRIS
 *       MARSRUUDI vastus: sond kutsub `login-confirm` GET-i ja POST-i endid ja
 *       mõõdab rida ENNE ja PÄRAST. Fake-kliendi all oleks „GET ei kirjuta"
 *       roheline ka siis, kui marsruut kirjutaks mõnda teise tabelisse.
 *
 *   -13 „vana link elab tarnetõrke üle" on samuti rea omadus: kinnitus peab
 *       pärast nurjunud resend'i päriselt LÄBI MINEMA, mitte ainult räsi ei tohi
 *       olla muutunud.
 *
 *   -12 baas-URL on puhas funktsioon, aga ta kuulub sama ploki tõendisse: ilma
 *       kanoonilise originita ei tohi kiri üldse tekkida.
 *
 * Igal parandusel on negatiivkontroll VANA käitumise vastu — muidu ei tea me,
 * kas roheline on paranduse teene või selle, et rada polnud kunagi päris.
 *
 * Andmed: ainult `@sol-auth-maillink.invalid` kontod; skript koristab lõpus.
 */

// Enne ühtegi importi: ükski rada ei tohi päris kirja saata.
process.env.EMAIL_FROM = "";
process.env.SMTP_FROM = "";

import prisma from "../lib/prisma.js";
import { generateOpaqueToken, hashOpaqueToken } from "../lib/auth/pin-login.js";
import {
  buildLoginConfirmUrl,
  confirmLoginEmailLink,
  persistLoginEmailLinkHash,
  prepareLoginEmailLink,
  resendLoginEmailLink
} from "../lib/auth/login-email-link.js";

const { GET: confirmGET, POST: confirmPOST } = await import(
  "../app/api/auth/login-confirm/route.js"
);

const SUFFIX = "@sol-auth-maillink.invalid";
const CONFIRM_URL = "https://probe.invalid/api/auth/login-confirm";
const NOW = new Date();
const HOUR = new Date(Date.now() + 60 * 60 * 1000);
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";

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
      passwordHash: "hashed:1234",
      sessionVersion: 1
    }
  });
}

/** Väljastab sisselogimiskatse täpselt nii, nagu login-step1 seda teeb. */
async function startAttempt(user, { expiresAt = HOUR } = {}) {
  const emailLinkToken = generateOpaqueToken(32);
  const row = await prisma.loginTempToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(generateOpaqueToken(32)),
      emailLinkTokenHash: hashOpaqueToken(emailLinkToken),
      requiresOtp: true,
      expiresAt,
      userAgent: AGENT,
      ipAddress: "203.0.113.9"
    }
  });
  return { emailLinkToken, id: row.id };
}

const readAttempt = (id) =>
  prisma.loginTempToken.findUnique({
    where: { id },
    select: { otpVerifiedAt: true, emailLinkTokenHash: true, usedAt: true }
  });

/** Postkasti skanner: pelk GET, ilma vormi saatmata. */
const scannerGet = (token) =>
  confirmGET(new Request(`${CONFIRM_URL}?token=${encodeURIComponent(token)}&locale=et`));

/** Inimese nupuvajutus: vormi POST. */
const humanPost = (token) =>
  confirmPOST(
    new Request(CONFIRM_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, locale: "et" }).toString()
    })
  );

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    await prisma.loginTempToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-08/-12/-13 — sisselogimise e-kirja link päris andmebaasis\n");
  await purge();

  // === 1. SOL-AUTH-08: SKANNERI GET EI KINNITA MIDAGI =====================
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);

    const response = await scannerGet(attempt.emailLinkToken);
    const html = await response.text();
    const after = await readAttempt(attempt.id);

    expect("GET vastab 200-ga", response.status === 200, String(response.status));
    expect("GET EI kinnita katset", after.otpVerifiedAt === null, String(after.otpVerifiedAt));
    expect(
      "GET ei tarbi linki ära",
      after.emailLinkTokenHash === hashOpaqueToken(attempt.emailLinkToken)
    );
    expect("leht pakub POST-vormi, mitte valmis fakti", /method="POST"/.test(html));
    expect("vorm ei saada ennast ise", !/\.submit\(\)/.test(html));
    expect("leht näitab katse konteksti (seade + IP)", /203\.0\.113\.9/.test(html) && /Chrome/.test(html));
  }

  // === 2. SOL-AUTH-08: INIMESE POST KINNITAB TÄPSELT ÜHE KATSE ============
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);
    const other = await startAttempt(user);

    const response = await humanPost(attempt.emailLinkToken);
    const confirmed = await readAttempt(attempt.id);
    const untouched = await readAttempt(other.id);

    expect("POST vastab 200-ga", response.status === 200, String(response.status));
    expect("POST kinnitab katse", confirmed.otpVerifiedAt instanceof Date);
    expect("link on tarbitud", confirmed.emailLinkTokenHash === null);
    expect("teine katse jääb puutumata", untouched.otpVerifiedAt === null);

    const again = await humanPost(attempt.emailLinkToken);
    expect("sama link teist korda annab 400", again.status === 400, String(again.status));
  }

  // === 3. NEGATIIVKONTROLL: VANA GET-RADA KINNITAS AVAMISEL ==============
  /* Ilma selleta ei tea me, kas plokk 1 roheline on paranduse teene või lihtsalt
     see, et katse oli niikuinii kinnitamatu. */
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);

    const legacyGet = async (token) => {
      const at = new Date();
      return prisma.loginTempToken.updateMany({
        where: {
          emailLinkTokenHash: hashOpaqueToken(token),
          requiresOtp: true,
          otpVerifiedAt: null,
          usedAt: null,
          expiresAt: { gt: at }
        },
        data: { otpVerifiedAt: at, emailLinkTokenHash: null }
      });
    };

    const result = await legacyGet(attempt.emailLinkToken);
    const after = await readAttempt(attempt.id);
    expect(
      "negatiivkontroll: vana GET-rada kinnitab teise faktori pelgalt avamisel",
      result.count === 1 && after.otpVerifiedAt instanceof Date,
      `count ${result.count}`
    );
  }

  // === 4. KEHTETU, AEGUNUD JA TARBITUD LINK EI AVALDA MIDAGI =============
  {
    const user = await makeUser();
    const expired = await startAttempt(user, { expiresAt: new Date(Date.now() - 60 * 1000) });

    const unknown = await scannerGet(generateOpaqueToken(32));
    const stale = await scannerGet(expired.emailLinkToken);
    const staleHtml = await stale.text();

    expect("tundmatu link annab 400", unknown.status === 400, String(unknown.status));
    expect("aegunud link annab 400", stale.status === 400, String(stale.status));
    expect("aegunud lehel ei ole katse konteksti", !/203\.0\.113\.9/.test(staleHtml));
    expect("aegunud link jääb kinnitamata", (await readAttempt(expired.id)).otpVerifiedAt === null);
  }

  // === 5. SOL-AUTH-13: TARNETÕRGE EI TOHI VANA LINKI TAPPA ===============
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);

    const result = await resendLoginEmailLink({
      db: prisma,
      loginTokenId: attempt.id,
      deliver: async () => {
        throw new Error("smtp down");
      }
    });

    expect("nurjunud resend ei vasta eduga", result.ok === false && result.reason === "delivery");

    // Tõend ei ole räsi võrdlus, vaid see, et vana link läheb PÄRISELT läbi.
    const stillWorks = await humanPost(attempt.emailLinkToken);
    expect(
      "kohale jõudnud vana link kinnitab pärast nurjunud resend'i edasi",
      stillWorks.status === 200 && (await readAttempt(attempt.id)).otpVerifiedAt instanceof Date,
      String(stillWorks.status)
    );
  }

  // === 6. SOL-AUTH-13: ÕNNESTUNUD RESEND ROTREERIB ALLES PÄRAST SAATMIST ==
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);
    let hashAtSendTime = null;
    let deliveredToken = null;

    const result = await resendLoginEmailLink({
      db: prisma,
      loginTokenId: attempt.id,
      deliver: async (token) => {
        deliveredToken = token;
        hashAtSendTime = (await readAttempt(attempt.id)).emailLinkTokenHash;
      }
    });

    const after = await readAttempt(attempt.id);
    expect("resend õnnestub", result.ok === true);
    expect(
      "saatmise HETKEL kannab rida veel VANA räsi",
      hashAtSendTime === hashOpaqueToken(attempt.emailLinkToken)
    );
    expect("pärast saatmist on reas UUS räsi", after.emailLinkTokenHash === hashOpaqueToken(deliveredToken));

    const oldLink = await confirmLoginEmailLink({ db: prisma, token: attempt.emailLinkToken });
    expect("vana link on nüüd pensionil", oldLink.ok === false);
    const newLink = await humanPost(deliveredToken);
    expect("uus link kinnitab", newLink.status === 200, String(newLink.status));
  }

  // === 7. NEGATIIVKONTROLL: VANA JÄRJEKORD TAPAB LINGI ENNE SAATMIST =====
  {
    const user = await makeUser();
    const attempt = await startAttempt(user);
    const prepared = prepareLoginEmailLink();

    // Vana rada: kirjuta räsi, SIIS proovi saata (ja kuku).
    await persistLoginEmailLinkHash({ db: prisma, id: attempt.id, tokenHash: prepared.tokenHash });

    const stale = await confirmLoginEmailLink({ db: prisma, token: attempt.emailLinkToken });
    expect(
      "negatiivkontroll: vana järjekord tapab kohale jõudnud lingi juba enne saatmiskatset",
      stale.ok === false
    );
  }

  // === 8. SOL-AUTH-12: LINK EI SÜNNI ILMA KANOONILISE ORIGINITA ==========
  {
    const saved = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      AUTH_URL: process.env.AUTH_URL,
      APP_URL: process.env.APP_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      NODE_ENV: process.env.NODE_ENV
    };
    for (const key of Object.keys(saved)) delete process.env[key];
    process.env.NODE_ENV = "production";

    let threw = false;
    try {
      buildLoginConfirmUrl("raw", "et");
    } catch (error) {
      threw = /base_url_missing/.test(String(error?.message));
    }
    expect("puuduv baas-URL keeldub lingi ehitamisest", threw);

    process.env.NEXTAUTH_URL = "https://sotsiaal.ai";
    const url = new URL(buildLoginConfirmUrl("raw", "et"));
    expect("origin tuleb konfiguratsioonist", url.origin === "https://sotsiaal.ai", url.origin);
    expect("funktsioon ei võta enam request'i", buildLoginConfirmUrl.length === 2);

    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
