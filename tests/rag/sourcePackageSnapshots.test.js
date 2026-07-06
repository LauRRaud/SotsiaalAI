import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSourcePackageSnapshot,
  normalizeSourcePackageSnapshotCanonicalId,
  persistSourcePackageSnapshots
} from "../../lib/rag/sourcePackageSnapshots.js";

function packageFixture(overrides = {}) {
  return {
    package_id: "jogeva_vald_service_koduteenus_package",
    canonical_item_id: "jogeva_vald_service_koduteenus",
    package_type: "kov_service",
    title: "Koduteenus",
    municipality_id: "jogeva_vald",
    confidence: "high",
    missing_sections: [],
    last_checked: "2026-04-28",
    sections: {
      description: [
        {
          source_id: "service-info",
          title: "Koduteenus",
          source_type: "kov_service_info",
          collection_id: "kov_services",
          municipality_id: "jogeva_vald",
          source_status: "active",
          evidenceText: "This long source excerpt must not be persisted."
        }
      ],
      forms: [
        {
          source_id: "service-form",
          source_type: "application_form",
          municipality_id: "jogeva_vald",
          source_status: "active"
        }
      ],
      contacts: [
        {
          source_id: "service-contact",
          source_type: "official_contact",
          municipality_id: "jogeva_vald",
          source_status: "active"
        }
      ],
      legal_basis: [
        {
          source_id: "kov-regulation",
          source_type: "kov_regulation",
          municipality_id: "jogeva_vald",
          source_status: "active"
        }
      ]
    },
    ...overrides
  };
}

function createFakeClient() {
  const rows = [];
  let idCounter = 1;

  function matchesWhere(row, where = {}) {
    return Object.entries(where).every(([key, value]) => row[key] === value);
  }

  const delegate = {
    rows,
    async findFirst({ where = {}, orderBy = {} } = {}) {
      const found = rows
        .filter(row => matchesWhere(row, where))
        .sort((left, right) => {
          if (orderBy.version === "desc") return Number(right.version) - Number(left.version);
          return 0;
        });
      return found[0] || null;
    },
    async findMany({ where = {}, orderBy = {} } = {}) {
      const found = rows
        .filter(row => matchesWhere(row, where))
        .sort((left, right) => {
          if (orderBy.version === "desc") return Number(right.version) - Number(left.version);
          return 0;
        });
      return found;
    },
    async updateMany({ where = {}, data = {} } = {}) {
      let count = 0;
      for (const row of rows) {
        if (!matchesWhere(row, where)) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
    async create({ data = {} } = {}) {
      const row = {
        id: `snapshot-${idCounter++}`,
        ...data
      };
      rows.push(row);
      return row;
    },
    async update({ where = {}, data = {} } = {}) {
      const row = rows.find(item => matchesWhere(item, where));
      if (!row) throw new Error("row not found");
      Object.assign(row, data);
      return row;
    }
  };

  return {
    sourcePackageSnapshot: delegate,
    rows
  };
}

test("buildSourcePackageSnapshot persists only safe package metadata", () => {
  const snapshot = buildSourcePackageSnapshot(packageFixture());
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.packageId, "jogeva_vald_service_koduteenus_package");
  assert.equal(snapshot.canonicalItemId, "jogeva_vald_service_koduteenus");
  assert.equal(snapshot.status, "active");
  assert.equal(snapshot.sectionSummary.description.count, 1);
  assert.deepEqual(snapshot.sectionSummary.description.source_ids, ["service-info"]);
  assert.equal(snapshot.sourceMembership.some(source => source.source_id === "service-info"), true);
  assert.equal(serialized.includes("This long source excerpt"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("userMessage"), false);
});

test("buildSourcePackageSnapshot includes partial KOV regulation legal basis membership", () => {
  const snapshot = buildSourcePackageSnapshot(packageFixture({
    sections: {
      ...packageFixture().sections,
      legal_basis: [
        {
          source_id: "jogeva-vald-rt-406112024020",
          title: "Sotsiaalhoolekandelise abi andmise kord Jõgeva vallas",
          source_type: "kov_regulation",
          collection_id: "kov_regulations",
          municipality_id: "jogeva_vald",
          evidence_strength: "partial"
        }
      ]
    }
  }));

  assert.deepEqual(snapshot.sectionSummary.legal_basis.source_ids, ["jogeva-vald-rt-406112024020"]);
  const membership = snapshot.sourceMembership.find(source => source.source_id === "jogeva-vald-rt-406112024020");
  assert.ok(membership);
  assert.equal(membership.source_type, "kov_regulation");
  assert.equal(membership.evidence_strength, "partial");
  assert.equal(membership.evidence_allowed, true);
});

test("buildSourcePackageSnapshot hash changes when forms and contacts membership is added", () => {
  const withoutFormsContacts = buildSourcePackageSnapshot(packageFixture({
    missing_sections: ["forms", "contacts"],
    sections: {
      ...packageFixture().sections,
      forms: [],
      contacts: []
    }
  }));
  const withFormsContacts = buildSourcePackageSnapshot(packageFixture());

  assert.notEqual(withoutFormsContacts.packageHash, withFormsContacts.packageHash);
  assert.equal(withFormsContacts.sectionSummary.forms.count, 1);
  assert.equal(withFormsContacts.sectionSummary.contacts.count, 1);
});

test("normalizeSourcePackageSnapshotCanonicalId collapses generic duplicate KOV prefix", () => {
  assert.equal(
    normalizeSourcePackageSnapshotCanonicalId("jogeva_vald_service_jogeva_vald_service_koduteenus"),
    "jogeva_vald_service_koduteenus"
  );
  assert.equal(
    normalizeSourcePackageSnapshotCanonicalId("alutaguse_vald_service_alutaguse_vald_service_koduteenus"),
    "alutaguse_vald_service_koduteenus"
  );
});


test("persistSourcePackageSnapshots does not duplicate same package hash", async () => {
  const client = createFakeClient();
  const first = await persistSourcePackageSnapshots([packageFixture()], client);
  const second = await persistSourcePackageSnapshots([packageFixture()], client);

  assert.equal(first[0].created, true);
  assert.equal(second[0].created, false);
  assert.equal(second[0].unchanged, true);
  assert.equal(client.rows.length, 1);
  assert.equal(client.rows[0].version, 1);
  assert.equal(client.rows[0].active, true);
});

test("persistSourcePackageSnapshots creates a new version and archives old active snapshot on hash change", async () => {
  const client = createFakeClient();
  await persistSourcePackageSnapshots([packageFixture()], client);
  await persistSourcePackageSnapshots([
    packageFixture({
      sections: {
        ...packageFixture().sections,
        forms: [
          {
            source_id: "service-form-v2",
            source_type: "application_form",
            municipality_id: "jogeva_vald",
            source_status: "active"
          }
        ]
      }
    })
  ], client);

  assert.equal(client.rows.length, 2);
  assert.equal(client.rows[0].active, false);
  assert.equal(client.rows[0].status, "archived");
  assert.equal(client.rows[1].active, true);
  assert.equal(client.rows[1].version, 2);
});

test("persistSourcePackageSnapshots reactivates an archived hash as the next version", async () => {
  const client = createFakeClient();
  const original = packageFixture();
  const changed = packageFixture({
    sections: {
      ...packageFixture().sections,
      contacts: [
        {
          source_id: "service-contact-v2",
          source_type: "official_contact",
          municipality_id: "jogeva_vald",
          source_status: "active"
        }
      ]
    }
  });

  await persistSourcePackageSnapshots([original], client);
  await persistSourcePackageSnapshots([changed], client);
  const reactivated = await persistSourcePackageSnapshots([original], client);

  assert.equal(client.rows.length, 2);
  assert.equal(reactivated[0].reactivated, true);
  assert.equal(reactivated[0].snapshot.version, 3);
  assert.equal(client.rows.filter(row => row.active === true).length, 1);
  assert.equal(client.rows.find(row => row.active === true).packageHash, reactivated[0].snapshot.packageHash);
});

test("persistSourcePackageSnapshots archives duplicate normalized active snapshots and prefers normalized package id", async () => {
  const client = createFakeClient();
  await persistSourcePackageSnapshots([
    packageFixture({
      package_id: "jogeva_vald_service_koduteenus_package",
      canonical_item_id: "jogeva_vald_service_koduteenus"
    })
  ], client);

  const persisted = await persistSourcePackageSnapshots([
    packageFixture({
      package_id: "jogeva_vald_service_jogeva_vald_service_koduteenus_package",
      canonical_item_id: "jogeva_vald_service_jogeva_vald_service_koduteenus"
    })
  ], client);

  const activeRows = client.rows.filter(row => row.active === true);
  assert.equal(activeRows.length, 1);
  assert.equal(activeRows[0].packageId, "jogeva_vald_service_koduteenus_package");
  assert.equal(client.rows.find(row => row.packageId === "jogeva_vald_service_jogeva_vald_service_koduteenus_package").status, "archived");
  assert.equal(persisted[0].dedupe.archivedCount, 1);
});

test("buildSourcePackageSnapshot marks missing, conflicting, and invalid current evidence packages as needs_review", () => {
  const missing = buildSourcePackageSnapshot(packageFixture({ missing_sections: ["forms"] }));
  assert.equal(missing.status, "needs_review");

  const conflict = buildSourcePackageSnapshot(packageFixture(), [
    packageFixture(),
    packageFixture({ municipality_id: "tartu_linn" })
  ]);
  assert.equal(conflict.status, "needs_review");

  const invalid = buildSourcePackageSnapshot(packageFixture({
    sections: {
      ...packageFixture().sections,
      legal_basis: [
        {
          source_id: "journal-background",
          source_type: "journal_article",
          source_status: "active"
        }
      ]
    }
  }));
  assert.equal(invalid.status, "needs_review");
  assert.equal(invalid.sourceMembership.find(source => source.source_id === "journal-background").evidence_allowed, false);
});
