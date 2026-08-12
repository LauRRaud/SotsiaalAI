#!/usr/bin/env node
/**
 * SOL-EVENT-01 sond — PÄRIS PostgreSQL, mitte fake-Prisma.
 *
 * MIKS SEE FAIL OLEMAS ON. Leiul on kaks poolt ja fake mõõdab ainult ühte.
 *
 *   1. IDENTITEET. Sama idempotentsusvõti tohib anda edu ainult sama teo peal.
 *      Seda saab mõõta ka fake'i peal ja `npm test` teeb seda.
 *   2. TAASTERADA. Vana kood lootis, et pärast `P2002` saab SAMAS tehingus rea
 *      `findUnique`-ga üles küsida. Postgres märgib tehingu pärast
 *      unikaalsusrikkumist vigaseks ja iga järgnev käsk selles tehingus kukub —
 *      seega vana „leidsin rea, kõik hästi" haru EI OLE KUNAGI päris andmebaasis
 *      töötanud. Fake ei saa seda näidata, sest fake'i `findUnique` vastab rõõmsalt
 *      ka pärast viga. Jaam 4 mõõdab täpselt selle.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { emitDomainEvent } from "../lib/events/emitDomainEvent.js";
import { DomainEventType } from "../lib/events/registry.js";

process.env.U1_OUTBOX_ENABLED = "true";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { users: [], keys: [] };

async function eventsForKey(key) {
  return prisma.domainEvent.findMany({ where: { idempotencyKey: key } });
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const KEY = `pre_inquiry.opened:probe-${suffix}:2026-08-12T06:00:00.000Z`;
  const OTHER_KEY = `pre_inquiry.opened:probe-${suffix}-other:2026-08-12T06:00:00.000Z`;
  created.keys.push(KEY, OTHER_KEY);

  try {
    const actor = await prisma.user.create({
      data: { email: `sol-event-01-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.users.push(actor);

    const base = (overrides = {}) => ({
      type: DomainEventType.PRE_INQUIRY_OPENED,
      actorKind: "user",
      actorUserId: actor.id,
      sourceId: `probe-${suffix}`,
      workspaceId: `probe-${suffix}`,
      actionTarget: `pre_inquiry:probe-${suffix}`,
      idempotencyKey: KEY,
      occurredAt: new Date("2026-08-12T06:00:00.000Z"),
      meta: { statusKey: "READY" },
      ...overrides
    });

    // -----------------------------------------------------------------------
    // 1. SAMA TEGU KAKS KORDA. Teine kutse ei kirjuta ega kuku.
    // -----------------------------------------------------------------------
    const first = await prisma.$transaction(async tx => emitDomainEvent(tx, base()));
    const second = await prisma.$transaction(async tx => emitDomainEvent(tx, base()));
    check("sama tegu: esimene kutse kirjutas rea", first.created === true, `created=${first.created}`);
    check("sama tegu: teine kutse on idempotentne", second.created === false, `created=${second.created}`);
    check("sama tegu: ridu on täpselt üks", (await eventsForKey(KEY)).length === 1);

    // -----------------------------------------------------------------------
    // 2. AEG EI OLE TEOIDENTITEET. Hilisem märkamisaeg ei ole uus tegu.
    // -----------------------------------------------------------------------
    const later = await prisma.$transaction(async tx =>
      emitDomainEvent(tx, base({ occurredAt: new Date("2026-08-12T07:30:00.000Z") })));
    const afterLater = await eventsForKey(KEY);
    check("aeg: hilisem märkamisaeg jääb idempotentseks", later.created === false, `created=${later.created}`);
    check(
      "aeg: salvestatud aeg ei muutunud",
      afterLater[0]?.occurredAt?.toISOString() === "2026-08-12T06:00:00.000Z",
      String(afterLater[0]?.occurredAt?.toISOString())
    );

    // -----------------------------------------------------------------------
    // 3. TEISTSUGUNE TEGU SAMA VÕTMEGA. Konflikt JA kogu tehing tagasi.
    //    Tehingus on ENNE konflikti teine, kehtiv sündmus — kui ta jääb alles,
    //    ei ole „katkestab sama tehingu" täidetud.
    // -----------------------------------------------------------------------
    let conflict = null;
    try {
      await prisma.$transaction(async tx => {
        await emitDomainEvent(tx, base({ idempotencyKey: OTHER_KEY, sourceId: `probe-${suffix}-other` }));
        await emitDomainEvent(tx, base({ sourceId: `probe-${suffix}-changed` }));
      });
    } catch (error) {
      conflict = error;
    }
    check(
      "konflikt: teistsugune tegu annab selge vea",
      conflict?.code === "DOMAIN_EVENT_IDEMPOTENCY_CONFLICT",
      `code=${conflict?.code}`
    );
    check(
      "konflikt: erinev väli on nimeliselt kirjas",
      Array.isArray(conflict?.differingFields) && conflict.differingFields.includes("sourceId"),
      `differingFields=${conflict?.differingFields}`
    );
    check("konflikt: olemasolev rida ei muutunud", (await eventsForKey(KEY)).length === 1);
    check(
      "konflikt: sama tehingu varasem sündmus veeres tagasi",
      (await eventsForKey(OTHER_KEY)).length === 0,
      `ridu ${(await eventsForKey(OTHER_KEY)).length}`
    );

    // -----------------------------------------------------------------------
    // 4. NEGATIIVKONTROLL — VANA KUJU PÄRIS POSTGRESIS.
    //    `create` → `catch (P2002)` → `findUnique` SAMAS tehingus. Kui see rada
    //    töötaks, oleks vana kood olnud ainult identiteedi-auk. Ta ei tööta.
    // -----------------------------------------------------------------------
    const existingRow = (await eventsForKey(KEY))[0];
    const duplicate = { ...existingRow };
    delete duplicate.id;
    delete duplicate.createdAt;

    console.log("[SOL-EVENT-01 sond] järgnev prisma:error on TAOTLETUD — negatiivkontroll vajab kukkuvat kirjutust.\n");
    let oldShape = "";
    try {
      await prisma.$transaction(async tx => {
        try {
          await tx.domainEvent.create({ data: duplicate });
          oldShape = "P2002 jäi tulemata";
          return;
        } catch (error) {
          if (error?.code !== "P2002") throw error;
        }
        // Täpselt see rida, mida vana kood tegi.
        const row = await tx.domainEvent.findUnique({ where: { idempotencyKey: KEY } });
        oldShape = row ? "leidis rea" : "ei leidnud rida";
      });
    } catch (error) {
      oldShape = `tehing kukkus: ${error?.code || String(error?.message || "").split("\n")[0]}`;
    }
    check(
      "negatiivkontroll: vana taasterada EI tööta päris andmebaasis",
      oldShape !== "leidis rea",
      oldShape
    );

    // -----------------------------------------------------------------------
    // 5. VÕIDUJOOKS, deterministlikult. B teeb oma olemasolukontrolli AJAL, mil
    //    A tehing on veel lahti (B ei näe midagi), ja kirjutab alles pärast A
    //    commit'i. Mähis ainult JÄRJESTAB kutseid — päringud käivad päris
    //    tehingu peal.
    // -----------------------------------------------------------------------
    const RACE_KEY = `pre_inquiry.opened:probe-${suffix}-race:2026-08-12T06:00:00.000Z`;
    created.keys.push(RACE_KEY);
    let signalPrechecked;
    const prechecked = new Promise(resolve => { signalPrechecked = resolve; });
    let openGate;
    const gate = new Promise(resolve => { openGate = resolve; });

    const winner = prisma.$transaction(async tx => {
      const result = await emitDomainEvent(tx, base({ idempotencyKey: RACE_KEY }));
      await prechecked; // hoia A lahti, kuni B on oma kontrolli teinud
      return result;
    });

    const loser = prisma.$transaction(async tx => {
      const sequenced = {
        domainEvent: {
          findUnique: async args => {
            const row = await tx.domainEvent.findUnique(args);
            signalPrechecked();
            await gate; // A commit'ib vahepeal
            return row;
          },
          create: args => tx.domainEvent.create(args)
        }
      };
      return emitDomainEvent(sequenced, base({ idempotencyKey: RACE_KEY }));
    });

    const winnerResult = await winner.catch(error => ({ error }));
    openGate();
    const loserResult = await loser.then(value => ({ value }), error => ({ error }));

    check("võidujooks: võitja kirjutas rea", winnerResult?.created === true, `created=${winnerResult?.created}`);
    check(
      "võidujooks: kaotaja kukub, mitte ei teata edu",
      loserResult.error?.code === "P2002" && loserResult.error?.domainEventRace === true,
      `code=${loserResult.error?.code}, race=${loserResult.error?.domainEventRace}`
    );
    check("võidujooks: ridu on täpselt üks", (await eventsForKey(RACE_KEY)).length === 1);
  } finally {
    for (const key of created.keys) {
      await prisma.domainEvent.deleteMany({ where: { idempotencyKey: key } }).catch(() => null);
    }
    for (const user of created.users) {
      await prisma.domainEvent.deleteMany({ where: { actorUserId: user.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
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
  .catch(error => {
    console.log(results.join("\n"));
    console.error(`\n[SOL-EVENT-01 sond] katkes: ${error?.stack || error}`);
    process.exit(1);
  });
