#!/usr/bin/env node
/**
 * SOL-PAY-09 — kas maksekirje elab maksjast kauem?
 *
 * MIKS PÄRIS ANDMEBAAS. Parandus on ENAMASTI võõrvõtme reegel: `ON DELETE
 * CASCADE` → `SET NULL`. Seda ei tõenda ükski ühiktest, sest fake-prisma ei
 * jõusta referentsiaalset käitumist üldse — ta ei kustuta lapsi, ei nulli
 * veerge ega tea piirangutest midagi. Roheline ühiksviit selle leiu kohal
 * tõendaks ainult seda, et fake on lubav.
 *
 * NELI MÕÕTMIST:
 *   1. STRUKTUUR — `pg_constraint` päris andmebaasis: mis reegel KEHTIB.
 *   2. LÄBIV — päris read ja päris `user.delete()`: mis PÄRISELT juhtub.
 *   3. NEGATIIVKONTROLL A — kustutus ILMA eelneva külmutamiseta. Tõendab, et
 *      järjekord kannab: pärast `user.delete`-i ei leia arhiveerija enam ühtki
 *      rida ja plaanikood on kadunud koos kaskaadinud tellimusega.
 *   4. NEGATIIVKONTROLL B — vana `ON DELETE CASCADE` tagasi pandud SAMAS
 *      andmebaasis, sama andmestik. Kui ta ei võta makset kaasa, ei ole leid
 *      päris ja ülejäänud roheline ei tähenda midagi.
 *
 * Käivitamine:
 *   npm run pay:archive:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

import { archiveUserPaymentsWithin } from "../lib/privacy/paymentArchive.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.PAYMENT_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_payment_probe_${Date.now()}`;
if (!/^sotsiaal_ai_payment_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function note(text) {
  lines.push(`  ···  ${text}`);
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

async function seedPayer(suffix) {
  const user = await db.user.create({
    data: { email: `pay-probe-${suffix}@sotsiaalai.test` }
  });
  /* CHECK `Subscription_normalized_plan_check` nõuab aktiivsele tellimusele
     plaanidefinitsiooni — piir, mida fake-prisma ei tea ja mis oleks selle
     sondi ilma päris andmebaasita vaikselt läbi lasknud. */
  const planDefinition = await db.planDefinition.create({
    data: {
      key: `probe_supervision_${suffix}`,
      name: "Probe supervision",
      role: "SOCIAL_WORKER",
      price: "2.00",
      currency: "EUR"
    }
  });
  const subscription = await db.subscription.create({
    data: {
      userId: user.id,
      plan: "supervision_monthly",
      status: "ACTIVE",
      planDefinitionId: planDefinition.id
    }
  });
  const billing = await db.billingMethod.create({
    data: { userId: user.id, status: "ACTIVE", providerToken: "token-that-must-not-survive" }
  });
  const paid = await db.payment.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      billingMethodId: billing.id,
      providerPaymentId: `probe-${suffix}-1`,
      kind: "SUBSCRIPTION_INITIAL",
      amount: "2.00",
      currency: "EUR",
      status: "PAID"
    }
  });
  const sponsored = await db.payment.create({
    data: {
      userId: user.id,
      providerPaymentId: `probe-${suffix}-2`,
      kind: "INVITE_SPONSORED",
      amount: "2.00",
      currency: "EUR",
      status: "PAID"
    }
  });
  return { user, subscription, billing, paid, sponsored };
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  note(`ajutine andmebaas ${databaseName} loodud`);
  runPrisma(["migrate", "deploy"]);

  /* ── 1. STRUKTUUR ─────────────────────────────────────────────────────── */
  /* `::text` sest `pg_constraint.confdeltype` on `char` ja Prisma `$queryRaw`
     kukub tema peal `UnsupportedNativeDataType`-ga (vt mälu `prisma-advisory-lock`). */
  /* VEERG, mitte ainult tabelipaar. `Subscription` viitab `User`-ile KAHEST
     veerust (`userId` = Cascade, `sponsorUserId` = SetNull), seega tabelipaari
     järgi otsimine tagastas suvalise neist ja mõõtis vale reeglit. Sama lõks
     ootab `Payment`-il, kui sinna kunagi teine kasutajaseos lisandub. */
  const fks = await db.$queryRaw`
    SELECT c.relname::text AS child, p.relname::text AS parent,
           con.conname::text AS name, con.confdeltype::text AS on_delete,
           att.attname::text AS column_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_class p ON p.oid = con.confrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND array_length(con.conkey, 1) = 1
       AND c.relname IN ('Payment', 'BillingMethod', 'Subscription')
     ORDER BY c.relname, att.attname`;

  const find = (child, column) => fks.find(row => row.child === child && row.column_name === column);
  const paymentUser = find("Payment", "userId");
  const paymentSub = find("Payment", "subscriptionId");

  check("1a Payment.userId on SET NULL", paymentUser?.on_delete === "n", paymentUser?.name || "FK puudub");
  /* Ilma selleta oleks maksja seose parandamine tühi töö: tellimus kaskaadib
     kasutajaga ja võtaks maksekirje teist teed pidi kaasa. */
  check("1b Payment.subscriptionId on SET NULL", paymentSub?.on_delete === "n", paymentSub?.name || "FK puudub");
  /* Need KAKS peavad jääma kaskaadiks ja see on teadlik valik, mitte jääk. */
  const billingUser = find("BillingMethod", "userId");
  const subscriptionUser = find("Subscription", "userId");
  check("1c BillingMethod.userId jääb KASKAADIKS (token on krediit)", billingUser?.on_delete === "c", billingUser?.name || "FK puudub");
  check("1d Subscription.userId jääb KASKAADIKS (ei ole algdokument)", subscriptionUser?.on_delete === "c", subscriptionUser?.name || "FK puudub");
  /* Kontrollib, et 1d mõõtis päriselt maksja seost: sponsori seos on SAMA
     tabelipaar ja VASTUPIDINE reegel — kui need kaks kokku langeksid, oleks
     veerupõhine otsing tühi vaev. */
  check("1e Subscription.sponsorUserId on SET NULL (eristab 1d mõõtmise)", find("Subscription", "sponsorUserId")?.on_delete === "n");

  /* ── 2. LÄBIV: päris kustutus ─────────────────────────────────────────── */
  const alice = await seedPayer("alice");
  const bob = await seedPayer("bob");

  await db.$transaction(async (tx) => {
    await archiveUserPaymentsWithin(tx, { userId: alice.user.id });
    await tx.user.delete({ where: { id: alice.user.id } });
  });

  const survivors = await db.payment.findMany({
    where: { providerPaymentId: { startsWith: "probe-alice-" } },
    orderBy: { providerPaymentId: "asc" }
  });

  check("2a maksekirjed jäid alles", survivors.length === 2, `ridu: ${survivors.length}`);
  check("2b maksja seos on katkenud", survivors.every(row => row.userId === null));
  check("2c rida ütleb ISE, et maksja on kustutatud", survivors.every(row => row.archivedAt !== null));
  check(
    "2d ühe inimese maksed on omavahel seotud",
    survivors.length === 2 && survivors[0].archivedPayerRef && survivors[0].archivedPayerRef === survivors[1].archivedPayerRef,
    survivors[0]?.archivedPayerRef || "pseudonüüm puudub"
  );
  check(
    "2e majanduslik sisu on külmutatud koodina",
    survivors.some(row => row.archivedPlanCode === "supervision_monthly"),
    survivors.map(row => row.archivedPlanCode).join(", ")
  );
  check("2f summa ja valuuta on alles", survivors.every(row => String(row.amount) === "2" && row.currency === "EUR"));
  /* Tellimuseta makse (sponsorkutse) jääb plaanikoodita ja see EI ole puudujääk,
     vaid `paymentArchive.js` kirja pandud valik: tema majanduslikku sisu kannab
     `kind`, mis on real niikuinii. Ilma selle mõõtmiseta oleks tühi `archivedPlanCode`
     eristamatu külmutamise vaiksest ebaõnnestumisest. */
  const sponsoredRow = survivors.find(row => row.providerPaymentId === "probe-alice-2");
  check(
    "2g tellimuseta makse kannab sisu `kind` väljal",
    sponsoredRow?.archivedPlanCode === null && sponsoredRow?.kind === "INVITE_SPONSORED",
    `plaanikood: ${String(sponsoredRow?.archivedPlanCode)} · kind: ${sponsoredRow?.kind}`
  );

  /* Krediit ja leping seevastu PEAVAD kaduma. */
  const billingLeft = await db.billingMethod.count({ where: { id: alice.billing.id } });
  const subLeft = await db.subscription.count({ where: { id: alice.subscription.id } });
  check("2h makseviis (token) on kustutatud", billingLeft === 0);
  check("2i tellimus on kustutatud", subLeft === 0);

  /* Võõra maksja read ei tohi liikuda. */
  const bobRows = await db.payment.findMany({ where: { providerPaymentId: { startsWith: "probe-bob-" } } });
  check("2j võõra maksja read on puutumata", bobRows.length === 2 && bobRows.every(row => row.userId === bob.user.id && row.archivedAt === null));

  /* ── 3. NEGATIIVKONTROLL A: JÄRJEKORD ─────────────────────────────────── */
  /* Külmutamine ENNE `user.delete`-i ei ole stiilivalik. Carol kustutatakse ilma
     külmutamiseta ja alles seejärel proovitakse arhiveerida: rida elab üle (võõrvõti
     on korras), aga teda ei leia enam ükski maksja järgi käiv päring ja plaanikood
     on koos kaskaadinud tellimusega lõplikult kadunud. Ilma selle mõõtmiseta oleks
     „ENNE" ainult kommentaar. */
  const carol = await seedPayer("carol");
  await db.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: carol.user.id } });
  });
  const lateArchive = await db.$transaction(async (tx) => archiveUserPaymentsWithin(tx, { userId: carol.user.id }));
  const carolRows = await db.payment.findMany({ where: { providerPaymentId: { startsWith: "probe-carol-" } } });

  check("3a hiline külmutamine ei leia enam ühtki rida", lateArchive.archived === 0, `külmutatud: ${lateArchive.archived}`);
  check(
    "3b rida elas üle, aga jäi ilma külmutatud koosseisuta",
    carolRows.length === 2 &&
      carolRows.every(row => row.archivedAt === null && row.archivedPayerRef === null && row.archivedPlanCode === null),
    `ridu: ${carolRows.length}`
  );
  check(
    "3c plaanikoodi ei ole enam kuskilt küsida (tellimus kaskaadis kaasa)",
    (await db.subscription.count({ where: { id: carol.subscription.id } })) === 0
  );

  /* ── 4. NEGATIIVKONTROLL B: vana reegel, sama andmestik ────────────────── */
  await db.$executeRawUnsafe(`ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey"`);
  await db.$executeRawUnsafe(
    `ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
  );
  note("vana ON DELETE CASCADE reegel taastatud ainult negatiivkontrolli jaoks");

  await db.$transaction(async (tx) => {
    await archiveUserPaymentsWithin(tx, { userId: bob.user.id });
    await tx.user.delete({ where: { id: bob.user.id } });
  });

  const bobAfter = await db.payment.count({ where: { providerPaymentId: { startsWith: "probe-bob-" } } });
  check(
    "4a VANA reegel hävitab kirje, mille tingimuste p 7.9 lubab säilitada",
    bobAfter === 0,
    `alles jäi ${bobAfter} rida — kui see ei ole 0, ei ole leid päris`
  );
  check(
    "4b kaks reeglit annavad ERI tulemuse",
    bobAfter === 0 && survivors.length === 2,
    `vana: ${bobAfter} · uus: ${survivors.length}`
  );
  note("külmutamine jooksis mõlemal juhul — vahe tuleb AINULT võõrvõtme reeglist");
} finally {
  await db.$disconnect().catch(() => {});
  await admin
    .query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [
      databaseName
    ])
    .catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  const left = await admin
    .query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
    .catch(() => ({ rowCount: -1 }));
  check("5a ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-PAY-09 — kas maksekirje elab maksjast kauem?\n");
  console.log(lines.join("\n"));
  console.log(`\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}
