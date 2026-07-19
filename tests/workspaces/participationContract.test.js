import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  assertParticipantDescriptor,
  ParticipantDescriptorValidationError,
  ParticipantRole,
  MembershipStatus,
  InviteState,
  InviteRelationship
} from "../../lib/workspaces/participation.js";
import {
  assertSharingDescriptor,
  SharingDescriptorValidationError,
  SharingObjectClass,
  SHARING_CLASS_CONTRACTS,
  SHARING_OBJECT_CLASSES,
  SharingValidityKind,
  RevocableBeforeOpen,
  RevocableAfterOpen,
  mapSentPreInquiryToSharingDescriptor
} from "../../lib/workspaces/sharing.js";
import {
  listParticipants as listRoomParticipants,
  listMyMemberships as listMyRoomMemberships,
  ROOM_ROLE_TO_CONTRACT,
  ROOM_INVITE_STATUS_TO_CONTRACT,
  ROOM_RELATIONSHIP_TO_CONTRACT
} from "../../lib/workspaces/adapters/roomParticipationAdapter.js";
import {
  listParticipants as listCovisionParticipants,
  listMyMemberships as listMyCovisionMemberships,
  COVISION_ROLE_TO_CONTRACT,
  COVISION_INVITE_STATUS_TO_CONTRACT,
  COVISION_MEMBERSHIP_FROM_INVITE
} from "../../lib/workspaces/adapters/covisionParticipationAdapter.js";

const OWNER = "user_owner";
const MEMBER = "user_member";
const LEFT_MEMBER = "user_left";
const OUTSIDER = "user_outsider";

const SCHEMA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "prisma",
  "schema.prisma"
);

function schemaEnumValues(schemaText, enumName) {
  const match = schemaText.match(new RegExp(`enum ${enumName} \\{([^}]*)\\}`, "u"));
  assert.ok(match, `enum ${enumName} peab skeemis olemas olema`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
}

function validParticipant(overrides = {}) {
  return {
    workspaceRef: { kind: "room", id: "room_1" },
    userId: MEMBER,
    role: ParticipantRole.MEMBER,
    invite: null,
    membership: { status: MembershipStatus.ACTIVE, since: "2026-07-19T09:00:00.000Z", leftAt: null },
    scope: { note: null },
    ...overrides
  };
}

test("participation: kehtiv descriptor läbib validaatori", () => {
  assert.doesNotThrow(() => assertParticipantDescriptor(validParticipant()));
});

test("participation: tundmatu roll lükatakse tagasi", () => {
  assert.throws(
    () => assertParticipantDescriptor(validParticipant({ role: "SUPERUSER" })),
    ParticipantDescriptorValidationError
  );
});

test("participation: tundmatu liikmesuse olek lükatakse tagasi", () => {
  assert.throws(
    () =>
      assertParticipantDescriptor(
        validParticipant({
          membership: { status: "BANNED", since: null, leftAt: null }
        })
      ),
    ParticipantDescriptorValidationError
  );
});

test("participation: moodulipõhine lisaväli on lepinguviga", () => {
  assert.throws(
    () => assertParticipantDescriptor({ ...validParticipant(), moduleField: true }),
    ParticipantDescriptorValidationError
  );
});

test("participation: scope.note peab V1-s olema null", () => {
  assert.throws(
    () => assertParticipantDescriptor(validParticipant({ scope: { note: "piirang" } })),
    ParticipantDescriptorValidationError
  );
});

test("participation: userId ei tohi olla null ilma kutseta", () => {
  assert.throws(
    () => assertParticipantDescriptor(validParticipant({ userId: null })),
    ParticipantDescriptorValidationError
  );
  assert.doesNotThrow(() =>
    assertParticipantDescriptor(
      validParticipant({
        userId: null,
        role: ParticipantRole.MEMBER,
        invite: {
          status: InviteState.PENDING,
          expiresAt: "2026-08-01T00:00:00.000Z",
          relationship: InviteRelationship.CLIENT
        },
        membership: { status: MembershipStatus.INVITED, since: null, leftAt: null }
      })
    )
  );
});

test("participation: sõnastiku täielikkus — iga DB-enum kaardistub", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  for (const value of schemaEnumValues(schema, "RoomRole")) {
    assert.ok(ROOM_ROLE_TO_CONTRACT[value], `RoomRole.${value} peab kaardistuma`);
  }
  for (const value of schemaEnumValues(schema, "InviteStatus")) {
    assert.ok(ROOM_INVITE_STATUS_TO_CONTRACT[value], `InviteStatus.${value} peab kaardistuma`);
  }
  for (const value of schemaEnumValues(schema, "RelationshipType")) {
    assert.ok(ROOM_RELATIONSHIP_TO_CONTRACT[value], `RelationshipType.${value} peab kaardistuma`);
  }
  for (const value of schemaEnumValues(schema, "CovisionParticipantRole")) {
    assert.ok(COVISION_ROLE_TO_CONTRACT[value], `CovisionParticipantRole.${value} peab kaardistuma`);
  }
  for (const value of schemaEnumValues(schema, "CovisionInviteStatus")) {
    assert.ok(
      COVISION_INVITE_STATUS_TO_CONTRACT[value],
      `CovisionInviteStatus.${value} peab kaardistuma`
    );
    assert.ok(
      COVISION_MEMBERSHIP_FROM_INVITE[value],
      `CovisionInviteStatus.${value} peab kaardistuma liikmesuseks`
    );
  }
});

function fakeRoomDb() {
  const members = [
    { roomId: "room_1", userId: OWNER, role: "OWNER", joinedAt: new Date("2026-07-01T08:00:00.000Z"), leftAt: null },
    { roomId: "room_1", userId: MEMBER, role: "MEMBER", joinedAt: new Date("2026-07-02T08:00:00.000Z"), leftAt: null },
    {
      roomId: "room_1",
      userId: LEFT_MEMBER,
      role: "MEMBER",
      joinedAt: new Date("2026-07-03T08:00:00.000Z"),
      leftAt: new Date("2026-07-10T08:00:00.000Z")
    }
  ];
  const invites = [
    {
      roomId: "room_1",
      status: "SENT",
      relationshipType: "CLIENT",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-04T08:00:00.000Z")
    },
    {
      roomId: "room_1",
      status: "REVOKED",
      relationshipType: "COLLEAGUE",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-05T08:00:00.000Z")
    }
  ];
  return {
    roomMember: {
      findFirst: async ({ where }) =>
        members.find(
          (m) =>
            m.roomId === where.roomId &&
            m.userId === where.userId &&
            (where.leftAt === null ? m.leftAt === null : true)
        ) || null,
      findMany: async ({ where }) =>
        members.filter((m) => {
          if (where.roomId && m.roomId !== where.roomId) return false;
          if (where.userId && m.userId !== where.userId) return false;
          return true;
        })
    },
    invite: {
      findMany: async ({ where }) =>
        invites.filter(
          (i) => i.roomId === where.roomId && (where.status?.in || [i.status]).includes(i.status)
        )
    }
  };
}

test("room adapter: liige näeb liikmeid, lahkunuid ja ootel kutseid", async () => {
  const db = fakeRoomDb();
  const rows = await listRoomParticipants(MEMBER, "room_1", { db });
  assert.equal(rows.length, 4);
  for (const row of rows) assert.doesNotThrow(() => assertParticipantDescriptor(row));

  const owner = rows.find((r) => r.userId === OWNER);
  assert.equal(owner.role, ParticipantRole.OWNER);
  assert.equal(owner.membership.status, MembershipStatus.ACTIVE);

  const left = rows.find((r) => r.userId === LEFT_MEMBER);
  assert.equal(left.membership.status, MembershipStatus.LEFT);
  assert.ok(left.membership.leftAt);

  const invited = rows.find((r) => r.userId === null);
  assert.equal(invited.membership.status, MembershipStatus.INVITED);
  assert.equal(invited.invite.status, InviteState.PENDING);
  assert.equal(invited.invite.relationship, InviteRelationship.CLIENT);
});

test("room adapter: REVOKED kutse ei ole osaleja", async () => {
  const db = fakeRoomDb();
  const rows = await listRoomParticipants(OWNER, "room_1", { db });
  const pendingInvites = rows.filter((r) => r.userId === null);
  assert.equal(pendingInvites.length, 1);
});

test("room adapter: võõras kasutaja saab tühja loendi", async () => {
  const db = fakeRoomDb();
  assert.deepEqual(await listRoomParticipants(OUTSIDER, "room_1", { db }), []);
});

test("room adapter: lahkunud liige ei näe enam osalejaid", async () => {
  const db = fakeRoomDb();
  assert.deepEqual(await listRoomParticipants(LEFT_MEMBER, "room_1", { db }), []);
});

test("room adapter: listMyMemberships on alati küsija enda oma", async () => {
  const db = fakeRoomDb();
  const mine = await listMyRoomMemberships(LEFT_MEMBER, { db });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].membership.status, MembershipStatus.LEFT);
  assert.deepEqual(await listMyRoomMemberships("", { db }), []);
});

function fakeCovisionDb() {
  const cases = [{ id: "case_1", ownerId: OWNER }];
  const participants = [
    { covisionCaseId: "case_1", userId: OWNER, role: "OWNER", inviteStatus: "ACCEPTED", createdAt: new Date("2026-07-01T08:00:00.000Z") },
    { covisionCaseId: "case_1", userId: MEMBER, role: "PARTICIPANT", inviteStatus: "ACCEPTED", createdAt: new Date("2026-07-02T08:00:00.000Z") },
    { covisionCaseId: "case_1", userId: "user_declined", role: "PARTICIPANT", inviteStatus: "DECLINED", createdAt: new Date("2026-07-03T08:00:00.000Z") },
    { covisionCaseId: "case_1", userId: null, email: "kutsutu@example.org", role: "SUMMARY_REVIEWER", inviteStatus: "INVITED", createdAt: new Date("2026-07-04T08:00:00.000Z") }
  ];
  return {
    covisionCase: {
      findFirst: async ({ where }) =>
        cases.find((c) => c.id === where.id && c.ownerId === where.ownerId) || null
    },
    covisionParticipant: {
      findFirst: async ({ where }) =>
        participants.find(
          (p) =>
            p.covisionCaseId === where.covisionCaseId &&
            p.userId === where.userId &&
            (!where.inviteStatus || p.inviteStatus === where.inviteStatus)
        ) || null,
      findMany: async ({ where }) =>
        participants.filter((p) => {
          if (where.covisionCaseId && p.covisionCaseId !== where.covisionCaseId) return false;
          if (where.userId && p.userId !== where.userId) return false;
          return true;
        })
    }
  };
}

test("covision adapter: omanik näeb kõiki osalejaid ühissõnastikus", async () => {
  const db = fakeCovisionDb();
  const rows = await listCovisionParticipants(OWNER, "case_1", { db });
  assert.equal(rows.length, 4);
  for (const row of rows) assert.doesNotThrow(() => assertParticipantDescriptor(row));

  const declined = rows.find((r) => r.userId === "user_declined");
  assert.equal(declined.invite.status, InviteState.DECLINED);
  assert.equal(declined.membership.status, MembershipStatus.INVITED);

  const reviewer = rows.find((r) => r.userId === null);
  assert.equal(reviewer.role, ParticipantRole.REVIEWER);
  assert.equal(reviewer.invite.status, InviteState.PENDING);
});

test("covision adapter: võõras kasutaja saab tühja loendi", async () => {
  const db = fakeCovisionDb();
  assert.deepEqual(await listCovisionParticipants(OUTSIDER, "case_1", { db }), []);
});

test("covision adapter: keeldunud osaleja ei näe teisi osalejaid", async () => {
  const db = fakeCovisionDb();
  assert.deepEqual(await listCovisionParticipants("user_declined", "case_1", { db }), []);
});

test("covision adapter: listMyMemberships tagastab enda osalused", async () => {
  const db = fakeCovisionDb();
  const mine = await listMyCovisionMemberships(MEMBER, { db });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].membership.status, MembershipStatus.ACTIVE);
  assert.equal(mine[0].workspaceRef.kind, "covision_case");
});

function validSharing(overrides = {}) {
  return {
    objectClass: SharingObjectClass.CONFIRMED_SUMMARY,
    frozen: true,
    purpose: "kohtumise kandja",
    validity: { kind: SharingValidityKind.PERMANENT, until: null },
    revocable: {
      beforeOpen: RevocableBeforeOpen.RECALL,
      afterOpen: RevocableAfterOpen.SUPERSEDE
    },
    ...overrides
  };
}

test("sharing: kehtiv descriptor läbib validaatori", () => {
  assert.doesNotThrow(() => assertSharingDescriptor(validSharing()));
});

test("sharing: klassid 1-2 ei ole kunagi otse jagatavad", () => {
  for (const objectClass of [SharingObjectClass.PERSONAL_NOTE, SharingObjectClass.SPECIALIST_PRIVATE_NOTE]) {
    assert.throws(
      () => assertSharingDescriptor(validSharing({ objectClass })),
      SharingDescriptorValidationError
    );
  }
});

test("sharing: UNTIL_DATE nõuab tähtaega", () => {
  assert.throws(
    () =>
      assertSharingDescriptor(
        validSharing({ validity: { kind: SharingValidityKind.UNTIL_DATE, until: null } })
      ),
    SharingDescriptorValidationError
  );
});

test("sharing: tundmatu tagasivõtuväärtus lükatakse tagasi", () => {
  assert.throws(
    () =>
      assertSharingDescriptor(
        validSharing({ revocable: { beforeOpen: "DELETE_EVERYWHERE", afterOpen: "NONE" } })
      ),
    SharingDescriptorValidationError
  );
});

test("sharing: iga klass 1-10 kannab lepingut", () => {
  assert.equal(SHARING_OBJECT_CLASSES.length, 10);
  for (const objectClass of SHARING_OBJECT_CLASSES) {
    const contract = SHARING_CLASS_CONTRACTS[objectClass];
    assert.ok(contract, `klass ${objectClass} peab kandma lepingut`);
    assert.equal(typeof contract.shareable, "boolean");
  }
});

test("sharing: U12 saadetud eelpöördumise kuju on kaardistatav ilma mySharings.js muutmata", () => {
  /* lib/mySharings.js serializeSentPreInquiry väljundi kuju (U12 leping). */
  const u12Row = {
    id: "pi_1",
    topic: "Eluaseme tugi",
    situation: "…",
    sharedText: "külmutatud väljavõte",
    recipientLabel: "KOV vastuvõtja",
    deliveryChannel: "INTERNAL",
    status: "SENT",
    sentAt: "2026-07-19T10:00:00.000Z",
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    supersedesId: null,
    updatedAt: "2026-07-19T10:00:00.000Z",
    canRecall: true,
    canCorrect: false
  };
  const descriptor = mapSentPreInquiryToSharingDescriptor(u12Row);
  assert.equal(descriptor.objectClass, SharingObjectClass.PERSON_OWN_INPUT);
  assert.equal(descriptor.frozen, true);
  assert.equal(descriptor.purpose, "Eluaseme tugi");
  assert.equal(descriptor.revocable.beforeOpen, RevocableBeforeOpen.RECALL);
  assert.equal(descriptor.revocable.afterOpen, RevocableAfterOpen.CORRECTION);
});
