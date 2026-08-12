import test from "node:test";
import assert from "node:assert/strict";

import {
  listAllOrgAuditEvents,
  listOrgAuditEventPage
} from "../../lib/org/audit.js";
import { buildOrganizationExport } from "../../lib/org/export.js";

function auditRows(count = 205) {
  return Array.from({ length: count }, (_, index) => ({
    id: `audit_${String(index + 1).padStart(3, "0")}`,
    /* Iga viis järjestikust rida jagavad ajatemplit. Ainult `createdAt` järgi
       paging kaotaks või dubleeriks piiril read. */
    createdAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
    action: "org.organization_updated",
    resourceType: "ORGANIZATION",
    resourceId: "org_1",
    actorUserId: "user_1",
    meta: { organizationId: "org_1" }
  }));
}

function ordered(rows) {
  return [...rows].sort((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    return byTime || right.id.localeCompare(left.id);
  });
}

function cursorFromWhere(where) {
  const clause = where?.AND?.find((entry) => Array.isArray(entry?.OR));
  if (!clause) return null;
  const older = clause.OR.find((entry) => entry?.createdAt?.lt);
  const sameTime = clause.OR.find((entry) => entry?.id?.lt && entry?.createdAt instanceof Date);
  return {
    createdAt: older?.createdAt?.lt || sameTime?.createdAt,
    id: sameTime?.id?.lt
  };
}

function auditDb(rows) {
  const sorted = ordered(rows);
  return {
    dataAuditLog: {
      count: async () => sorted.length,
      findMany: async ({ where, take }) => {
        const cursor = cursorFromWhere(where);
        const afterCursor = cursor
          ? sorted.filter(
              (row) =>
                row.createdAt < cursor.createdAt ||
                (row.createdAt.getTime() === cursor.createdAt.getTime() && row.id < cursor.id)
            )
          : sorted;
        return afterCursor.slice(0, take);
      }
    }
  };
}

function exportDb(rows) {
  const db = auditDb(rows);
  const emptyFindMany = { findMany: async () => [] };
  return {
    ...db,
    organization: {
      findUnique: async () => ({
        id: "org_1",
        displayName: "Test",
        legalName: null,
        registryCode: null,
        legalKind: "MUNICIPALITY",
        municipalityId: null,
        status: "DRAFT",
        defaultLocale: "et",
        timezone: "Europe/Tallinn",
        verifiedAt: null,
        activatedAt: null,
        suspendedAt: null,
        archivedAt: null,
        createdAt: new Date("2026-08-12T00:00:00.000Z")
      })
    },
    organizationModule: emptyFindMany,
    organizationUnit: emptyFindMany,
    organizationMembership: emptyFindMany,
    organizationInvite: emptyFindMany,
    organizationSeatPlan: emptyFindMany,
    organizationSupportContact: emptyFindMany,
    organizationInboxItem: emptyFindMany,
    wellbeingSupportShare: { groupBy: async () => [] }
  };
}

test("SOL-ORG-13: (createdAt,id) cursor traverses 205 equal-time audit events without gaps", async () => {
  const rows = auditRows();
  const db = auditDb(rows);
  const seen = [];
  let cursor = null;
  let pageCount = 0;

  do {
    const page = await listOrgAuditEventPage("org_1", { db, take: 37, cursor });
    pageCount += 1;
    seen.push(...page.items.map((row) => row.id));
    assert.equal(page.total, 205);
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  } while (pageCount < 20);

  assert.equal(pageCount, 6);
  assert.equal(seen.length, 205);
  assert.equal(new Set(seen).size, 205);
  assert.deepEqual(seen, ordered(rows).map((row) => row.id));
});

test("SOL-ORG-13: export includes the first and last audit event and declares completeness", async () => {
  const rows = auditRows();
  const expected = ordered(rows);
  const db = exportDb(rows);

  const all = await listAllOrgAuditEvents("org_1", { db, pageSize: 41 });
  assert.equal(all.length, 205);

  const payload = await buildOrganizationExport("org_1", {
    db,
    now: new Date("2026-08-12T13:00:00.000Z")
  });

  assert.equal(payload.auditEvents.length, 205);
  assert.equal(payload.auditEvents[0].id, expected[0].id);
  assert.equal(payload.auditEvents.at(-1).id, expected.at(-1).id);
  assert.deepEqual(payload.manifest.integrity.adminAudit, {
    complete: true,
    rowCount: 205
  });
});

test("SOL-ORG-13: malformed cursor is rejected instead of silently restarting from page one", async () => {
  await assert.rejects(
    () => listOrgAuditEventPage("org_1", { db: auditDb(auditRows()), cursor: "not-a-cursor" }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.messageKey, "org.errors.invalid_cursor");
      return true;
    }
  );
});

test("SOL-ORG-13: export fails closed when the declared total cannot be traversed", async () => {
  const db = auditDb(auditRows(204));
  db.dataAuditLog.count = async () => 205;

  await assert.rejects(
    () => listAllOrgAuditEvents("org_1", { db, pageSize: 41 }),
    (error) => {
      assert.equal(error.code, "ORG_EXPORT_INCOMPLETE");
      assert.equal(error.status, 500);
      return true;
    }
  );
});
