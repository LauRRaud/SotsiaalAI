import test from "node:test";
import assert from "node:assert/strict";

import { listWorkspaces, toCaseWorkWorkspaceDescriptor } from "../../lib/workspaces/adapters/caseWorkAdapter.js";
import { WorkspaceLifecycle, WorkspaceVisibility } from "../../lib/workspaces/descriptor.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";

function withFeature(value, fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    if (value === null) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
    else process.env[CASEWORK_FLAG_KEYS.ENABLED] = value;
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

function db(rows = [], users = []) {
  return {
    caseWorkAssist: {
      async findMany({ where }) {
        return rows.filter((row) => row.ownerUserId === where.ownerUserId);
      }
    },
    user: {
      async findMany({ where }) {
        return users.filter((row) => where.id.in.includes(row.id));
      }
    }
  };
}

const BASE_ROW = {
  id: "case_1",
  ownerUserId: "w1",
  clientUserId: null,
  clientDisplayName: "perearst R",
  clientExternalRef: null,
  clientErasedAt: null,
  retentionState: "ACTIVE",
  updatedAt: new Date("2026-08-06T10:00:00.000Z"),
  /* SIHILIKULT KAASAS: adapter EI TOHI seda deskriptorisse tõsta. Kui ta seda
     teeks, oleks järgmise kontakti kuupäev inimese kohta tööruumiloendis. */
  nextContactAt: new Date("2026-08-20T09:00:00.000Z")
};

test("deskriptor on kehtiv, PRIVATE ja kannab juhtumi kuvanime", () => {
  const descriptor = toCaseWorkWorkspaceDescriptor(BASE_ROW);
  assert.equal(descriptor.ref.kind, "case_work");
  assert.equal(descriptor.ref.id, "case_1");
  assert.equal(descriptor.title, "perearst R");
  assert.equal(descriptor.visibility, WorkspaceVisibility.PRIVATE);
  assert.equal(descriptor.ownerId, "w1");
  assert.equal(descriptor.responsibleId, "w1");
  assert.deepEqual(descriptor.participants, { active: 1, invited: 0 });
});

test("deskriptor EI KANNA `nextContactAt`-i ega ühtegi muud sisuvälja", () => {
  const descriptor = toCaseWorkWorkspaceDescriptor(BASE_ROW);
  const serialized = JSON.stringify(descriptor);
  assert.equal(serialized.includes("2026-08-20"), false, "järgmine kontakt ei tohi deskriptorisse jõuda");
  assert.equal(descriptor.nextAction, null);
  assert.equal(descriptor.goal, null);
  assert.equal(descriptor.phase, null);
  assert.equal(descriptor.progress, null);
});

test("kustutatud kliendiviide annab pealkirjaks TÕLKEVÕTME, mitte vana nime", () => {
  const descriptor = toCaseWorkWorkspaceDescriptor(
    { ...BASE_ROW, clientErasedAt: new Date(), clientDisplayName: null },
    "Mari Tamm"
  );
  assert.equal(descriptor.title, "casework.label.erased_client");
});

test("nimetu juhtum kannab tõlkevõtit, mitte andmebaasi teksti", () => {
  const descriptor = toCaseWorkWorkspaceDescriptor({ ...BASE_ROW, clientDisplayName: null });
  assert.equal(descriptor.title, "casework.label.untitled");
});

test("retention kaardistub elutsükliks: READ_ONLY on CLOSED, mitte PAUSED", () => {
  assert.equal(toCaseWorkWorkspaceDescriptor(BASE_ROW).lifecycle, WorkspaceLifecycle.ACTIVE);
  assert.equal(
    toCaseWorkWorkspaceDescriptor({ ...BASE_ROW, retentionState: "READ_ONLY" }).lifecycle,
    WorkspaceLifecycle.CLOSED
  );
  assert.equal(
    toCaseWorkWorkspaceDescriptor({ ...BASE_ROW, retentionState: "ARCHIVED" }).lifecycle,
    WorkspaceLifecycle.ARCHIVED
  );
});

test(
  "adapter on omaniku-skoobitud: võõras saab tühja loendi",
  withFeature("1", async () => {
    const database = db([BASE_ROW]);
    assert.equal((await listWorkspaces("w1", { db: database })).length, 1);
    assert.equal((await listWorkspaces("keegi-teine", { db: database })).length, 0);
    assert.equal((await listWorkspaces("", { db: database })).length, 0);
  })
);

test(
  "väravaga väljas ei ole seda tööruumiliiki olemas — tühi loend, mitte viga",
  withFeature(null, async () => {
    /* Tööruumiloend koondab paljusid liike; üks väljalülitatud liik ei tohi
       kogu loendit kukutada. */
    assert.deepEqual(await listWorkspaces("w1", { db: db([BASE_ROW]) }), []);
  })
);

test(
  "rada A pealkiri lahendatakse sama funktsiooniga mis liideses",
  withFeature("1", async () => {
    const row = { ...BASE_ROW, clientUserId: "u1", clientDisplayName: null };
    const database = db([row], [{ id: "u1", profile: { firstName: "Mari", lastName: "Tamm" } }]);
    const [descriptor] = await listWorkspaces("w1", { db: database });
    assert.equal(descriptor.title, "Mari Tamm");
  })
);
