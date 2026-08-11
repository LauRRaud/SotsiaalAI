import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureOwnerMembership,
  requireInviteRoomRole,
  resolveInviteRoom
} from "../../lib/invites/roomAccess.js";

/* SOL-INV-02 — KEELATUD PÄRING PEAB OLEMA KÕRVALMÕJUTA.

   Vana `ensureRoom()` kutsus olemasoleva ruumi harus `ensureOwnerMembership`-i
   ENNE küsija rolli kontrolli ja andis sinna kaasa KÜSIJA payload'ist tulnud
   `host_display_name`-i. Ruumi ID-d teadev mitteliige sai seega keelatud POST-iga
   (vastus 403) muuta omaniku kuvatavat nime ja taasaktiveerida teadlikult
   lõpetatud omaniku-liikmesuse.

   Testid mõõdavad seda, mida päring ENDAST maha jättis: iga kirjutus läheb
   `writes` massiivi ja keelatud päringu järel peab ta olema TÜHI. */

const OWNER = "owner_1";
const ROOM = { id: "room_1", ownerId: OWNER, title: "Ruum", archivedAt: null };

function makeDb({ room = ROOM, members = [], profile = null, rooms = [] } = {}) {
  const writes = [];
  return {
    writes,
    room: {
      findUnique: async ({ where }) => (room && room.id === where.id ? { ...room } : null),
      findFirst: async ({ where }) => rooms.find(entry => entry.ownerId === where.ownerId) || null,
      create: async ({ data }) => {
        writes.push({ model: "room", op: "create", data });
        return { id: "room_new", ownerId: data.ownerId, title: data.title, archivedAt: null };
      }
    },
    roomMember: {
      findFirst: async ({ where }) => members.find(
        entry => entry.roomId === where.roomId
          && entry.userId === where.userId
          && (where.leftAt !== null || entry.leftAt == null)
      ) || null,
      upsert: async (args) => {
        writes.push({ model: "roomMember", op: "upsert", ...args });
        return {};
      }
    },
    user: {
      findUnique: async () => (profile ? { profile } : null)
    }
  };
}

test("SOL-INV-02: mitteliikme päring ei kirjuta MITTE MIDAGI enne 403-t", async () => {
  const db = makeDb();

  await assert.rejects(
    () => requireInviteRoomRole({
      db,
      userId: "outsider_1",
      roomId: ROOM.id,
      allowedRoles: ["OWNER"],
      ownerDisplayName: "Kaaperdatud nimi",
      locale: "et"
    }),
    (error) => error.status === 403 && error.code === "FORBIDDEN"
  );

  assert.deepEqual(db.writes, [], "keelatud päring on kõrvalmõjuta");
});

test("SOL-INV-02: MEMBER ei pääse ligi ega jäta jälge", async () => {
  const db = makeDb({
    members: [{ roomId: ROOM.id, userId: "member_1", role: "MEMBER", leftAt: null }]
  });

  await assert.rejects(
    () => requireInviteRoomRole({
      db,
      userId: "member_1",
      roomId: ROOM.id,
      allowedRoles: ["OWNER"],
      ownerDisplayName: "Kaaperdatud nimi",
      locale: "et"
    }),
    (error) => error.status === 403
  );

  assert.deepEqual(db.writes, []);
});

test("SOL-INV-02: ruumi lugemine ei puutu ühtki rida", async () => {
  const db = makeDb();

  const result = await resolveInviteRoom({
    db,
    userId: "outsider_1",
    roomId: ROOM.id,
    ownerDisplayName: "Kaaperdatud nimi",
    locale: "et"
  });

  assert.equal(result.room.id, ROOM.id);
  assert.equal(result.created, false);
  assert.deepEqual(db.writes, []);
});

test("SOL-INV-02: omaniku parandus jookseb alles pärast autoriseerimist", async () => {
  const db = makeDb({ profile: { firstName: "Mari", lastName: "Mets" } });

  const result = await requireInviteRoomRole({
    db,
    userId: OWNER,
    roomId: ROOM.id,
    allowedRoles: ["OWNER"],
    ownerDisplayName: "Payload nimi",
    locale: "et"
  });

  assert.equal(result.membership.role, "OWNER");
  assert.equal(db.writes.length, 1);
  const upsert = db.writes[0];
  assert.equal(upsert.model, "roomMember");
  assert.equal(upsert.where.roomId_userId.userId, OWNER);
  assert.equal(upsert.create.displayName, "Mari Mets", "nimi tuleb SERVERIST, mitte payload'ist");
  assert.equal("displayName" in upsert.update, false, "parandus ei kirjuta olemasolevat nime üle");
  assert.equal(upsert.update.leftAt, null);
});

test("SOL-INV-02: payload'i nimi ei jõua omaniku reale kunagi", async () => {
  const db = makeDb({ profile: null });

  await requireInviteRoomRole({
    db,
    userId: OWNER,
    roomId: ROOM.id,
    allowedRoles: ["OWNER"],
    ownerDisplayName: "Payload nimi",
    locale: "et"
  });

  const serialized = JSON.stringify(db.writes);
  assert.equal(serialized.includes("Payload nimi"), false);
});

test("SOL-INV-02: omaniku profiilita jääb kuvanimi määramata, e-posti sinna ei kirjutata", async () => {
  const db = makeDb({ profile: null });

  await ensureOwnerMembership(db, { roomId: ROOM.id, ownerId: OWNER });

  assert.equal(db.writes[0].create.displayName, undefined);
});

test("SOL-ROOM-01: arhiveeritud ruumi ei saa kutsevoos täiendada", async () => {
  const db = makeDb({ room: { ...ROOM, archivedAt: new Date("2026-08-01T00:00:00Z") } });

  await assert.rejects(
    () => requireInviteRoomRole({
      db,
      userId: OWNER,
      roomId: ROOM.id,
      allowedRoles: ["OWNER"],
      locale: "et"
    }),
    (error) => error.code === "ROOM_ARCHIVED"
  );

  assert.deepEqual(db.writes, []);
});

test("värskelt loodud ruumi ei pea parandama — liikmerida sünnib koos ruumiga", async () => {
  const db = makeDb({ room: null });

  const result = await requireInviteRoomRole({
    db,
    userId: "new_owner",
    roomTitle: "Uus ruum",
    ownerDisplayName: "Uus Omanik",
    allowedRoles: ["OWNER"],
    locale: "et"
  });

  assert.equal(result.roomCreated, true);
  assert.equal(db.writes.length, 1, "ainult ruumi loomine, mitte eraldi parandus");
  assert.equal(db.writes[0].model, "room");
  assert.equal(db.writes[0].data.members.create.displayName, "Uus Omanik");
});
