import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ARCHIVED_ROOM_ERROR,
  ROOM_READ,
  ROOM_WIND_DOWN,
  ROOM_WRITE,
  isArchivedRoom,
  resolveRoomAccess
} from "../../lib/rooms/accessGuard.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel) => readFileSync(path.join(repoRoot, rel), "utf8");

function makeDb({ room, member, subscription = true }) {
  return {
    room: { findUnique: async () => room },
    roomMember: { findFirst: async () => member },
    networkShare: { findFirst: async () => null },
    subscription: { findFirst: async () => (subscription ? { id: "sub-1" } : null) }
  };
}

const ACTIVE_MEMBER = { userId: "u1", roomId: "r1", role: "MEMBER", leftAt: null };
const OPEN_ROOM = { id: "r1", ownerId: "owner", archivedAt: null, helpMatch: null };
const ARCHIVED_ROOM = { id: "r1", ownerId: "owner", archivedAt: new Date("2026-08-01"), helpMatch: null };

const call = (room, intent, extra = {}) =>
  resolveRoomAccess({
    userId: "u1",
    userRole: "SOCIAL_WORKER",
    roomId: "r1",
    intent,
    db: makeDb({ room, member: ACTIVE_MEMBER, ...extra })
  });

// --- Elutsükli piir -------------------------------------------------------

test("arhiveeritud ruumis on KIRJUTUS kinni — ka omanikul ja ka adminil", async () => {
  const asMember = await call(ARCHIVED_ROOM, ROOM_WRITE);
  assert.equal(asMember.ok, false);
  assert.equal(asMember.status, ARCHIVED_ROOM_ERROR.status);
  assert.equal(asMember.message, ARCHIVED_ROOM_ERROR.message);

  const asOwner = await resolveRoomAccess({
    userId: "owner",
    userRole: "ADMIN",
    roomId: "r1",
    intent: ROOM_WRITE,
    db: makeDb({ room: ARCHIVED_ROOM, member: { ...ACTIVE_MEMBER, userId: "owner", role: "OWNER" } })
  });
  assert.equal(asOwner.ok, false, "omanik ja admin ei ole erand — arhiiv on elutsükli piir");
  assert.equal(asOwner.status, 409);
});

test("arhiveeritud ruumi LUGEMINE jääb lubatuks ja ütleb ennast välja", async () => {
  const result = await call(ARCHIVED_ROOM, ROOM_READ);
  assert.equal(result.ok, true, "ajaloo lugemine on lubadus, mitte lünk");
  assert.equal(result.readOnly, true, "kutsuja saab piiri vastuses edasi anda");
});

test("juba avatud asja LÕPETAMINE on arhiveeritud ruumis lubatud", async () => {
  // Muidu jääks arhiveerimise hetkel käimasoleva kõne osaleja lukku: ei saaks lahkuda,
  // salvestust peatada ega nõusolekut tagasi võtta.
  const result = await call(ARCHIVED_ROOM, ROOM_WIND_DOWN);
  assert.equal(result.ok, true);
});

test("avatud ruumis on kõik kolm lepingut lubatud", async () => {
  for (const intent of [ROOM_READ, ROOM_WIND_DOWN, ROOM_WRITE]) {
    const result = await call(OPEN_ROOM, intent);
    assert.equal(result.ok, true, intent);
    assert.equal(result.readOnly, false, intent);
  }
});

// --- Vana leping ei tohi kaduda -------------------------------------------

test("olematu ruum on 404, lahkunud liige 403 ja tellimuseta liige 403", async () => {
  const missing = await resolveRoomAccess({
    userId: "u1",
    roomId: "r1",
    db: makeDb({ room: null, member: ACTIVE_MEMBER })
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.message, "api.rooms.not_found");

  const stranger = await resolveRoomAccess({
    userId: "u1",
    roomId: "r1",
    db: makeDb({ room: OPEN_ROOM, member: null })
  });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.message, "api.rooms.access_denied");

  const unpaid = await call(OPEN_ROOM, ROOM_WRITE, { subscription: false });
  assert.equal(unpaid.status, 403);
  assert.equal(unpaid.message, "api.rooms.join_unavailable");
});

test("abipaari ruum on tasuta ka ilma tellimuseta — see reegel ei muutunud", async () => {
  const helpRoom = { ...OPEN_ROOM, helpMatch: { id: "hm-1" } };
  const result = await call(helpRoom, ROOM_WRITE, { subscription: false });
  assert.equal(result.ok, true);
  assert.equal(result.billingSource, "HELP_MATCH_FREE");
});

test("vaikeväärtus on KIRJUTUS — lepingut mitte nimetav kutsuja on arhiivis kinni", async () => {
  const result = await resolveRoomAccess({
    userId: "u1",
    roomId: "r1",
    db: makeDb({ room: ARCHIVED_ROOM, member: ACTIVE_MEMBER })
  });
  assert.equal(result.ok, false, "fail-closed vaikeväärtus on selle leiu tuum");
  assert.equal(result.status, 409);
});

test("isArchivedRoom on sama otsus ka väljaspool väravat", () => {
  assert.equal(isArchivedRoom(ARCHIVED_ROOM), true);
  assert.equal(isArchivedRoom(OPEN_ROOM), false);
  assert.equal(isArchivedRoom(null), false);
});

test("SOL-NET-04: SENT võrgustikuruumi otselink ei möödu avamisoperatsioonist", async () => {
  const room = { ...OPEN_ROOM, originType: "NETWORK_SHARE", originId: "share-1" };
  const db = makeDb({ room, member: ACTIVE_MEMBER });
  db.networkShare.findFirst = async () => ({
    id: "share-1",
    roomId: "r1",
    recipientUserId: "u1",
    status: "SENT",
    participationEndsOn: new Date("2026-12-31T00:00:00.000Z")
  });
  const result = await resolveRoomAccess({
    userId: "u1",
    userRole: "SOCIAL_WORKER",
    roomId: "r1",
    intent: ROOM_READ,
    db,
    now: new Date("2026-08-13T00:00:00.000Z")
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, "api.rooms.network_share_not_opened");
});

test("SOL-NET-05: lõppenud kuupäev sulgeb võrgustikuruumi ka olemasolevale liikmele", async () => {
  const room = { ...OPEN_ROOM, originType: "NETWORK_SHARE", originId: "share-1" };
  const db = makeDb({ room, member: ACTIVE_MEMBER });
  db.networkShare.findFirst = async () => ({
    id: "share-1",
    roomId: "r1",
    recipientUserId: "u1",
    status: "OPENED",
    participationEndsOn: new Date("2026-08-12T00:00:00.000Z")
  });
  const result = await resolveRoomAccess({
    userId: "u1",
    userRole: "SOCIAL_WORKER",
    roomId: "r1",
    intent: ROOM_READ,
    db,
    now: new Date("2026-08-13T00:00:00.000Z")
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, "api.rooms.access_denied");
});

test("SOL-NET-05: lõppkuupäeval endal jääb avatud võrgustikuruum ligipääsetavaks", async () => {
  const room = { ...OPEN_ROOM, originType: "NETWORK_SHARE", originId: "share-1" };
  const db = makeDb({ room, member: ACTIVE_MEMBER });
  db.networkShare.findFirst = async () => ({
    id: "share-1",
    roomId: "r1",
    recipientUserId: "u1",
    status: "OPENED",
    participationEndsOn: new Date("2026-08-13T00:00:00.000Z")
  });
  const result = await resolveRoomAccess({
    userId: "u1",
    userRole: "SOCIAL_WORKER",
    roomId: "r1",
    intent: ROOM_READ,
    db,
    now: new Date("2026-08-13T23:59:59.999Z")
  });
  assert.equal(result.ok, true);
});

// --- Katvus: ükski ruumimarsruut ei tohi väravast mööda minna --------------

function roomRouteFiles() {
  const base = path.join(repoRoot, "app/api/rooms");
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.js") out.push(path.relative(repoRoot, full).split(path.sep).join("/"));
    }
  };
  walk(base);
  return out;
}

/**
 * Leid ei olnud „üks marsruut unustas kontrolli", vaid „iga marsruut kandis oma koopiat".
 * See test on selle vastu ainus püsiv kaitse: uus ruumimarsruut peab jagatud väravat
 * kasutama, muidu ta kukub siin — mitte alles järgmises auditis.
 */
test("iga ruumimarsruut käib jagatud värava kaudu", () => {
  const exceptions = new Set([
    // Loend ja loomine: ruumi ENNE ligipääsu, oma omaniku- ja tellimusloogikaga.
    "app/api/rooms/route.js",
    // Elutsükkel ise: kustutus, arhiveerimine ja omanikuvahetus otsustavad `archivedAt`
    // üle, seega nad ei saa käia värava taga, mis selle peal keeldub.
    "app/api/rooms/[roomId]/route.js",
    "app/api/rooms/[roomId]/transfer/route.js",
    // Lahkumine peab õnnestuma ka arhiveeritud ruumis.
    "app/api/rooms/[roomId]/leave/route.js",
    // Kinnitusring vastab juba jagatud kokkuvõttele; oma värav on `respondToSummaryApproval`.
    "app/api/rooms/[roomId]/summaries/[summaryId]/approval/route.js"
  ]);

  const missing = [];
  for (const file of roomRouteFiles()) {
    if (exceptions.has(file)) continue;
    const source = read(file);
    if (!/resolveRoomAccess|requireRoomCallAccess/.test(source)) missing.push(file);
  }

  assert.deepEqual(missing, [], `värav puudub: ${missing.join(", ")}`);
});

test("kutse loomine ja vastuvõtt tunnevad lõpetatud ruumi", () => {
  /* SOL-INV-02 kolis kutsevoo ruumivärava ühte kohta. Reegel ei tohi seetõttu
     enam elada marsruudis: kontrollime teda seal, kus ta on, JA nõuame, et
     mõlemad kutseteed käiksid sellest väravast läbi. Varem oli arhiivikontroll
     ainult ühes kahest koopiast — sponsoreeritud rada käis temast mööda. */
  assert.match(read("lib/invites/roomAccess.js"), /isArchivedRoom\(room\)/);
  assert.match(read("app/api/invites/route.js"), /requireInviteRoomRole/);
  assert.match(read("app/api/invites/sponsored/init/route.js"), /requireInviteRoomRole/);
  assert.match(read("lib/invites/acceptInviteCore.js"), /isArchivedRoom\(invite\.room\)/);
});

// --- SOL-ROOM-05: elutsüklisiire ja tema jälg ühes tehingus ----------------

test("kustutus ja arhiveerimine kirjutavad auditi SAMAS tehingus", () => {
  const source = read("app/api/rooms/[roomId]/route.js");

  // Kustutus: audit ja `room.delete` peavad olema ühe `$transaction` sees, muidu jääb
  // ebaõnnestunud kustutuse järel alles rida, mis väidab olematut kustutust.
  const deleteTx = source.indexOf("await prisma.$transaction(async (tx) => {");
  assert.ok(deleteTx > 0, "kustutus peab käima tehingus");
  assert.match(source, /tx\.dataAuditLog\?\.create[\s\S]*?ROOM_DELETED[\s\S]*?tx\.room\.delete/);

  // Arhiveerimine: tingimuslik update ja audit samas tehingus.
  assert.match(source, /tx\.room\.updateMany\([\s\S]*?archivedAt: null[\s\S]*?ROOM_ARCHIVED/);

  // Ja kumbki ei tohi enam kirjutada auditit tehingust VÄLJAS.
  assert.doesNotMatch(source, /prisma\.dataAuditLog\?\.create/);
});

test("omanikuvahetus ja lahkumine käivad sama ruumiluku alt", () => {
  const ownership = read("lib/rooms/ownership.js");
  assert.match(ownership, /pg_advisory_xact_lock\(hashtext\(/);
  assert.match(ownership, /lockRoom\(tx, roomId\)/);
  // Kirjutus on kohtunik, mitte lugemine.
  assert.match(ownership, /leftAt: null[\s\S]*?data: \{ role: "OWNER" \}/);
  assert.match(ownership, /if \(promoted\.count < 1\)/);
  assert.match(ownership, /if \(left\.count < 1\)/);

  for (const route of ["app/api/rooms/[roomId]/transfer/route.js", "app/api/rooms/[roomId]/leave/route.js"]) {
    const source = read(route);
    assert.match(source, /transferRoomOwnership|leaveRoom/, route);
    // Vana kuju: tingimusteta `roomMember.update` lahkumisel ja audit pärast tehingut.
    assert.doesNotMatch(source, /prisma\.roomMember\.update\(\{/, route);
  }
});
