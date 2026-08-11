import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-07 — AI ruumirežiim nõuab aktiivset liikmesust kõigilt, ka administraatorilt.
 *
 * Leid oli KAHE REEGLI vahe: ruumisõnumite API nõudis liikmesust kõigilt, chat bootstrap tegi
 * adminile erandi, ja sõnumi kirjutaja ise ei kontrollinud midagi. Sellepärast mõõdetakse siin
 * mõlemat väravat eraldi — üks neist üksi ei ole tõend.
 */

test("chat bootstrap ei tee ruumi liikmesuse kontrollis adminile erandit", () => {
  const source = read("lib/chat/requestBootstrap.js");

  assert.match(source, /if \(roomId && userId\) \{\s*\n\s*const roomMembership = await getRoomMembership/);
  assert.ok(
    !/roomId && userId && !roleState\.isAdmin/.test(source),
    "adminierand oli leid ise — teda ei tohi tagasi tulla"
  );
  assert.match(source, /if \(!roomMembership\) \{[\s\S]*?api\.common\.forbidden", 403/);
});

test("assistendi ruumisõnumi kirjutaja kontrollib liikmesust ise ja VISKAB", () => {
  const source = read("lib/chat/mainRouteRuntime.js");

  const guard = source.indexOf("roomMember.findFirst");
  const write = source.indexOf("roomMessage.create");
  assert.ok(guard > 0, "kirjutajal peab olema oma värav");
  assert.ok(guard < write, "värav peab olema ENNE kirjutust");
  assert.match(source, /if \(!membership\) \{[\s\S]*?ROOM_MEMBERSHIP_REQUIRED[\s\S]*?throw error;/);
  assert.match(source, /leftAt: null/, "lahkunud liige ei ole liige");
});

test("ruumisõnumite API leping ei ole muutunud: liikmesus enne lugemist ja kirjutamist", () => {
  const source = read("app/api/rooms/[roomId]/messages/route.js");
  // Värav kolis 11.08 jagatud moodulisse (SOL-ROOM-01) — liikmesuse nõue ei kadunud, vaid
  // sai juurde elutsükli piiri: lugemine tohib arhiveeritud ruumis toimuda, kirjutus mitte.
  assert.match(source, /resolveRoomAccess\(\{[\s\S]*?intent,[\s\S]*?\}\)/);
  assert.match(source, /ensureAccess\(auth\.userId, roomId, auth\.userRole, ROOM_READ\)/);
  assert.match(source, /ensureAccess\(auth\.userId, roomId, auth\.userRole, ROOM_WRITE\)/);

  const guard = read("lib/rooms/accessGuard.js");
  assert.match(guard, /leftAt: null/, "lahkunud liige ei ole liige");
  assert.match(guard, /api\.rooms\.access_denied/);
  assert.match(guard, /api\.rooms\.archived_readonly/);
});

// --- Käitumine, mitte ainult kuju ---

const { saveAssistantRoomMessage } = await import("../../lib/chat/mainRouteRuntime.js");

function fakeDb({ member, archivedAt = null }) {
  const calls = { writes: 0 };
  return {
    calls,
    db: {
      roomMember: {
        findFirst: async () => (member ? { id: "member-1" } : null)
      },
      room: {
        findUnique: async () => ({ archivedAt })
      },
      roomMessage: {
        create: async ({ data }) => {
          calls.writes += 1;
          calls.lastWrite = data;
          return { id: "msg-1", ...data, createdAt: new Date(), author: { role: "CLIENT" } };
        }
      }
    }
  };
}

test("liikmesuseta kirjutus VISKAB ja ei jäta ruumi ühtegi rida", async () => {
  const { db, calls } = fakeDb({ member: false });
  await assert.rejects(
    () => saveAssistantRoomMessage(
      { roomId: "room-1", userId: "admin-1", content: "Assistendi sõnum" },
      { prisma: db }
    ),
    (error) => error?.code === "ROOM_MEMBERSHIP_REQUIRED"
  );
  assert.equal(calls.writes, 0, "võõrasse ruumi ei tohi jõuda ühtegi sõnumit");
});

test("liikmesusega kirjutus läheb läbi ja kannab ASSISTANT päritolu", async () => {
  const { db, calls } = fakeDb({ member: true });
  const result = await saveAssistantRoomMessage(
    { roomId: "room-1", userId: "member-1", content: "Assistendi sõnum" },
    { prisma: db }
  );
  assert.equal(calls.writes, 1);
  assert.equal(calls.lastWrite.senderType, "ASSISTANT");
  assert.equal(result.authorName, "Assistant");
});

test("lõpetatud ruumi ei kirjuta ka assistent (SOL-ROOM-01)", async () => {
  const { db, calls } = fakeDb({ member: true, archivedAt: new Date("2026-08-01") });
  await assert.rejects(
    () => saveAssistantRoomMessage(
      { roomId: "room-1", userId: "member-1", content: "Assistendi sõnum" },
      { prisma: db }
    ),
    (error) => error?.code === "ROOM_ARCHIVED"
  );
  assert.equal(calls.writes, 0, "arhiveeritud ruumi ühine ajalugu ei tohi enam muutuda");
});
