#!/usr/bin/env node
/**
 * SOL-AUTH-14 — ühe seadme väljalogimine päris PostgreSQL-is.
 *
 *   npm run auth:logout:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   Kriteerium ei küsi „kas rida kadus", vaid „kas vana JWT autoriseerib järgmist
 *   päringut". Seda ei mõõda tabel, vaid `refreshTokenAuthorization()` — sama funktsioon,
 *   mille NextAuth igal JWT-kutsel jooksutab. Sond kutsub teda tokeniga ENNE ja PÄRAST
 *   väljalogimist.
 *
 *   Baasjoon („enne ANNAB") on siin sama tähtis kui tulemus: ilma temata oleks „vana token
 *   ei autoriseeri" triviaalselt roheline ka siis, kui token oleks algusest peale katki
 *   olnud — täpselt see lõks, mille SOL-AUTH-07 sond kinni püüdis.
 *
 * Negatiivkontroll jooksutab VANA best-effort rada: viga neelatakse, kutsuja arvab, et
 * väljalogimine õnnestus, ja token autoriseerib edasi.
 *
 * Andmed: ainult `@sol-auth-logout.invalid` kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  SESSION_REVOKED,
  createTrackedSessionForUser,
  refreshTokenAuthorization
} from "../lib/auth/jwtAuthorization.js";
import { revokeTrackedSession } from "../lib/auth/sessionRevocation.js";

const SUFFIX = "@sol-auth-logout.invalid";

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
      passwordHash: "hashed:1234",
      sessionVersion: 1
    }
  });
}

/** Sisselogimine: jälgitav sessioon + JWT, mis teda kannab. */
async function signIn(user) {
  const record = await createTrackedSessionForUser(user, { db: prisma, sessionMaxAgeSeconds: 3600 });
  return {
    token: { id: user.id, sessionVersion: 1, sessionRecordId: record.id, role: user.role, isAdmin: false },
    sessionRecordId: record.id
  };
}

/** „Kas see JWT autoriseerib järgmist päringut?" — NextAuthi enda kontroll. */
async function authorizes(token) {
  try {
    const result = await refreshTokenAuthorization({ ...token }, { db: prisma, sessionMaxAgeSeconds: 3600 });
    return { authorized: !result.degraded, degraded: result.degraded };
  } catch (error) {
    return { authorized: false, reason: String(error?.message || "") };
  }
}

const sessionCount = (userId) => prisma.session.count({ where: { userId } });

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((row) => row.id);
  if (ids.length) await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-AUTH-14 — ühe seadme väljalogimine päris andmebaasis\n");
  await purge();

  // === 1. VÄLJALOGIMINE TAPAB TÄPSELT SELLE JWT ===========================
  {
    const user = await makeUser();
    const first = await signIn(user);
    const second = await signIn(user);

    // Baasjoon: ilma selleta ei tõenda alumine rida mitte midagi.
    expect("ENNE väljalogimist AUTORISEERIB vana token", (await authorizes(first.token)).authorized === true);

    const result = await revokeTrackedSession({
      db: prisma,
      userId: user.id,
      sessionRecordId: first.sessionRecordId
    });
    expect("väljalogimine kinnitab tühistuse", result.ok === true && result.outcome === "revoked");

    const after = await authorizes(first.token);
    expect(
      "PÄRAST väljalogimist EI AUTORISEERI sama token enam ühtki päringut",
      after.authorized === false && after.reason === SESSION_REVOKED,
      JSON.stringify(after)
    );
    expect("teine seade jääb sisse logituks", (await authorizes(second.token)).authorized === true);
  }

  // === 2. VEASÜST: TÕRGE EI TOHI PAISTA ÕNNESTUMISENA =====================
  {
    const user = await makeUser();
    const session = await signIn(user);

    const brokenDb = {
      session: {
        async deleteMany() {
          throw new Error("db down");
        },
        findUnique: prisma.session.findUnique.bind(prisma.session)
      }
    };

    let threw = false;
    try {
      await revokeTrackedSession({ db: brokenDb, userId: user.id, sessionRecordId: session.sessionRecordId });
    } catch (error) {
      threw = /db down/.test(String(error?.message));
    }

    expect("andmebaasi tõrge jõuab kutsujani", threw);
    expect("rida jääb alles", (await sessionCount(user.id)) === 1);
    expect(
      "ja see on AUS: token autoriseerib endiselt, seega kasutajale ei tohi öelda, et ta on väljas",
      (await authorizes(session.token)).authorized === true
    );
  }

  // === 3. NEGATIIVKONTROLL: VANA BEST-EFFORT RADA =========================
  /* Vana `signOut` event, sõna-sõnalt: `delete({ where: { id } })` ilma omanikuta ja
     catch, mis neelab kõik peale P2025. Jooksutame teda SAMADE sisenditega, mille peal
     uus rada eespool keeldus — kui ta käituks samamoodi, ei mõõdaks plokid 2 ja 4 midagi. */
  const legacyRevoke = async (db, sessionRecordId) => {
    try {
      await db.session.delete({ where: { id: String(sessionRecordId) } });
      return { reportedSuccess: true };
    } catch (error) {
      if (error?.code !== "P2025") {
        console.log(`        (vana rada logis ja jätkas: ${error.message})`);
      }
      // Voog jätkus siit edasi ja küpsis eemaldati — see ONGI leid.
      return { reportedSuccess: true };
    }
  };

  {
    const user = await makeUser();
    const session = await signIn(user);
    const brokenDb = {
      session: {
        async delete() {
          throw Object.assign(new Error("db down"), { code: "P2002" });
        }
      }
    };

    const legacy = await legacyRevoke(brokenDb, session.sessionRecordId);
    expect("negatiivkontroll: vana rada raporteeris tõrke kiuste EDU", legacy.reportedSuccess === true);
    expect(
      "negatiivkontroll: ja sama token autoriseeris pärast seda EDASI",
      (await authorizes(session.token)).authorized === true,
      "kui see on false, ei mõõda plokk 2 paranduse teenet"
    );
  }

  {
    // Teine pool sama vana rada: `where: { id }` ilma omanikuta kustutab VÕÕRA sessiooni.
    const stranger = await makeUser();
    const strangerSession = await signIn(stranger);

    await legacyRevoke(prisma, strangerSession.sessionRecordId);
    expect(
      "negatiivkontroll: vana rada kustutas VÕÕRA sessiooni ilma omanikku küsimata",
      (await sessionCount(stranger.id)) === 0,
      "kui rida on alles, ei mõõda plokk 4 omanikutingimuse teenet"
    );
  }

  // === 4. VÕÕRAST SESSIOONI EI SAA TÜHISTADA ==============================
  {
    const owner = await makeUser();
    const stranger = await makeUser();
    const strangerSession = await signIn(stranger);

    const result = await revokeTrackedSession({
      db: prisma,
      userId: owner.id,
      sessionRecordId: strangerSession.sessionRecordId
    });

    expect("võõra sessiooni tühistamine lükatakse tagasi", result.ok === false && result.reason === "foreign_session");
    expect("võõras rida on alles", (await sessionCount(stranger.id)) === 1);
    expect("ja võõras token autoriseerib edasi", (await authorizes(strangerSession.token)).authorized === true);
  }

  // === 5. JUBA KADUNUD RIDA ON SOOVITUD LÕPPSEIS ==========================
  {
    const user = await makeUser();
    const session = await signIn(user);
    await prisma.session.deleteMany({ where: { id: session.sessionRecordId } });

    const result = await revokeTrackedSession({
      db: prisma,
      userId: user.id,
      sessionRecordId: session.sessionRecordId
    });
    expect("teine väljalogimisvajutus ei anna viga", result.ok === true && result.outcome === "already_gone");
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
