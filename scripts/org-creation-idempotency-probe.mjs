#!/usr/bin/env node
/** SOL-ORG-17 — loomise idempotentsus ja paralleelne unikaalsus PostgreSQL-is. */

import { randomUUID } from "node:crypto";

import prisma from "../lib/prisma.js";
import { createOrganization } from "../lib/org/organizations.js";

const runId = randomUUID().replaceAll("-", "");
const prefix = `sol_org17_${runId}`;
const clientActionId = `${prefix}_action`;
let userId = null;
let organizationIds = [];
let auditIds = [];
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

const input = () => ({
  userId,
  productRole: "SOCIAL_WORKER",
  displayName: `SOL-ORG-17 ${runId}`,
  legalKind: "MUNICIPALITY",
  legalName: null,
  registryCode: null,
  municipalityId: null,
  clientActionId
});

try {
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test` } });
  userId = user.id;

  const attempts = await Promise.all([
    createOrganization(input()),
    createOrganization(input()),
    createOrganization(input()),
    createOrganization(input())
  ]);
  const ids = attempts.map((result) => result.organization.id);
  expect("neli sama võtmega päringut tagastavad sama organisatsiooni", new Set(ids).size === 1);
  organizationIds = [...new Set(ids)];

  const [organizations, memberships, grants, audits] = await Promise.all([
    prisma.organization.findMany({ where: { createdByUserId: userId, creationClientActionId: clientActionId } }),
    prisma.organizationMembership.findMany({ where: { organizationId: { in: organizationIds }, userId } }),
    prisma.organizationCapabilityGrant.findMany({
      where: { membership: { organizationId: { in: organizationIds }, userId } }
    }),
    prisma.dataAuditLog.findMany({
      where: { action: "org.organization_created", resourceId: { in: organizationIds } }
    })
  ]);
  auditIds = audits.map((row) => row.id);
  expect("andmebaasis on üks organisatsioon", organizations.length === 1);
  expect("andmebaasis on üks asutajaliikmesus", memberships.length === 1);
  expect("asutajagrante on üks komplekt", grants.length === 3);
  expect("loomisauditit on üks", audits.length === 1);

  const conflict = await Promise.allSettled([
    createOrganization({ ...input(), displayName: `MUU ${runId}` })
  ]);
  expect(
    "sama võti erineva sisuga annab 409",
    conflict[0].status === "rejected" && conflict[0].reason?.status === 409
  );
  expect(
    "konflikt ei loonud teist organisatsiooni",
    (await prisma.organization.count({ where: { createdByUserId: userId } })) === 1
  );
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  if (userId) {
    const rows = await prisma.organization.findMany({
      where: { createdByUserId: userId, creationClientActionId: clientActionId },
      select: { id: true }
    });
    organizationIds = rows.map((row) => row.id);
  }
  if (organizationIds.length) {
    const rows = await prisma.dataAuditLog.findMany({
      where: { action: "org.organization_created", resourceId: { in: organizationIds } },
      select: { id: true }
    });
    auditIds = rows.map((row) => row.id);
    if (auditIds.length) await prisma.dataAuditLog.deleteMany({ where: { id: { in: auditIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  }
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  const [organizations, audits, users] = await Promise.all([
    userId ? prisma.organization.count({ where: { createdByUserId: userId } }) : 0,
    auditIds.length ? prisma.dataAuditLog.count({ where: { id: { in: auditIds } } }) : 0,
    userId ? prisma.user.count({ where: { id: userId } }) : 0
  ]);
  if (organizations || audits || users) {
    throw new Error(`PROBE_CLEANUP_FAIL org=${organizations} audits=${audits} user=${users}`);
  }
  console.log("CLEANUP_OK org=0 audits=0 user=0");
  await prisma.$disconnect();
}
