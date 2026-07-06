import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { syncKovContactsToServiceMap } from "../../lib/serviceMap/kovContactSync.js";

async function makeTempKovRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "kov-contact-sync-"));
}

test("sync reads central KOV contact registry before folder contact items", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.mkdir(path.join(kovRoot, "parnu-linn"));
  await fs.writeFile(
    path.join(kovRoot, "parnu-linn", "parnu-linn.json"),
    JSON.stringify({
      municipality_id: "parnu-linn",
      municipality_name: "Parnu linn",
      items: [
        {
          itemType: "contact",
          name: "Folder Contact",
          email: "folder@example.test"
        }
      ]
    })
  );
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "parnu-linn",
        municipality: "Parnu linn",
        name: "Central Contact",
        title: "Sotsiaaltöötaja",
        role: "sotsiaaltöötaja",
        department: "Sotsiaalosakond",
        phone: "+372 444 8200",
        email: "central@example.test",
        address: "Suur-Sepa 16, Pärnu",
        officialUrl: "https://parnu.ee/sotsiaal"
      }
    ])
  );

  const upserts = [];
  const prisma = {
    municipality: {
      findFirst: async ({ where }) => {
        assert.equal(where.OR[0].slug, "parnu-linn");
        return {
          id: "parnu-id",
          slug: "parnu-linn",
          displayName: "Parnu linn",
          county: "Parnumaa"
        };
      }
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async (payload) => {
        upserts.push(payload);
        return payload.create;
      }
    }
  };

  const result = await syncKovContactsToServiceMap({
    kovRoot,
    prisma,
    dryRun: false
  });

  assert.equal(result.scannedFiles, 1);
  assert.equal(result.scannedContacts, 1);
  assert.equal(result.upserted, 1);
  assert.equal(upserts[0].create.title, "Central Contact");
  assert.equal(upserts[0].create.email, "central@example.test");
  assert.equal(upserts[0].create.phone, "+372 444 8200");
  assert.equal(upserts[0].create.sourceUrl, "https://parnu.ee/sotsiaal");
});

test("central contact with multiple reception locations creates one map entry per location", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "laane-nigula-vald",
        municipality: "Laane-Nigula vald",
        county: "Laanemaa",
        name: "Maire Koppelmaa",
        role: "sotsiaaltoo spetsialist",
        phone: "518 7159",
        email: "maire.koppelmaa@example.test",
        address: "Noarootsi osavallamaja; Nova osavallamaja; Oru osavallamaja"
      }
    ])
  );

  const prisma = {
    municipality: {
      findFirst: async () => ({
        id: "laane-nigula-id",
        slug: "laane-nigula-vald",
        displayName: "Laane-Nigula vald",
        county: "Laanemaa"
      })
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };

  const result = await syncKovContactsToServiceMap({
    kovRoot,
    prisma,
    dryRun: true
  });

  assert.equal(result.scannedContacts, 1);
  assert.equal(result.entries.length, 3);
  assert.deepEqual(result.entries.map((entry) => entry.address), [
    "Noarootsi osavallamaja",
    "Nova osavallamaja",
    "Oru osavallamaja"
  ]);
  assert.equal(new Set(result.entries.map((entry) => entry.id)).size, 3);
  assert.ok(result.entries.every((entry) => entry.description.includes("Vastuv")));
});

test("central contact raw id still creates distinct entries for multiple locations", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        id: "tallinn-lov-shared-contact",
        slug: "tallinn-haabersti",
        municipality: "Tallinna linn",
        county: "Harjumaa",
        name: "Jagatud Kontakt",
        role: "laste heaolu spetsialist",
        email: "jagatud@example.test",
        address: "Ehitajate tee 109a/1, Tallinn; Valdeku 13, Tallinn"
      }
    ])
  );

  const prisma = {
    municipality: {
      findFirst: async () => null
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };

  const result = await syncKovContactsToServiceMap({
    kovRoot,
    prisma,
    dryRun: true
  });

  assert.equal(result.entries.length, 2);
  assert.equal(new Set(result.entries.map((entry) => entry.id)).size, 2);
  assert.ok(result.entries.every((entry) => entry.id.startsWith("kov-contact-tallinn-lov-shared-contact")));
});

test("central contact without address uses municipality office fallback when known", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "alutaguse-vald",
        municipality: "Alutaguse vald",
        county: "Ida-Virumaa",
        name: "Nelli Kuldmaa",
        role: "haridus- ja noorsootoo",
        phone: "5555 0000",
        email: "nelli.kuldmaa@example.test"
      }
    ])
  );

  const prisma = {
    municipality: {
      findFirst: async () => ({
        id: "alutaguse-id",
        slug: "alutaguse-vald",
        displayName: "Alutaguse vald",
        county: "Ida-Virumaa"
      })
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };

  const result = await syncKovContactsToServiceMap({
    kovRoot,
    prisma,
    dryRun: true
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].address, "Tartu mnt 56, Iisaku alevik, Alutaguse vald, 41101");
  assert.equal(result.entries[0].geocodingStatus, "PENDING");
});

test("central contacts with same title get stable distinct ids from name and email", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "anija-vald",
        municipality: "Anija vald",
        title: "Sotsiaaltööspetsialist",
        name: "Airi Hõrrak",
        email: "airi.horrak@example.test"
      },
      {
        slug: "anija-vald",
        municipality: "Anija vald",
        title: "Sotsiaaltööspetsialist",
        name: "Lydia Kruusmann",
        email: "lydia.kruusmann@example.test"
      }
    ])
  );

  const prisma = {
    municipality: {
      findFirst: async () => ({
        id: "anija-id",
        slug: "anija-vald",
        displayName: "Anija vald",
        county: "Harjumaa"
      })
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };

  const result = await syncKovContactsToServiceMap({
    kovRoot,
    prisma,
    dryRun: true
  });

  assert.equal(result.entries.length, 2);
  assert.notEqual(result.entries[0].id, result.entries[1].id);
  assert.deepEqual(result.entries.map((entry) => entry.title), ["Airi Hõrrak", "Lydia Kruusmann"]);
});
