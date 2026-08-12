#!/usr/bin/env node
/**
 * SOL-URG-05, -06 ja -07 sond — PÄRIS PostgreSQL, mitte fake-Prisma.
 *
 * MIKS SEE FAIL OLEMAS ON. `npm test` mõõdab võistlust nii, et TEST ise paneb rea
 * vahepeal paika — see tõendab, et WHERE-tingimus on koodis olemas, mitte seda, et
 * andmebaas kahe päris tehingu vahel ainult ühe võitja lubab. Aatomsus ja
 * isolatsioon on Postgresi omadused ja neid mõõdetakse Postgresi peal.
 *
 * Võistlus on siin DETERMINISTLIK, mitte kellaajapõhine: kaotaja klient on
 * mähitud nii, et ta LOEB rea enne võitja tehingut ja KIRJUTAB alles pärast teda.
 * Päringud käivad päris kliendi peal; mähis ainult järjestab kaks sammu.
 *
 * Neli rada tulevad vastuvõtukriteeriumist: READ↔RECALL, TAKE↔EXPIRE, TAKE↔TAKE ja
 * HANDOVER↔ACCEPT. Viies jaam on veasüst päris andmebaasi trigger'iga: kui
 * vastutusjälje kirjutus kukub, ei tohi seis liikuda.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { lockDeskRow } from "../lib/urgent/desk.js";
import {
  conditionsHash,
  removeUrgentDeskMember,
  UrgentDeskAuditAction,
  verifyUrgentDesk
} from "../lib/urgent/deskAdmin.js";
import {
  acceptUrgentHandover,
  convertUrgentRequestToPreInquiry,
  createUrgentRequest,
  expireOverdueUrgentRequests,
  handOverUrgentRequest,
  markUrgentRequestRead,
  recallUrgentRequest,
  takeUrgentRequest
} from "../lib/urgent/request.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { users: [], desks: [], municipalities: [], requestIds: [] };

/**
 * Kaotaja klient: loeb rea ENNE võitja tehingut, kirjutab PÄRAST teda.
 * Domeen puudutab ainult neid mudeleid — muud siia ei kuulu.
 */
function sequencedClient({ onLoaded, gate }) {
  return {
    urgentRequest: {
      findFirst: async (args) => {
        const row = await prisma.urgentRequest.findFirst(args);
        onLoaded();
        return row;
      },
      findMany: (args) => prisma.urgentRequest.findMany(args),
      updateMany: (args) => prisma.urgentRequest.updateMany(args)
    },
    urgentRequestEvent: { create: (args) => prisma.urgentRequestEvent.create(args) },
    preInquiry: { create: (args) => prisma.preInquiry.create(args) },
    urgentDesk: { findFirst: (args) => prisma.urgentDesk.findFirst(args) },
    urgentDeskMember: {
      findFirst: (args) => prisma.urgentDeskMember.findFirst(args),
      count: (args) => prisma.urgentDeskMember.count(args)
    },
    $transaction: async (fn) => {
      await gate;
      return prisma.$transaction(fn);
    }
  };
}

/**
 * Jookseb kaotaja kuni lugemiseni, laseb siis võitja lõpuni ja alles seejärel
 * lubab kaotajal kirjutada.
 */
async function race({ loser, winner }) {
  let onLoaded;
  const loaded = new Promise((resolve) => { onLoaded = resolve; });
  let openGate;
  const gate = new Promise((resolve) => { openGate = resolve; });

  const loserPromise = loser(sequencedClient({ onLoaded, gate })).then(
    (value) => ({ value }),
    (error) => ({ error })
  );
  await loaded;
  const winnerResult = await winner().then((value) => ({ value }), (error) => ({ error }));
  openGate();
  return { winner: winnerResult, loser: await loserPromise };
}

async function eventKinds(requestId) {
  const rows = await prisma.urgentRequestEvent.findMany({ where: { requestId } });
  return rows.map((row) => row.kind);
}

async function main() {
  const suffix = randomUUID().slice(0, 8);

  try {
    const municipality = await prisma.municipality.create({
      data: {
        slug: `sol-urg-probe-${suffix}`,
        baseName: `Sond ${suffix}`,
        type: "VALD",
        displayName: `Sondivald ${suffix}`
      }
    });
    created.municipalities.push(municipality);

    for (const label of ["author", "staff-a", "staff-b", "staff-c"]) {
      created.users.push(await prisma.user.create({
        data: { email: `sol-urg-${label}-${suffix}@probe.invalid`, role: "CLIENT" }
      }));
    }
    const [author, staffA, staffB, staffC] = created.users;

    const deskData = (name) => ({
      municipalityId: municipality.id,
      recipientType: "KOV_CONTACT",
      publicName: name,
      openingHours: "E–P 17.00–09.00",
      whoMayContact: "Iga elanik.",
      costToPerson: "Tasuta.",
      readingTimePromise: "Loeme läbi hiljemalt 2 tunni jooksul.",
      contactChannel: "Vastuvõtulaud platvormil.",
      emergencyBoundary: "Vahetu ohu korral helista 112.",
      requestLifetimeHours: 12,
      directContactAllowed: true,
      isActive: true,
      lastVerifiedAt: new Date()
    });

    /* Kaks lauda ei saa olla samas vallas sama saajatüübiga (laud on piirkonna
       lüliti), seega üleandmise sihid saavad oma vallad. */
    const deskMain = await prisma.urgentDesk.create({ data: deskData(`Peamine ${suffix}`) });
    created.desks.push(deskMain);
    for (const target of ["Teine", "Kolmas"]) {
      const targetMunicipality = await prisma.municipality.create({
        data: {
          slug: `sol-urg-probe-${target.toLowerCase()}-${suffix}`,
          baseName: `Sond ${target} ${suffix}`,
          type: "VALD",
          displayName: `Sondivald ${target} ${suffix}`
        }
      });
      created.municipalities.push(targetMunicipality);
      const desk = await prisma.urgentDesk.create({
        data: { ...deskData(`${target} ${suffix}`), municipalityId: targetMunicipality.id }
      });
      created.desks.push(desk);
    }
    const [, deskB, deskC] = created.desks;

    await prisma.urgentDeskMember.createMany({
      data: [
        { deskId: deskMain.id, userId: staffA.id, isActive: true },
        { deskId: deskMain.id, userId: staffB.id, isActive: true },
        { deskId: deskB.id, userId: staffB.id, isActive: true },
        { deskId: deskC.id, userId: staffC.id, isActive: true }
      ]
    });

    const fresh = async () => {
      const request = await createUrgentRequest({
        prisma,
        authorId: author.id,
        municipalityId: municipality.id,
        situationVerbatim: "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.",
        contactName: "Sondi Kadri",
        contactPhone: "+372 5123 4567",
        safetyAnswer: false
      });
      created.requestIds.push(request.id);
      return request;
    };

    // -----------------------------------------------------------------------
    // 0. LOOMINE. Rida ja tema esimene jälg tulevad koos.
    // -----------------------------------------------------------------------
    const first = await fresh();
    check("loomine: rida on olemas", Boolean(first?.id));
    check("loomine: CREATED jälg on olemas", (await eventKinds(first.id)).filter((k) => k === "CREATED").length === 1);

    // -----------------------------------------------------------------------
    // 1. READ ↔ RECALL. Loetud teksti ei saa lugemata teha.
    // -----------------------------------------------------------------------
    const readRace = await race({
      loser: (client) => recallUrgentRequest({ prisma: client, requestId: first.id, userId: author.id }),
      winner: () => markUrgentRequestRead({ prisma, requestId: first.id, userId: staffA.id })
    });
    const afterRead = await prisma.urgentRequest.findFirst({ where: { id: first.id } });
    check("READ↔RECALL: lugemine õnnestus", readRace.winner.value?.status === "READ", String(readRace.winner.error?.code));
    check(
      "READ↔RECALL: tagasivõtt kaotas ausa koodiga",
      readRace.loser.error?.code === "urgent_request.not_recallable",
      String(readRace.loser.error?.code || readRace.loser.value?.status)
    );
    check("READ↔RECALL: seis on READ", afterRead?.status === "READ", String(afterRead?.status));
    check("READ↔RECALL: RECALLED jälge ei tekkinud", !(await eventKinds(first.id)).includes("RECALLED"));

    // -----------------------------------------------------------------------
    // 2. TAKE ↔ TAKE. Kaks töötajat, üks vastutaja.
    // -----------------------------------------------------------------------
    const takeRace = await race({
      loser: (client) => takeUrgentRequest({ prisma: client, requestId: first.id, userId: staffB.id }),
      winner: () => takeUrgentRequest({ prisma, requestId: first.id, userId: staffA.id })
    });
    const afterTake = await prisma.urgentRequest.findFirst({ where: { id: first.id } });
    check("TAKE↔TAKE: üks võitja", takeRace.winner.value?.status === "TAKEN", String(takeRace.winner.error?.code));
    check(
      "TAKE↔TAKE: teine võtja kaotas",
      takeRace.loser.error?.code === "urgent_request.not_actionable",
      String(takeRace.loser.error?.code || takeRace.loser.value?.status)
    );
    check("TAKE↔TAKE: vastutaja on võitja", afterTake?.takenByUserId === staffA.id, String(afterTake?.takenByUserId));
    check(
      "TAKE↔TAKE: TAKEN jälgi on täpselt üks",
      (await eventKinds(first.id)).filter((kind) => kind === "TAKEN").length === 1
    );

    // -----------------------------------------------------------------------
    // 3. TAKE ↔ EXPIRE. Korje ei tohi võtta juba võetud tööd ega vastupidi.
    // -----------------------------------------------------------------------
    const overdue = await fresh();
    await prisma.urgentRequest.update({
      where: { id: overdue.id },
      data: { expiresAt: new Date(Date.parse(new Date().toISOString()) - 60_000) }
    });
    const expireRace = await race({
      loser: (client) => takeUrgentRequest({ prisma: client, requestId: overdue.id, userId: staffA.id }),
      winner: () => expireOverdueUrgentRequests({ prisma })
    });
    const afterExpire = await prisma.urgentRequest.findFirst({ where: { id: overdue.id } });
    check(
      "TAKE↔EXPIRE: aegumine jõudis ette",
      expireRace.winner.value?.expired?.includes(overdue.id) === true,
      JSON.stringify(expireRace.winner.value?.expired || expireRace.winner.error?.message)
    );
    check(
      "TAKE↔EXPIRE: võtmine kaotas ausa koodiga",
      expireRace.loser.error?.code === "urgent_request.not_actionable",
      String(expireRace.loser.error?.code || expireRace.loser.value?.status)
    );
    check("TAKE↔EXPIRE: vastutajat ei omistatud", (afterExpire?.takenByUserId ?? null) === null);

    const taken = await fresh();
    await prisma.urgentRequest.update({
      where: { id: taken.id },
      data: { expiresAt: new Date(Date.parse(new Date().toISOString()) - 60_000) }
    });
    await takeUrgentRequest({ prisma, requestId: taken.id, userId: staffA.id });
    const sweep = await expireOverdueUrgentRequests({ prisma });
    const afterSweep = await prisma.urgentRequest.findFirst({ where: { id: taken.id } });
    check("EXPIRE: võetud rida jääb korjest puutumata", !sweep.expired.includes(taken.id));
    check("EXPIRE: seis on endiselt TAKEN", afterSweep?.status === "TAKEN", String(afterSweep?.status));

    // -----------------------------------------------------------------------
    // 4. HANDOVER ↔ ACCEPT. Vana kinnitus ei tohi juhtumit vale lauale viia.
    // -----------------------------------------------------------------------
    const handed = await fresh();
    await handOverUrgentRequest({
      prisma, requestId: handed.id, userId: staffA.id, targetDeskId: deskB.id
    });
    const handoverRace = await race({
      loser: (client) => acceptUrgentHandover({ prisma: client, requestId: handed.id, userId: staffB.id }),
      winner: () => handOverUrgentRequest({
        prisma, requestId: handed.id, userId: staffA.id, targetDeskId: deskC.id
      })
    });
    const afterHandover = await prisma.urgentRequest.findFirst({ where: { id: handed.id } });
    check(
      "HANDOVER↔ACCEPT: uus üleandmine õnnestus",
      handoverRace.winner.value?.handoverDeskId === deskC.id,
      String(handoverRace.winner.error?.code)
    );
    check(
      "HANDOVER↔ACCEPT: vana kinnitus kaotas",
      handoverRace.loser.error?.code === "urgent_request.handover_already_accepted",
      String(handoverRace.loser.error?.code || handoverRace.loser.value?.deskId)
    );
    check(
      "HANDOVER↔ACCEPT: juhtum ei liikunud vale laua kätte",
      afterHandover?.deskId === deskMain.id,
      String(afterHandover?.deskId)
    );
    check("HANDOVER↔ACCEPT: kinnitust ei märgitud", (afterHandover?.handoverAcceptedAt ?? null) === null);

    // -----------------------------------------------------------------------
    // 5. VEASÜST päris trigger'iga: vastutusjälje kirjutus kukub. Seis ei tohi
    //    liikuda. Just see oli SOL-URG-05: kaks eraldi kirjutust, teise viga
    //    andis 500 ja esimene jäi alles.
    // -----------------------------------------------------------------------
    const injected = await fresh();
    console.log("[SOL-URG sond] järgnev prisma:error on TAOTLETUD — veasüst vajab kukkuvat jäljekirjutust.\n");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sol_urg_probe_block() RETURNS trigger AS $$
      BEGIN
        IF NEW."requestId" = '${injected.id}' AND NEW."kind" = 'TAKEN' THEN
          RAISE EXCEPTION 'sol_urg_probe_injected';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER sol_urg_probe_trigger BEFORE INSERT ON "UrgentRequestEvent"
      FOR EACH ROW EXECUTE FUNCTION sol_urg_probe_block();
    `);

    let injectedError = null;
    try {
      await takeUrgentRequest({ prisma, requestId: injected.id, userId: staffA.id });
    } catch (error) {
      injectedError = error;
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS sol_urg_probe_trigger ON "UrgentRequestEvent";`).catch(() => null);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS sol_urg_probe_block();`).catch(() => null);
    }
    const afterInjection = await prisma.urgentRequest.findFirst({ where: { id: injected.id } });
    check("veasüst: võtmine kukkus", Boolean(injectedError), String(injectedError?.message).split("\n")[0]);
    check("veasüst: seis EI liikunud", afterInjection?.status === "SENT", String(afterInjection?.status));
    check("veasüst: vastutajat ei omistatud", (afterInjection?.takenByUserId ?? null) === null);
    check("veasüst: TAKEN jälge ei tekkinud", !(await eventKinds(injected.id)).includes("TAKEN"));

    // -----------------------------------------------------------------------
    // 6. SOL-URG-09: laua rida ON valmiduse mutex.
    //
    //    Admin hoiab luku all olles tehingut lahti. Kui lukk töötab, ei saa
    //    loomine samal ajal EDASI liikuda — ja just see ootamine on tõend.
    //    Vana koodis luges loomine valmiduse ilma lukuta ja jõudis lõpuni enne,
    //    kui admini muudatus commit'is.
    //
    //    Admini kirjutused on siin samad, mida `setUrgentDeskActive` ja
    //    `removeUrgentDeskMember` teevad — nemad võtavad sama luku ise, seega
    //    neid siit kutsuda ei saa (lukk oleks juba meie käes).
    // -----------------------------------------------------------------------
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function createWhileAdminHoldsLock(label, adminWrite, restore) {
      let release;
      const hold = new Promise((resolve) => { release = resolve; });
      const admin = prisma.$transaction(async (tx) => {
        await lockDeskRow(tx, deskMain.id);
        await adminWrite(tx);
        await hold;
      }, { timeout: 15_000 });

      await sleep(150); // admin jõuab luku võtta
      const creating = createUrgentRequest({
        prisma,
        authorId: author.id,
        municipalityId: municipality.id,
        situationVerbatim: "Mul ei ole täna öösel kuhugi minna.",
        contactName: "Sondi Kadri",
        contactPhone: "+372 5123 4567",
        safetyAnswer: false
      }).then((value) => { created.requestIds.push(value.id); return { value }; }, (error) => ({ error }));

      const blocked = await Promise.race([creating, sleep(600).then(() => "OOTAB")]);
      check(`${label}: lukk peatas loomise`, blocked === "OOTAB", String(blocked?.value?.id || blocked?.error?.code));

      release();
      await admin;
      const result = await creating;
      check(
        `${label}: loomine keeldus pärast admini muudatust`,
        result.error?.code === "urgent_request.desk_not_available",
        String(result.error?.code || result.value?.id)
      );
      await restore();
    }

    await createWhileAdminHoldsLock(
      "sulgemine",
      (tx) => tx.urgentDesk.update({ where: { id: deskMain.id }, data: { isActive: false } }),
      () => prisma.urgentDesk.update({ where: { id: deskMain.id }, data: { isActive: true } })
    );

    await createWhileAdminHoldsLock(
      "viimane mehitaja",
      (tx) => tx.urgentDeskMember.updateMany({ where: { deskId: deskMain.id }, data: { isActive: false } }),
      () => prisma.urgentDeskMember.updateMany({ where: { deskId: deskMain.id }, data: { isActive: true } })
    );

    // -----------------------------------------------------------------------
    // 7. SOL-URG-08: üleandmise siht peab kandma vastuvõtulubadust.
    // -----------------------------------------------------------------------
    const toUnready = await fresh();
    await prisma.urgentDeskMember.updateMany({ where: { deskId: deskB.id }, data: { isActive: false } });
    let targetError = null;
    try {
      await handOverUrgentRequest({
        prisma, requestId: toUnready.id, userId: staffA.id, targetDeskId: deskB.id
      });
    } catch (error) {
      targetError = error;
    }
    const afterTarget = await prisma.urgentRequest.findFirst({ where: { id: toUnready.id } });
    check(
      "URG-08: mehitamata siht keeldub",
      targetError?.code === "urgent_request.handover_target_not_ready",
      String(targetError?.code)
    );
    check("URG-08: üleandmist ei kirjutatud", (afterTarget?.handoverDeskId ?? null) === null);
    check("URG-08: HANDED_OVER jälge ei tekkinud", !(await eventKinds(toUnready.id)).includes("HANDED_OVER"));
    await prisma.urgentDeskMember.updateMany({ where: { deskId: deskB.id }, data: { isActive: true } });

    // -----------------------------------------------------------------------
    // 8. SOL-URG-10: konversioon täpselt üks kord. Kaotaja tehing peab oma
    //    mustandi TERVENI tagasi veeretama — muidu jääb kasutaja kontole teine
    //    koopia samast tundlikust verbatim-tekstist, ilma päritoluseoseta.
    // -----------------------------------------------------------------------
    const converting = await fresh();
    const beforeDrafts = await prisma.preInquiry.count({ where: { authorId: author.id } });
    const convertRace = await race({
      loser: (client) => convertUrgentRequestToPreInquiry({
        prisma: client, requestId: converting.id, userId: author.id
      }),
      winner: () => convertUrgentRequestToPreInquiry({
        prisma, requestId: converting.id, userId: author.id
      })
    });
    const afterConvert = await prisma.urgentRequest.findFirst({ where: { id: converting.id } });
    const afterDrafts = await prisma.preInquiry.count({ where: { authorId: author.id } });
    check(
      "URG-10: üks konversioon õnnestus",
      Boolean(convertRace.winner.value?.preInquiry?.id),
      String(convertRace.winner.error?.code)
    );
    check(
      "URG-10: teine katse kaotas ausa koodiga",
      convertRace.loser.error?.code === "urgent_request.already_converted",
      String(convertRace.loser.error?.code || convertRace.loser.value?.preInquiry?.id)
    );
    check("URG-10: mustandeid tekkis TÄPSELT ÜKS", afterDrafts - beforeDrafts === 1, `${beforeDrafts} → ${afterDrafts}`);
    check(
      "URG-10: viide osutab võitja mustandile",
      afterConvert?.convertedPreInquiryId === convertRace.winner.value?.preInquiry?.id,
      String(afterConvert?.convertedPreInquiryId)
    );
    check(
      "URG-10: CONVERTED jälgi on täpselt üks",
      (await eventKinds(converting.id)).filter((kind) => kind === "CONVERTED").length === 1
    );

    // -----------------------------------------------------------------------
    // 9. SOL-URG-12: kinnitajal on nimi ja adminitoimingul on jälg.
    //    Skeemimuudatuse järel on siin ka lihtsalt üks PÄRIS päring: fake ei
    //    valideeri veerge ega võõrvõtit.
    // -----------------------------------------------------------------------
    const verified = await verifyUrgentDesk({
      prisma, deskId: deskC.id, actorUserId: staffC.id
    });
    check("URG-12: kinnitusel on aeg", Boolean(verified?.lastVerifiedAt));
    check("URG-12: kinnitusel on KINNITAJA", verified?.lastVerifiedByUserId === staffC.id, String(verified?.lastVerifiedByUserId));
    check(
      "URG-12: kinnitusel on tekstiversioon",
      verified?.verifiedConditionsHash === conditionsHash(verified),
      String(verified?.verifiedConditionsHash).slice(0, 12)
    );

    const verifyAudit = await prisma.dataAuditLog.findMany({
      where: { resourceType: "UrgentDesk", resourceId: deskC.id, action: UrgentDeskAuditAction.VERIFIED }
    });
    check("URG-12: kinnitamine jättis auditirea", verifyAudit.length === 1, `ridu ${verifyAudit.length}`);
    check("URG-12: auditirida kannab tegijat", verifyAudit[0]?.actorUserId === staffC.id);

    await removeUrgentDeskMember({
      prisma, deskId: deskC.id, userId: staffC.id, actorUserId: staffC.id
    });
    const removalAudit = await prisma.dataAuditLog.findMany({
      where: { resourceType: "UrgentDesk", resourceId: deskC.id, action: UrgentDeskAuditAction.MEMBER_REMOVED }
    });
    check("URG-12: viimase mehitaja eemaldamine jättis jälje", removalAudit.length === 1);
    check(
      "URG-12: jälg ütleb, et mehitajaid ei jäänud",
      removalAudit[0]?.meta?.remainingActiveMembers === 0,
      String(removalAudit[0]?.meta?.remainingActiveMembers)
    );
  } finally {
    for (const requestId of created.requestIds) {
      await prisma.urgentRequestEvent.deleteMany({ where: { requestId } }).catch(() => null);
      await prisma.urgentRequest.delete({ where: { id: requestId } }).catch(() => null);
    }
    for (const user of created.users) {
      await prisma.preInquiry.deleteMany({ where: { authorId: user.id } }).catch(() => null);
    }
    for (const desk of created.desks) {
      await prisma.dataAuditLog.deleteMany({
        where: { resourceType: "UrgentDesk", resourceId: desk.id }
      }).catch(() => null);
      await prisma.urgentDeskMember.deleteMany({ where: { deskId: desk.id } }).catch(() => null);
      await prisma.urgentDesk.delete({ where: { id: desk.id } }).catch(() => null);
    }
    for (const user of created.users) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    }
    for (const municipality of created.municipalities) {
      await prisma.municipality.delete({ where: { id: municipality.id } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }
}

main()
  .then(() => {
    console.log(results.join("\n"));
    console.log(`\n${results.length - failures}/${results.length} OK`);
    process.exit(failures ? 1 : 0);
  })
  .catch((error) => {
    console.log(results.join("\n"));
    console.error(`\n[SOL-URG sond] katkes: ${error?.stack || error}`);
    process.exit(1);
  });
