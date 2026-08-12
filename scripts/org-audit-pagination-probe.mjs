#!/usr/bin/env node
/**
 * SOL-ORG-13 — auditi cursor ja ekspordi täielikkus päris PostgreSQL-is.
 *
 * Sond loob ainult oma juhusliku prefiksiga sünteetilise organisatsiooni ja
 * auditiread ning koristab need alati. Viis järjestikust rida jagavad
 * ajatemplit, et tõendada `(createdAt,id)` viigimurdjat päris Prisma päringus.
 */

import { randomUUID } from "node:crypto";

import prisma from "../lib/prisma.js";
import { listAllOrgAuditEvents, listOrgAuditEventPage } from "../lib/org/audit.js";
import { buildOrganizationExport } from "../lib/org/export.js";

const runId = randomUUID().replaceAll("-", "");
const prefix = `sol_org13_${runId}`;
const auditIds = Array.from({ length: 205 }, (_, index) =>
  `${prefix}_${String(index + 1).padStart(3, "0")}`
);
let organizationId = null;
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function expectedOrder(rows) {
  return [...rows].sort((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    return byTime || right.id.localeCompare(left.id);
  });
}

try {
  const organization = await prisma.organization.create({
    data: {
      displayName: `SOL-ORG-13 sünteetiline ${runId}`,
      legalKind: "MUNICIPALITY",
      status: "DRAFT"
    }
  });
  organizationId = organization.id;

  const rows = auditIds.map((id, index) => ({
    id,
    createdAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
    actorUserId: null,
    targetUserId: null,
    action: "org.organization_updated",
    resourceType: "ORGANIZATION",
    resourceId: organizationId,
    meta: { organizationId }
  }));
  await prisma.dataAuditLog.createMany({ data: rows });
  expect(
    "loodi täpselt 205 sünteetilist auditirida",
    (await prisma.dataAuditLog.count({ where: { id: { in: auditIds } } })) === 205
  );

  const traversed = [];
  let cursor = null;
  let pageCount = 0;
  do {
    const page = await listOrgAuditEventPage(organizationId, { take: 37, cursor });
    pageCount += 1;
    expect(`leht ${pageCount} kannab serveri koguarvu`, page.total === 205);
    traversed.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  } while (pageCount < 20);

  const ordered = expectedOrder(rows).map((row) => row.id);
  expect("205 rida läbiti kuuel lehel", pageCount === 6 && traversed.length === 205);
  expect("cursor ei dubleerinud ühtki rida", new Set(traversed).size === 205);
  expect("võrdsete ajatemplite järjestus on täielik ja stabiilne", traversed.join("|") === ordered.join("|"));

  const all = await listAllOrgAuditEvents(organizationId, { pageSize: 41 });
  expect("ekspordilugeja läbis kõik 205 rida", all.length === 205);
  expect("ekspordilugeja säilitas esimese ja viimase rea", all[0].id === ordered[0] && all.at(-1).id === ordered.at(-1));

  const payload = await buildOrganizationExport(organizationId, {
    now: new Date("2026-08-12T13:00:00.000Z")
  });
  expect("organisatsiooni eksport sisaldab kõiki 205 auditirida", payload.auditEvents.length === 205);
  expect(
    "manifest kinnitab rea arvu ja täielikkuse",
    payload.manifest.integrity.adminAudit.complete === true &&
      payload.manifest.integrity.adminAudit.rowCount === 205
  );

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await prisma.dataAuditLog.deleteMany({ where: { id: { in: auditIds } } });
  if (organizationId) {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  }
  const remainingAudits = await prisma.dataAuditLog.count({ where: { id: { in: auditIds } } });
  const remainingOrganizations = organizationId
    ? await prisma.organization.count({ where: { id: organizationId } })
    : 0;
  if (remainingAudits || remainingOrganizations) {
    throw new Error(
      `PROBE_CLEANUP_FAIL audit=${remainingAudits} organization=${remainingOrganizations}`
    );
  }
  console.log("CLEANUP_OK audit=0 organization=0");
  await prisma.$disconnect();
}
