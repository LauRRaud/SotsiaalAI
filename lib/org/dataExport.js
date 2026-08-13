/** Kasutaja enda organisatsiooniliikmesuse minimaalne andmekoopia projektsioon. */

const iso = (value) => value?.toISOString?.() || value || null;

export async function collectOrganizationMembershipDataExport({ db, userId }) {
  if (!db.organizationMembership?.findMany) {
    return [{ name: "organization-memberships.ndjson", content: Buffer.from(""), count: 0 }];
  }
  const rows = await db.organizationMembership.findMany({
    where: { userId },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      seatRole: true,
      jobTitle: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { id: true, displayName: true, legalKind: true } },
      units: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          isPrimary: true,
          startedAt: true,
          endedAt: true,
          unit: { select: { id: true, name: true, type: true } }
        }
      },
      capabilityGrants: {
        orderBy: { validFrom: "asc" },
        select: {
          id: true,
          capability: true,
          scopeType: true,
          scopeUnitId: true,
          validFrom: true,
          validUntil: true,
          revokedAt: true
        }
      },
      seatAssignments: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          seatPlan: { select: { seatRole: true } }
        }
      }
    }
  });
  const projected = rows.map((row) => ({
    membershipId: row.id,
    organization: row.organization ? {
      id: row.organization.id,
      name: row.organization.displayName,
      legalKind: row.organization.legalKind
    } : null,
    status: row.status,
    seatRole: row.seatRole,
    jobTitle: row.jobTitle || null,
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    units: (row.units || []).map((unit) => ({
      membershipUnitId: unit.id,
      unit: unit.unit ? { id: unit.unit.id, name: unit.unit.name, type: unit.unit.type } : null,
      isPrimary: Boolean(unit.isPrimary),
      startedAt: iso(unit.startedAt),
      endedAt: iso(unit.endedAt)
    })),
    capabilities: (row.capabilityGrants || []).map((grant) => ({
      grantId: grant.id,
      capability: grant.capability,
      scopeType: grant.scopeType,
      scopeUnitId: grant.scopeUnitId || null,
      validFrom: iso(grant.validFrom),
      validUntil: iso(grant.validUntil),
      revokedAt: iso(grant.revokedAt)
    })),
    seats: (row.seatAssignments || []).map((seat) => ({
      assignmentId: seat.id,
      seatRole: seat.seatPlan?.seatRole || null,
      status: seat.status,
      startedAt: iso(seat.startedAt),
      endedAt: iso(seat.endedAt)
    }))
  }));
  const content = Buffer.from(projected.map((row) => JSON.stringify(row)).join("\n") + (projected.length ? "\n" : ""), "utf8");
  return [{
    name: "organization-memberships.ndjson",
    content,
    count: projected.length,
    metadata: { scope: "requester_memberships_only", thirdPartyIdentity: "excluded" }
  }];
}
