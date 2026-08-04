#!/usr/bin/env node
/**
 * SK-V1 E6 — sünteetiline runtime-sond.
 *
 * Miks ta olemas on: 04.08 leidis päris sessiooniga läbisõit KOLM viga, mida
 * 2622 rohelist testi ei püüdnud (puuduv tabel, korduv veateade ja IDOR).
 * Fake-prismaga roheline sviit ei tõenda ligipääsupiiri ega andmebaasi
 * käitumist. See sond käib PÄRIS andmebaasi vastu.
 *
 * Mida ta tõendab (E6 DoD):
 *   1. **ühendatud saaja voog** — avalik saatmine → mehitatud laua vastuvõtt →
 *      lugemisaja täitmine → vastuvõtmine → päevase üksuse vastuvõtukinnitus;
 *   2. **saajata piirkonna serverikeeld** — fail-closed ka siis, kui keegi
 *      kutsub teenuskihti otse;
 *   3. **eluohtliku olukorra kriisilukk** — kirjet ei teki.
 *
 * Andmed on SÜNTEETILISED ja sond koristab enda järelt ära. Päris kasutajate
 * sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   node --import ./scripts/register-node-test-loader.mjs scripts/urgent-request-probe.mjs
 *
 * Laadur on vajalik `@/`-teede lahendamiseks — sama laadur, mida `npm test`
 * kasutab, seega sond ei nõua eraldi ehitust.
 */

import process from "node:process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const { prisma } = await import("../lib/prisma.js");
const {
  createUrgentRequest,
  markUrgentRequestRead,
  takeUrgentRequest,
  handOverUrgentRequest,
  acceptUrgentHandover,
  declineUrgentRequest,
  UrgentRequestError
} = await import("../lib/urgent/request.js");
const { deskReadiness } = await import("../lib/urgent/desk.js");
const { buildUrgentRequestAggregate, URGENT_MIN_GROUP_SIZE } = await import("../lib/urgent/aggregate.js");

const stamp = process.env.URGENT_PROBE_TAG || `probe_${Math.trunc(Number(process.hrtime.bigint() % 1000000000n))}`;
const results = [];
const created = { users: [], desks: [], municipalities: [], requests: [] };

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.info(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function seed() {
  const municipality = await prisma.municipality.create({
    data: {
      slug: `sk-probe-${stamp}`,
      baseName: `SK-sond ${stamp}`,
      type: "VALD",
      displayName: `SK-sond ${stamp}`,
      isActive: true
    }
  });
  created.municipalities.push(municipality.id);

  const dayMunicipality = await prisma.municipality.create({
    data: {
      slug: `sk-probe-day-${stamp}`,
      baseName: `SK-sond päev ${stamp}`,
      type: "VALD",
      displayName: `SK-sond päev ${stamp}`,
      isActive: true
    }
  });
  created.municipalities.push(dayMunicipality.id);

  const [person, staff, dayStaff] = await Promise.all([
    prisma.user.create({ data: { email: `sk.probe.person.${stamp}@sotsiaalai.test`, role: "CLIENT" } }),
    prisma.user.create({ data: { email: `sk.probe.staff.${stamp}@sotsiaalai.test`, role: "SOCIAL_WORKER" } }),
    prisma.user.create({ data: { email: `sk.probe.day.${stamp}@sotsiaalai.test`, role: "SOCIAL_WORKER" } })
  ]);
  created.users.push(person.id, staff.id, dayStaff.id);

  const desk = await prisma.urgentDesk.create({
    data: {
      municipalityId: municipality.id,
      recipientType: "KOV_CONTACT",
      publicName: "Sondi öine vastuvõtulaud",
      openingHours: "E–P 17.00–09.00",
      whoMayContact: "Iga piirkonna elanik.",
      costToPerson: "Tasuta.",
      readingTimePromise: "Loeme läbi 2 tunni jooksul.",
      contactChannel: "Vastuvõtulaud platvormil.",
      emergencyBoundary: "Vahetu ohu korral helista 112.",
      requestLifetimeHours: 12,
      directContactAllowed: true,
      isActive: true,
      lastVerifiedAt: new Date()
    }
  });
  created.desks.push(desk.id);

  const dayDesk = await prisma.urgentDesk.create({
    data: {
      municipalityId: dayMunicipality.id,
      recipientType: "KOV_CONTACT",
      publicName: "Sondi päevane üksus",
      openingHours: "E–R 9.00–17.00",
      whoMayContact: "Iga piirkonna elanik.",
      costToPerson: "Tasuta.",
      readingTimePromise: "Loeme läbi tööpäeva jooksul.",
      contactChannel: "Vastuvõtulaud platvormil.",
      emergencyBoundary: "Vahetu ohu korral helista 112.",
      requestLifetimeHours: 24,
      directContactAllowed: true,
      isActive: true,
      lastVerifiedAt: new Date()
    }
  });
  created.desks.push(dayDesk.id);

  await prisma.urgentDeskMember.createMany({
    data: [
      { deskId: desk.id, userId: staff.id, isActive: true },
      { deskId: dayDesk.id, userId: dayStaff.id, isActive: true }
    ]
  });

  // Kolmas piirkond: laud on olemas, aga MITTE valmis (kinnitamata + otsetee
  // keelatud). Siit peab serverikeeld tulema.
  const closedMunicipality = await prisma.municipality.create({
    data: {
      slug: `sk-probe-closed-${stamp}`,
      baseName: `SK-sond suletud ${stamp}`,
      type: "VALD",
      displayName: `SK-sond suletud ${stamp}`,
      isActive: true
    }
  });
  created.municipalities.push(closedMunicipality.id);
  const closedDesk = await prisma.urgentDesk.create({
    data: {
      municipalityId: closedMunicipality.id,
      recipientType: "KOV_CONTACT",
      publicName: "Sondi suletud laud",
      openingHours: "-",
      whoMayContact: "-",
      costToPerson: "-",
      readingTimePromise: "-",
      contactChannel: "-",
      emergencyBoundary: "-",
      directContactAllowed: false,
      isActive: false,
      lastVerifiedAt: null
    }
  });
  created.desks.push(closedDesk.id);

  return { municipality, dayMunicipality, closedMunicipality, desk, dayDesk, person, staff, dayStaff };
}

async function run() {
  const world = await seed();

  // --- 1. Valmiduskontroll päris kirje peal --------------------------------
  const readyDesk = await prisma.urgentDesk.findFirst({ where: { id: world.desk.id } });
  const readyCount = await prisma.urgentDeskMember.count({
    where: { deskId: world.desk.id, isActive: true }
  });
  check(
    "seadistatud laud on valmis",
    deskReadiness(readyDesk, { activeMemberCount: readyCount }).ready
  );

  // --- 2. Ühendatud saaja voog ---------------------------------------------
  const request = await createUrgentRequest({
    prisma,
    authorId: world.person.id,
    municipalityId: world.municipality.id,
    situationVerbatim: "Sünteetiline sond: mul ei ole täna öösel kuhugi minna.",
    contactName: "Sondi Kasutaja",
    contactPhone: "+372 5000 0000"
  });
  created.requests.push(request.id);
  check("avalik saatmine loob kirje", request.status === "SENT", request.id);
  check(
    "lugemisaja lubadus külmutati kirje külge",
    request.readingTimePromise === "Loeme läbi 2 tunni jooksul."
  );

  const read = await markUrgentRequestRead({ prisma, requestId: request.id, userId: world.staff.id });
  check("mehitatud laud saab lugemisaja lubaduse täita", read.status === "READ" && Boolean(read.readAt));

  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: world.staff.id });
  check("laud saab pöördumise vastu võtta", taken.status === "TAKEN");

  const handed = await handOverUrgentRequest({
    prisma,
    requestId: request.id,
    userId: world.staff.id,
    targetDeskId: world.dayDesk.id,
    note: "Sünteetiline sond: hommikul vaja järelkontakti."
  });
  check(
    "üleandmine ei liiguta vastutust enne kinnitust",
    handed.handoverDeskId === world.dayDesk.id && handed.handoverAcceptedAt === null && handed.deskId === world.desk.id
  );

  const accepted = await acceptUrgentHandover({ prisma, requestId: request.id, userId: world.dayStaff.id });
  check(
    "päevane üksus kinnitab vastuvõtmise ja juhtum liigub",
    accepted.deskId === world.dayDesk.id && Boolean(accepted.handoverAcceptedAt)
  );

  const trail = await prisma.urgentRequestEvent.findMany({
    where: { requestId: request.id },
    orderBy: { createdAt: "asc" }
  });
  check(
    "vastutusjälg kannab kogu ahelat nimeliselt",
    trail.length >= 5 && trail.every((event) => event.kind === "CREATED" || Boolean(event.actorId)),
    trail.map((event) => event.kind).join(" → ")
  );

  // --- 3. Põhjendatud keeldumine -------------------------------------------
  const second = await createUrgentRequest({
    prisma,
    authorId: world.person.id,
    municipalityId: world.municipality.id,
    situationVerbatim: "Sünteetiline sond: teine pöördumine.",
    contactName: "Sondi Kasutaja",
    contactPhone: "+372 5000 0000"
  });
  created.requests.push(second.id);
  let declineBlocked = false;
  try {
    await declineUrgentRequest({ prisma, requestId: second.id, userId: world.staff.id, reason: "   " });
  } catch (error) {
    declineBlocked = error instanceof UrgentRequestError && error.code === "urgent_request.decline_reason_required";
  }
  check("keeldumine ilma põhjuseta ei ole võimalik", declineBlocked);

  const declined = await declineUrgentRequest({
    prisma,
    requestId: second.id,
    userId: world.staff.id,
    reason: "Sünteetiline sond: öine valve on täna mehitamata."
  });
  check(
    "põhjendatud keeldumine jõuab inimeseni",
    declined.status === "DECLINED" && Boolean(declined.declineReason)
  );

  // --- 4. Saajata piirkonna serverikeeld -----------------------------------
  let blocked = null;
  try {
    await createUrgentRequest({
      prisma,
      authorId: world.person.id,
      municipalityId: world.closedMunicipality.id,
      situationVerbatim: "Sünteetiline sond: suletud piirkond.",
      contactName: "Sondi Kasutaja",
      contactPhone: "+372 5000 0000"
    });
  } catch (error) {
    blocked = error;
  }
  check(
    "saajata piirkond keeldub serveris",
    blocked instanceof UrgentRequestError && blocked.code === "urgent_request.desk_not_available"
  );
  const leaked = await prisma.urgentRequest.count({ where: { municipalityId: world.closedMunicipality.id } });
  check("suletud piirkonda ei tekkinud ühtegi kirjet", leaked === 0);

  // --- 5. Kriisilukk --------------------------------------------------------
  let crisisBlocked = null;
  try {
    await createUrgentRequest({
      prisma,
      authorId: world.person.id,
      municipalityId: world.municipality.id,
      situationVerbatim: "ma ei taha enam elada",
      contactName: "Sondi Kasutaja",
      contactPhone: "+372 5000 0000"
    });
  } catch (error) {
    crisisBlocked = error;
  }
  check(
    "eluohtlik tekst lukustab vormi ja kirjet ei teki",
    crisisBlocked instanceof UrgentRequestError && crisisBlocked.code === "urgent_request.emergency_route"
  );

  let safetyBlocked = null;
  try {
    await createUrgentRequest({
      prisma,
      authorId: world.person.id,
      municipalityId: world.municipality.id,
      situationVerbatim: "Sünteetiline sond: tavaline olukord.",
      contactName: "Sondi Kasutaja",
      contactPhone: "+372 5000 0000",
      safetyAnswer: true
    });
  } catch (error) {
    safetyBlocked = error;
  }
  check(
    "„keegi on ohus“ ei tee järjekorda",
    safetyBlocked instanceof UrgentRequestError && safetyBlocked.code === "urgent_request.emergency_route"
  );

  // --- 6. Koond ei väljasta väikest rühma ----------------------------------
  const aggregate = await buildUrgentRequestAggregate({ db: prisma });
  const probeRegion = aggregate.regions.find((row) => row.key === world.municipality.id);
  check(
    `koond summutab alla ${URGENT_MIN_GROUP_SIZE} inimese rühma`,
    !probeRegion,
    `sondi piirkonnas on 1 inimene, lävi ${aggregate.minimumGroupSize}`
  );
  let lowered = null;
  try {
    lowered = await buildUrgentRequestAggregate({ db: prisma, minimumGroupSize: 1 });
  } catch {
    lowered = null;
  }
  check(
    "läve ei saa päringuga langetada",
    lowered?.minimumGroupSize === URGENT_MIN_GROUP_SIZE
  );
}

async function cleanup() {
  await prisma.urgentRequestEvent.deleteMany({ where: { requestId: { in: created.requests } } });
  await prisma.urgentRequest.deleteMany({ where: { id: { in: created.requests } } });
  await prisma.urgentDeskMember.deleteMany({ where: { deskId: { in: created.desks } } });
  await prisma.urgentDesk.deleteMany({ where: { id: { in: created.desks } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.municipality.deleteMany({ where: { id: { in: created.municipalities } } });
}

let exitCode = 0;
try {
  await run();
} catch (error) {
  console.error("[sk-probe] sond kukkus", error);
  exitCode = 1;
} finally {
  await cleanup().catch((error) => console.error("[sk-probe] koristus ebaõnnestus", error));
  await prisma.$disconnect();
}

const failed = results.filter((row) => !row.ok);
console.info(`\n[sk-probe] ${results.length - failed.length}/${results.length} OK`);
if (failed.length) {
  for (const row of failed) console.error(`[sk-probe] FAIL: ${row.name}`);
  exitCode = 1;
}
process.exit(exitCode);
