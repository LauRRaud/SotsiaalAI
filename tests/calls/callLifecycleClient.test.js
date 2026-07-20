import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// T12 E1 kliendipool (audit ptk 14 K1): kõne on kestev seansiolek. Näovahetus
// (töölaud/profiil) unmount'ib RoomCallBar'i esitluse — hook peab elama lehe
// (ChatBody) tasemel, muidu katkeb heli hääletult ja serverisse jääb
// fantoom-osaleja. Teardown ja tab'i sulgemine peavad serverile leave'i saatma.

async function read(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("useRoomCall hook is owned by ChatBody, not the call bar face", async () => {
  const chatBody = await read("components/alalehed/ChatBody.jsx");
  const callBar = await read("components/rooms/RoomCallBar.jsx");

  // Omanik on ChatBody: hook kutsutakse seal ja tagastus liigub propina.
  assert.match(chatBody, /useRoomCall\(/);
  assert.match(chatBody, /session=\{roomCallSession\}/);
  // Ligipääsuvärav elab hooki roomId-argumendis (fail-closed: blocked/auth → "").
  assert.match(chatBody, /!roomBlocked && !roomAuthRequired \? effectiveRoomId : ""/);

  // Riba on puhas esitlus: oma hooki-instantsi ei tohi tekkida (see taastaks
  // unmount-katkestuse) ja ilma session'ita ei renderdata midagi.
  assert.doesNotMatch(callBar, /useRoomCall\(/);
  assert.match(callBar, /!roomId \|\| !session/);
});

test("useRoomCall sends server leave on teardown and on pagehide", async () => {
  const source = await read("components/rooms/useRoomCall.js");

  // Fire-and-forget leave: sendBeacon esimesena, keepalive-fetch varuna.
  assert.match(source, /sendLeaveSignal/);
  assert.match(source, /navigator\.sendBeacon/);
  assert.match(source, /keepalive:\s*true/);
  // Teardown (ruumivahetus/unmount/ligipääsu kadu) saadab leave'i ainult siis,
  // kui olime liitunud — joinedCallIdRef on ainus tõde.
  assert.match(source, /const callSessionId = joinedCallIdRef\.current;\s*\n\s*joinedCallIdRef\.current = "";\s*\n\s*if \(callSessionId\) sendLeaveSignal\(roomId, callSessionId\);/);
  // Tab'i sulgemine / kõva navigatsioon: React-cleanup'e ei jooksutata.
  assert.match(source, /addEventListener\("pagehide"/);
});
