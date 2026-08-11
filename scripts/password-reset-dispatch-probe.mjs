#!/usr/bin/env node
/**
 * SOL-AUTH-15 — paralleelsed paroolitaaste päringud päris PostgreSQL-is.
 *
 *   npm run auth:reset:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   Kriteerium ei küsi „kas rida jäi alles", vaid „kas viimasena edukaks raporteeritud
 *   kirjas olnud link PÄRISELT taastab konto". Seda ei mõõda tabel, vaid sama marsruudi
 *   `PUT` — see, mille kasutaja lingile klikkides käivitab. Sond kutsub päris `POST`-i ja
 *   päris `PUT`-i päris andmebaasi vastu ja loeb tokeni sealt, kust kasutaja teda saab:
 *   VÄLJA SAADETUD KIRJAST.
 *
 *   Fake-Prisma ei saa seda tõendada: leid ON kahe samaaegse tehingu põimumine ja
 *   `$transaction` fake'is ei ole tehingut. Nõuandelukk on päris ainult päris Postgresis.
 *
 * NEGATIIVKONTROLL jooksutab VANA raja (create → send → deleteMany-not-mine) täpselt samas
 * harnessis ja sama päris andmebaasi vastu: mõlemad kirjad lähevad teele, mõlemad päringud
 * raporteerivad edu ja LÕPUKS EI TÖÖTA KUMBKI LINK. Ilma selleta ei tea me, kas roheline on
 * paranduse teene või selle, et võistlust pole kunagi olnudki.
 *
 * Andmed: ainult `@sol-auth-reset.invalid` kontod; skript koristab lõpus.
 */

// Enne ühtegi importi:
//  1. mailer on stub — ükski rada ei tohi päris kirja saata, ja tarne AJASTUS on siin
//     mõõteriist, mitte kõrvalmõju;
//  2. marsruudi mooduli-tasemel loetud piirid ei tohi sondi enda korduspäringuid kägistada.
const sent = [];
let deliverHook = null;

globalThis.__sotsiaalai_mailer = {
  async sendMail(message) {
    const raw = String(message?.text || "").match(/[0-9a-f]{64}/)?.[0] || null;
    const entry = { to: message?.to, raw };
    if (deliverHook) await deliverHook(entry);
    sent.push(entry);
    return { messageId: "probe" };
  }
};

process.env.NEXTAUTH_URL = "https://probe.invalid";
process.env.EMAIL_FROM = "probe@probe.invalid";
process.env.RESET_RATE_LIMIT_POST_PER_IP = "1000";
process.env.RESET_RATE_LIMIT_POST_PER_EMAIL = "1000";
process.env.RESET_RATE_LIMIT_PUT_PER_IP = "1000";
process.env.RESET_RATE_LIMIT_PUT_PER_TOKEN = "1000";

import prisma from "../lib/prisma.js";
import {
  VERIFICATION_DISPATCH_LEASE_MS,
  dispatchVerificationLink
} from "../lib/auth/verificationLinkDispatch.js";
import { createVerificationTokenSecret, hashVerificationToken } from "../lib/auth/verificationTokens.js";

const { POST: resetPOST, PUT: resetPUT } = await import("../app/api/auth/password/reset/route.js");

const SUFFIX = "@sol-auth-reset.invalid";
const URL_BASE = "https://probe.invalid/api/auth/password/reset";
const IDENTIFIER_PREFIX = "password-reset:";

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
      emailVerified: new Date(),
      passwordHash: "hashed:before",
      sessionVersion: 1
    }
  });
}

/** Päris marsruut, päris Request. */
async function postReset(email) {
  const response = await resetPOST(
    new Request(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale: "et" })
    })
  );
  return { status: response.status, body: await response.json() };
}

/** „Kas see link taastab konto?" — sama PUT, mille kasutaja klikiga käivitab. */
async function usesLink(rawToken, pin) {
  const response = await resetPUT(
    new Request(URL_BASE, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: rawToken, pin, locale: "et" })
    })
  );
  const body = await response.json().catch(() => ({}));
  return { works: response.status === 200 && body.ok === true, status: response.status, body };
}

const tokensOf = (email) =>
  prisma.verificationToken.findMany({ where: { identifier: `${IDENTIFIER_PREFIX}${email}` } });

const dispatchOf = (email) =>
  prisma.verificationLinkDispatch.findUnique({ where: { identifier: `${IDENTIFIER_PREFIX}${email}` } });

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true, email: true }
  });
  const identifiers = users.map((row) => `${IDENTIFIER_PREFIX}${row.email}`);
  if (identifiers.length) {
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: identifiers } } });
    await prisma.verificationLinkDispatch.deleteMany({ where: { identifier: { in: identifiers } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((row) => row.id) } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-15 — paroolitaaste paralleelsus päris andmebaasis\n");
  await purge();

  // === 1. BAASJOON: ÜKS POST ANNAB TÖÖTAVA LINGI =========================
  // Ilma selleta ei tõenda ükski alumine rida midagi — „link ei tööta" oleks roheline ka
  // siis, kui rada oleks algusest peale katki (SOL-AUTH-07 sondi õppetund).
  {
    const user = await makeUser();
    sent.length = 0;

    const response = await postReset(user.email);
    expect("üks POST vastab ok-iga", response.status === 200 && response.body.ok === true);
    expect("üks POST = üks kiri", sent.length === 1 && sent[0].to === user.email);

    const rows = await tokensOf(user.email);
    expect("andmebaasis on täpselt üks token", rows.length === 1);
    expect(
      "reas EI OLE linki, vaid salvestuskuju",
      rows[0]?.token !== sent[0].raw && rows[0]?.token === hashVerificationToken(sent[0].raw),
      rows[0]?.token
    );
    expect("liisung kannab saadetud tokeni jälge", (await dispatchOf(user.email))?.tokenValue === rows[0]?.token);
    expect("saadetud link TAASTAB konto", (await usesLink(sent[0].raw, "4321")).works === true);
  }

  // === 2. KAKS PARALLEELSET POST-i, TARNE POOLELI ==========================
  {
    const user = await makeUser();
    sent.length = 0;

    let release;
    const inFlight = new Promise((resolve) => { release = resolve; });
    deliverHook = async () => { await inFlight; };

    const pair = Promise.all([postReset(user.email), postReset(user.email)]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    release();
    const results = await pair;
    deliverHook = null;

    expect(
      "mõlemad POST-id vastavad ok-iga (konto olemasolu ei leki)",
      results.every((row) => row.status === 200 && row.body.ok === true)
    );
    expect("teel oleva saatmise ajal teist kirja ei saadeta", sent.length === 1, `kirju: ${sent.length}`);

    const rows = await tokensOf(user.email);
    expect("järele jääb täpselt üks token", rows.length === 1, `ridu: ${rows.length}`);
    expect(
      "kehtima jääb TÄPSELT see token, mis kirjas välja läks",
      rows[0]?.token === hashVerificationToken(sent[0].raw)
    );
    expect("välja saadetud link taastab konto", (await usesLink(sent[0].raw, "5432")).works === true);
  }

  // === 3. JÄRJESTIKUSED POST-id: VIIMANE KIRI VÕIDAB ======================
  {
    const user = await makeUser();
    sent.length = 0;

    await postReset(user.email);
    await postReset(user.email);
    expect("kaks järjestikust POST-i = kaks kirja", sent.length === 2);

    const rows = await tokensOf(user.email);
    expect("rotatsioon jätab alles ühe tokeni", rows.length === 1, `ridu: ${rows.length}`);

    const stale = await usesLink(sent[0].raw, "6543");
    expect("vana link on rotreeritud", stale.works === false && stale.status === 400);
    expect("VIIMASENA saadetud link taastab konto", (await usesLink(sent[1].raw, "6543")).works === true);
  }

  // === 4. NEGATIIVKONTROLL: VANA RADA SAMAS HARNESSIS =====================
  // create → send → deleteMany(NOT mina), täpselt nii nagu marsruudis oli.
  {
    const user = await makeUser();
    const identifier = `${IDENTIFIER_PREFIX}${user.email}`;
    const delivered = [];
    let arrived = 0;
    let openGate;
    const gate = new Promise((resolve) => { openGate = resolve; });

    const legacyPost = async () => {
      const { raw, stored } = createVerificationTokenSecret();
      await prisma.verificationToken.create({
        data: { identifier, token: stored, expires: new Date(Date.now() + 60 * 60 * 1000) }
      });
      delivered.push(raw);
      arrived += 1;
      if (arrived >= 2) openGate();
      await gate;
      await prisma.verificationToken.deleteMany({ where: { identifier, NOT: { token: stored } } });
      return { ok: true };
    };

    const results = await Promise.all([legacyPost(), legacyPost()]);
    expect("VANA rada: mõlemad päringud raporteerivad edu", results.every((row) => row.ok === true));
    expect("VANA rada: mõlemad kirjad läksid teele", delivered.length === 2);

    const rows = await tokensOf(user.email);
    expect("VANA rada: andmebaasi ei jäänud ÜHTKI tokenit", rows.length === 0, `ridu: ${rows.length}`);

    const last = await usesLink(delivered[1], "7654");
    expect(
      "VANA rada: viimasena saadetud link EI TAASTA kontot",
      last.works === false && last.status === 400,
      JSON.stringify(last.body)
    );
    expect("VANA rada: ka esimene link on surnud", (await usesLink(delivered[0], "7654")).works === false);
  }

  // === 5. TARNETÕRGE: VANA LINK ELAB, LIISUNG VABANEB =====================
  {
    const user = await makeUser();
    sent.length = 0;

    await postReset(user.email);
    const working = sent[0].raw;

    deliverHook = async () => { throw new Error("smtp down"); };
    const failedResponse = await postReset(user.email);
    deliverHook = null;

    expect("tarnetõrge ei leki vastusesse", failedResponse.status === 200 && failedResponse.body.ok === true);
    expect("tarnetõrge ei lisa kirja", sent.length === 1);
    expect("liisung on kohe vaba, mitte akna taga", (await dispatchOf(user.email)) === null);

    // Tarnetõrge ei tohi tappa linki, mis on juba kasutaja postkastis (SOL-AUTH-06/-13).
    // Mõõdetakse ENNE kordust: kordus on omaette edukas saatmine ja tema rotatsioon TOHIB
    // vana lingi välja vahetada — see on rotatsiooni mõte, mitte tõrke tagajärg.
    expect("VAREM saadetud link kehtib tõrke järel edasi", (await usesLink(working, "8765")).works === true);

    // Kordus tohib kohe uuesti saata — see ongi vabastatud liisungi mõte.
    const retry = await postReset(user.email);
    expect("kordus saab kohe uue kirja", retry.body.ok === true && sent.length === 2);
    expect("kordusega saadetud link taastab konto", (await usesLink(sent[1].raw, "8765")).works === true);
  }

  // === 6. VANANEMISAKEN: SURNUD SAATJA EI LUKUSTA KONTOT ==================
  {
    const user = await makeUser();
    const identifier = `${IDENTIFIER_PREFIX}${user.email}`;

    // Saatja, kes ei jõua kunagi lõpuni: claim tehtud, kiri teel, protsess suri.
    const abandoned = dispatchVerificationLink({
      db: prisma,
      identifier,
      expires: new Date(Date.now() + 60 * 60 * 1000),
      deliver: () => new Promise(() => {})
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    let blockedDelivered = false;
    const blocked = await dispatchVerificationLink({
      db: prisma,
      identifier,
      expires: new Date(Date.now() + 60 * 60 * 1000),
      deliver: async () => { blockedDelivered = true; }
    });
    expect("värske liisungi ajal teine päring ei saada", blocked.outcome === "in_flight" && !blockedDelivered);

    let takeoverRaw = null;
    const takeover = await dispatchVerificationLink({
      db: prisma,
      identifier,
      expires: new Date(Date.now() + 60 * 60 * 1000),
      deliver: async (raw) => { takeoverRaw = raw; },
      leaseMs: 0
    });
    expect("aegunud liisung võetakse üle", takeover.outcome === "sent" && Boolean(takeoverRaw));

    const rows = await tokensOf(user.email);
    expect(
      "ülevõtja rotreerib hüljatud tokeni välja",
      rows.length === 1 && rows[0].token === hashVerificationToken(takeoverRaw),
      `ridu: ${rows.length}`
    );
    expect("ülevõtja link taastab konto", (await usesLink(takeoverRaw, "9876")).works === true);
    void abandoned;
  }

  expect(
    "vananemisaken on lepingus, mitte peidus",
    Number.isFinite(VERIFICATION_DISPATCH_LEASE_MS) && VERIFICATION_DISPATCH_LEASE_MS > 0
  );

  await purge();

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("PROBE_FAIL");
    process.exitCode = 1;
  } else {
    console.log(`PROBE_OK ${passed}/${passed}`);
  }
}

main()
  .catch(async (error) => {
    console.error("PROBE_ERROR", error);
    process.exitCode = 1;
    await purge().catch(() => {});
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
