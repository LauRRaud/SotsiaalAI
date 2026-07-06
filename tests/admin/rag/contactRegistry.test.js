import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyKovContactRegistryCheck,
  buildKovContactRegistry,
  checkKovContactRegistryFromWeb,
  refreshKovContactRegistry,
  writeKovContactRegistryBaseline
} from "../../../lib/admin/rag/contactRegistry/service.js";

async function makeTempKovRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kov-contact-registry-"));
  await fs.mkdir(path.join(root, "LOV"), { recursive: true });
  return root;
}

test("contact registry refresh preserves central KOV contacts and replaces LOV contacts", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "harku-vald",
        municipality: "Harku vald",
        name: "Harku Kontakt",
        email: "harku@example.test"
      },
      {
        slug: "tallinn-haabersti",
        municipality: "Tallinna linn",
        name: "Vana LOV Kontakt",
        email: "vana@example.test"
      }
    ])
  );
  await fs.writeFile(
    path.join(kovRoot, "LOV", "haabersti_kontaktid_koond.json"),
    JSON.stringify({
      contacts: [
        {
          name: "Uus LOV Kontakt",
          role: "sotsiaaltöö spetsialist",
          email: "uus@example.test",
          phone: "123",
          address: "Ehitajate tee 109a/1, 13514 Tallinn; kabinet 110",
          source_url: "https://example.test/lov"
        }
      ]
    })
  );

  const registry = await buildKovContactRegistry({ kovRoot });
  assert.equal(registry.contacts.length, 2);
  assert.equal(registry.contacts[0].name, "Harku Kontakt");
  assert.equal(registry.contacts[1].name, "Uus LOV Kontakt");
  assert.equal(registry.contacts[1].address, "Ehitajate tee 109a/1, 13514 Tallinn");

  await refreshKovContactRegistry({
    kovRoot,
    prisma: {
      serviceMapEntry: {}
    },
    syncServiceMap: false
  });

  const refreshed = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), "utf8"));
  assert.deepEqual(refreshed.map((contact) => contact.name), ["Harku Kontakt", "Uus LOV Kontakt"]);
  assert.equal(refreshed[1].id, "tallinn-haabersti-lov-001");
});

test("web check writes comparison candidate without changing central contact file", async () => {
  const kovRoot = await makeTempKovRoot();
  const originalContacts = [
    {
      slug: "test-vald",
      municipality: "Test vald",
      name: "Mari Maasikas",
      email: null,
      officialUrl: "https://example.test/kontakt"
    }
  ];
  await fs.writeFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), JSON.stringify(originalContacts, null, 2));

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => "<main>Mari Maasikas e-post mari.maasikas [ät] example.test</main>"
  });

  try {
    const report = await checkKovContactRegistryFromWeb({ kovRoot });
    assert.equal(report.checkedUrls, 1);
    assert.equal(report.changedContacts, 1);
    assert.equal(report.emailMatches[0].foundEmail, "mari.maasikas@example.test");

    const central = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), "utf8"));
    const candidate = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.kontroll.json"), "utf8"));
    assert.equal(central[0].email, null);
    assert.equal(candidate[0].email, "mari.maasikas@example.test");
  } finally {
    global.fetch = originalFetch;
  }
});

test("contact registry baseline writes summary without changing central contact file", async () => {
  const kovRoot = await makeTempKovRoot();
  const originalContacts = [
    {
      slug: "test-vald",
      municipality: "Test vald",
      name: "Mari Maasikas",
      email: "mari.maasikas@example.test"
    }
  ];
  await fs.writeFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), JSON.stringify(originalContacts, null, 2));

  const result = await writeKovContactRegistryBaseline({ kovRoot });
  const central = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), "utf8"));
  const summary = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.summary.json"), "utf8"));

  assert.equal(result.summaryFile, "KOV/kov_kontaktid_loplik.summary.json");
  assert.deepEqual(central, originalContacts);
  assert.equal(summary.contacts, 1);
  assert.equal(typeof summary.sourceFingerprint, "string");
});

test("apply check promotes candidate to central file and keeps a backup", async () => {
  const kovRoot = await makeTempKovRoot();
  await fs.writeFile(
    path.join(kovRoot, "kov_kontaktid_loplik.json"),
    JSON.stringify([
      {
        slug: "test-vald",
        municipality: "Test vald",
        name: "Mari Maasikas",
        email: null,
        officialUrl: "https://example.test/kontakt"
      }
    ], null, 2)
  );

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => "<main>Mari Maasikas e-post mari.maasikas [ät] example.test</main>"
  });

  try {
    await checkKovContactRegistryFromWeb({ kovRoot });
    const result = await applyKovContactRegistryCheck({
      kovRoot,
      prisma: { serviceMapEntry: {} },
      syncServiceMap: false
    });
    const central = JSON.parse(await fs.readFile(path.join(kovRoot, "kov_kontaktid_loplik.json"), "utf8"));
    assert.equal(result.changedContacts, 1);
    assert.equal(central[0].email, "mari.maasikas@example.test");
    assert.match(result.backupFile, /^KOV\/kov_kontaktid_loplik\.bak-/);
  } finally {
    global.fetch = originalFetch;
  }
});
