import test from "node:test";
import assert from "node:assert/strict";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { BINDING_AUDIT_ACTION, BINDING_ERROR, bindServiceKey, bindingCandidates } from "../../lib/mtr/serviceBinding.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function fakePrisma({ service }) {
  const state = { updates: [], upserts: [], deletes: [], audits: [], transactions: 0 };
  const tx = {
    serviceProviderService: {
      findUnique: async () => service,
      update: async (args) => {
        state.updates.push(args);
        return { ...service, ...args.data };
      }
    },
    serviceLicenceAssessment: {
      upsert: async (args) => {
        state.upserts.push(args);
        return args.create;
      },
      deleteMany: async (args) => {
        state.deletes.push(args);
        return { count: 1 };
      }
    },
    dataAuditLog: {
      create: async (args) => {
        state.audits.push(args.data);
        return args.data;
      }
    }
  };
  return {
    state,
    $transaction: async (fn) => {
      state.transactions += 1;
      return fn(tx);
    },
    serviceProviderService: { findUnique: async () => service }
  };
}

const service = { id: "s1", name: "Toetatud elamine", serviceKey: null, providerProfileId: "p1" };

test("tundmatut võtit ei seota", async () => {
  const prisma = fakePrisma({ service });
  const result = await bindServiceKey({ providerServiceId: "s1", serviceKey: "MIDAGI_MUUD", prisma, now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.error, BINDING_ERROR.UNKNOWN_SERVICE_KEY);
  assert.equal(prisma.state.transactions, 0, "tundmatu võti ei jõua andmebaasi");
});

test("puuduvat teenust ei seota", async () => {
  const prisma = fakePrisma({ service: null });
  const result = await bindServiceKey({ providerServiceId: "puudub", serviceKey: "TOETATUD_ELAMINE", prisma, now: NOW });
  assert.equal(result.error, BINDING_ERROR.SERVICE_NOT_FOUND);
});

test("sidumine nullib vana tõendi ja jätab jälje", async () => {
  const prisma = fakePrisma({ service: { ...service, serviceKey: "KOGUKONNAS_ELAMINE" } });
  let checked = null;

  const result = await bindServiceKey({
    providerServiceId: "s1",
    serviceKey: "TOETATUD_ELAMINE",
    actorUserId: "admin-1",
    prisma,
    now: NOW,
    runCheck: async (args) => {
      checked = args;
      return { completed: true, succeeded: true };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.previousServiceKey, "KOGUKONNAS_ELAMINE");

  /* Vana hinnang EI KEHTI uuele teenuseliigile: seis läheb kohe
     NOT_CHECKED peale ja kogu tõendus kustub. */
  const written = prisma.state.upserts[0].create;
  assert.equal(written.publicStatus, LICENCE_PUBLIC_STATUS.NOT_CHECKED);
  assert.equal(written.serviceKey, "TOETATUD_ELAMINE");
  assert.equal(written.activityTypeExpected, "Toetatud elamise teenus");
  assert.equal(written.statusSourceCheckId, null);
  assert.equal(written.publicStatusValidUntil, null);
  assert.equal(written.coveringLicenceNumber, null);
  assert.equal(written.confirmedMissCount, 0);

  /* Jälg: kes, millal, vana võti, uus võti. */
  const audit = prisma.state.audits[0];
  assert.equal(audit.action, BINDING_AUDIT_ACTION);
  assert.equal(audit.actorUserId, "admin-1");
  assert.equal(audit.resourceId, "s1");
  assert.equal(audit.meta.previousServiceKey, "KOGUKONNAS_ELAMINE");
  assert.equal(audit.meta.nextServiceKey, "TOETATUD_ELAMINE");

  /* Kohene kontroll, mitte ootamine järgmise korjeni. */
  assert.equal(checked.providerProfileId, "p1");
  assert.equal(checked.trigger, "AUTO", "jahtumisaeg ei tohi sidumisjärgset kontrolli ära jätta");
});

test("lahutamine kustutab hinnangu ega käivita kontrolli", async () => {
  const prisma = fakePrisma({ service: { ...service, serviceKey: "TOETATUD_ELAMINE" } });
  let ran = false;

  const result = await bindServiceKey({
    providerServiceId: "s1",
    serviceKey: null,
    prisma,
    now: NOW,
    runCheck: async () => {
      ran = true;
      return {};
    }
  });

  assert.equal(result.serviceKey, null);
  assert.equal(prisma.state.deletes.length, 1, "lahutatud teenusel ei ole seisu, mida kuvada");
  assert.equal(prisma.state.upserts.length, 0);
  assert.equal(ran, false, "lahutamise järel ei ole midagi kontrollida");
});

test("sama võti ei tee midagi", async () => {
  const prisma = fakePrisma({ service: { ...service, serviceKey: "TOETATUD_ELAMINE" } });
  const result = await bindServiceKey({ providerServiceId: "s1", serviceKey: "TOETATUD_ELAMINE", prisma, now: NOW });

  assert.equal(result.changed, false);
  assert.equal(prisma.state.audits.length, 0, "muutumatu seos ei jäta jälge");
  assert.equal(prisma.state.updates.length, 0);
});

test("loakohustuseta teenus saab seisu kohe, ilma MTR-päringuta", async () => {
  const prisma = fakePrisma({ service });
  let ran = false;

  const result = await bindServiceKey({
    providerServiceId: "s1",
    serviceKey: "TUGIISIK",
    prisma,
    now: NOW,
    runCheck: async () => {
      ran = true;
      return {};
    }
  });

  /* Otsus on juba E2 kataloogis — teda ei tohi siduda registri
     kättesaadavusega ega jätta ajutiselt vale `NOT_CHECKED` seisu. */
  assert.equal(prisma.state.upserts[0].create.publicStatus, LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  assert.equal(ran, false, "loakohustuseta rida ei koorma registrit");
  assert.equal(result.check, null);
});

test("kohese kontrolli tõrge EI tühista sidumist", async () => {
  const prisma = fakePrisma({ service });

  const result = await bindServiceKey({
    providerServiceId: "s1",
    serviceKey: "TOETATUD_ELAMINE",
    prisma,
    now: NOW,
    runCheck: async () => {
      throw new Error("register ei vastanud");
    }
  });

  /* Võti ON muudetud, tõend kustutatud ja audit kirjutatud — vea tagastamine
     paneks admini arvama, et midagi ei salvestunud, ja kordamine annaks
     `changed: false` ega prooviks kontrolli uuesti. */
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.serviceKey, "TOETATUD_ELAMINE");
  assert.equal(result.checkError, BINDING_ERROR.IMMEDIATE_CHECK_FAILED);
  assert.equal(prisma.state.audits.length, 1);
});

test("kandidaadid on ettepanek koos kindlusastmega, mitte valik", async () => {
  const prisma = {
    serviceProviderService: {
      findUnique: async () => ({
        id: "s1",
        name: "Meie hooldekodu",
        description: "Pakume ka lapsehoidu",
        category: "",
        categories: [],
        serviceKey: null
      })
    }
  };

  const result = await bindingCandidates({ providerServiceId: "s1", prisma });

  assert.equal(result.ok, true);
  const keys = result.candidates.map((row) => row.serviceKey);
  assert.ok(keys.includes("YLDHOOLDUS_VALJASPOOL_KODU"));
  assert.ok(keys.includes("LAPSEHOID_SUURE_VAJADUSEGA"));

  /* Madala kindlusega alias peab kandma põhjust — „lapsehoid" tähendab
     tänases seaduses hoopis teist teenust. */
  const lapsehoid = result.candidates.find((row) => row.serviceKey === "LAPSEHOID_SUURE_VAJADUSEGA");
  assert.equal(lapsehoid.confidence, "LOW");
  assert.ok(lapsehoid.note);
});
