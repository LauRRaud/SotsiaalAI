#!/usr/bin/env node
/**
 * SOL-VOICE-01, -02 ja -03 — häälerada päris PostgreSQL-is.
 *
 *   npm run voice:settle:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   Kolm leidu räägivad kõik RAHAST ja tema jäljest: kui palju reserveeriti, kui palju
 *   arvestati ja mis juhtub reservatsiooniga siis, kui vastust ei tule. Seda ei mõõda
 *   ükski funktsiooni tagastusväärtus — seda mõõdab `UsageReservation` rida ja ämbri seis
 *   päris andmebaasis. Fake-Prisma all on „reservatsioon vabanes" alati roheline, sest seal
 *   ei ole ämbrit, mille peale ta mõjuks.
 *
 *   Provider on siin MITTE KUNAGI LAHENEV promise — täpselt see, mida kriteerium nõuab.
 *   Kui ajapiiri ei oleks, jääks sond ise rippuma: tulemuseks oleks timeout, mitte punane
 *   rida, ja just see on aus tõend selle kohta, et piir päriselt eksisteerib.
 *
 * NEGATIIVKONTROLL jooksutab VANA arvestuse: commit ilma `actualAmount`-ita võtab kogu
 * reservatsiooni ja tundmatu formaadi 60-sekundiline vaikeväärtus laseb tunnipikkuse faili
 * minuti hinnaga läbi. Mõlemad mõõdetakse sama ämbri peal.
 *
 * Andmed: ainult `@sol-voice.invalid` kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  providerAbortSignal,
  withAbort
} from "../lib/net/providerRequest.js";
import {
  commitProviderUsage,
  settleProviderFailure
} from "../lib/usage/providerSettlement.js";
import {
  resolveSttCommittedSeconds,
  resolveSttReservationSeconds
} from "../lib/usage/sttDuration.js";
import { reserveUsageForRequest } from "../lib/usage/routeAdapter.js";

const SUFFIX = "@sol-voice.invalid";
const LIMIT_SECONDS = 900n;

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const tag = () => Math.random().toString(36).slice(2, 10);
const never = () => new Promise(() => {});

/** Marsruut annab `request`-i ainult päiste pärast; sond annab sama kuju ilma serverita. */
const fakeRequest = { headers: { get: () => null } };

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      email: `voice-${tag()}${SUFFIX}`,
      role: "CLIENT",
      emailVerified: new Date()
    }
  });
  // Kvoodiõigus tuleb otse ülekirjutusest, et sond ei sõltuks paketiseemnetest.
  await prisma.userEntitlementOverride.create({
    data: {
      userId: user.id,
      metric: "STT_SECONDS",
      enabled: true,
      hardLimit: LIMIT_SECONDS,
      period: "MONTHLY",
      reason: "SOL-VOICE sond",
      createdByAdminId: user.id
    }
  });
  return user;
}

function reserve(user, { amount, key }) {
  return reserveUsageForRequest({
    request: fakeRequest,
    userId: user.id,
    metric: "STT_SECONDS",
    amount,
    scope: "stt.transcribe",
    idempotencyKey: key
  });
}

const readReservation = (handle) =>
  prisma.usageReservation.findFirst({
    where: { userId: handle.userId, idempotencyKey: handle.idempotencyKey }
  });

async function readBucket(userId) {
  const row = await prisma.usageBucket.findFirst({
    where: { userId, metric: "STT_SECONDS" },
    orderBy: { periodStart: "desc" }
  });
  return row ? { used: Number(row.used), reserved: Number(row.reserved) } : null;
}

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    // `UsageEvent` on muutumatu (DB-trigger) — teda saab kustutada ainult otse ja ENNE
    // kasutajat, muidu kukub kaskaad triggeri otsa.
    await prisma.usageEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageReservation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageBucket.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userEntitlementOverride.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-VOICE — häälekutse ajapiir ja arveldus päris andmebaasis\n");
  await purge();

  // === 1. MITTE KUNAGI LAHENEV PROVIDER =================================
  {
    const user = await makeUser();
    const handle = await reserve(user, { amount: 120, key: `timeout-${tag()}` });

    const before = await readBucket(user.id);
    expect("reservatsioon võtab ämbrist koha juba enne kutset", before?.reserved === 120, JSON.stringify(before));

    const startedAt = Date.now();
    const signal = providerAbortSignal(null, 300);
    const error = await withAbort(never(), signal).catch((err) => err);
    const elapsed = Date.now() - startedAt;

    expect("kutse lõpeb ajapiiri, mitte ummikuga", elapsed < 5000, `${elapsed} ms`);

    const failure = await settleProviderFailure({ handle, error });
    expect("ajapiir annab 504 ja vabastab", failure.status === 504 && failure.released === true);

    const row = await readReservation(handle);
    const after = await readBucket(user.id);
    expect("reservatsioon on RELEASED põhjusega", row?.status === "RELEASED" && row?.releaseReason === "provider_timeout", row?.status);
    expect("ämbris ei ole kinni ühtki sekundit", after?.reserved === 0 && after?.used === 0, JSON.stringify(after));
  }

  // === 2. KASUTAJA KATKESTUS ============================================
  {
    const user = await makeUser();
    const handle = await reserve(user, { amount: 60, key: `abort-${tag()}` });

    const controller = new AbortController();
    const signal = providerAbortSignal(controller.signal, 60_000);
    const pending = withAbort(never(), signal).catch((err) => err);
    controller.abort();

    const failure = await settleProviderFailure({ handle, error: await pending });
    const row = await readReservation(handle);
    const after = await readBucket(user.id);

    expect("Stop annab 499 ja seda ei logita veana", failure.status === 499 && failure.log === false);
    expect("katkestatud kutse eest ei võeta midagi", row?.status === "RELEASED" && row?.releaseReason === "client_aborted", row?.status);
    expect("ämber on katkestuse järel puhas", after?.reserved === 0 && after?.used === 0, JSON.stringify(after));
  }

  // === 3. ARVESTUS KÄIB PROVIDERI KESTUSE JÄRGI =========================
  {
    const user = await makeUser();
    // Tundmatu kestusega 200 kB fail: ülempiir tuleb baitidest, mitte vaikeväärtusest.
    const reserved = resolveSttReservationSeconds({ measuredSeconds: null, sizeBytes: 200 * 1024 });
    const handle = await reserve(user, { amount: reserved, key: `commit-${tag()}` });

    const committed = resolveSttCommittedSeconds({
      providerUsage: { type: "duration", seconds: 73 },
      reservedSeconds: reserved
    });
    await commitProviderUsage({ handle, actualAmount: committed });

    const row = await readReservation(handle);
    const after = await readBucket(user.id);

    expect("ülempiir on suurem kui vana 60-sekundiline vaikeväärtus", reserved > 60, `${reserved}s`);
    expect("arvestati PROVIDERI kestus", Number(row?.committedAmount) === 73, String(row?.committedAmount));
    expect("ämbrisse jäi ainult tegelik kulu", after?.used === 73 && after?.reserved === 0, JSON.stringify(after));
    expect("reservatsioon on COMMITTED", row?.status === "COMMITTED", row?.status);
  }

  // === 4. NEGATIIVKONTROLL: VANA ARVESTUS ===============================
  {
    const user = await makeUser();
    const oldReservation = Math.max(1, Math.ceil(Number(null) || 60)); // vana rida, sõna-sõnalt
    const handle = await reserve(user, { amount: 240, key: `legacy-${tag()}` });

    // Vana commit ei andnud `actualAmount`-i, seega võeti kogu reservatsioon.
    await commitProviderUsage({ handle });

    const row = await readReservation(handle);
    const after = await readBucket(user.id);

    expect("VANA rada: tundmatu formaat hinnati 60 sekundiks", oldReservation === 60);
    expect(
      "VANA rada: commit ilma tegeliku kestuseta võtab KOGU reservatsiooni",
      Number(row?.committedAmount) === 240 && after?.used === 240,
      JSON.stringify({ committed: String(row?.committedAmount), after })
    );
  }

  // === 5. PIIR PÄRISELT KEHTIB ==========================================
  // Vana 60-sekundiline hinnang tähendas, et 900-sekundilise kuulimiidi sisse mahtus 15
  // faili, mille päris kestus võis olla tunde. Uue ülempiiriga see enam ei mahu.
  {
    const user = await makeUser();
    const twelveMb = 12 * 1024 * 1024;
    const upper = resolveSttReservationSeconds({ measuredSeconds: null, sizeBytes: twelveMb });
    let rejected = false;
    try {
      await reserve(user, { amount: upper, key: `limit-${tag()}` });
    } catch (error) {
      rejected = error?.code === "USAGE_LIMIT_EXCEEDED";
    }
    expect(
      "12 MB tundmatu fail ei mahu 900-sekundilise limiidi sisse",
      upper > Number(LIMIT_SECONDS) && rejected === true,
      `ülempiir ${upper}s, tagasi lükatud: ${rejected}`
    );
  }

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
