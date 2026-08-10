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

// SOL-CALL-11/12/13. Otsused ise on `lib/calls/clientState.js`-is ja neil on oma
// sviit koos negatiivkontrollidega (`callClientState.test.js`). Siin on JUHTMESTIK:
// kas hook neid otsuseid päriselt kasutab ja kas fail-closed rajad on olemas.
// Tekstivaste on nõrk tõend — aga hooki ennast see jooksja ei renderda, ja mõõtmata
// juhtmestik oli täpselt see, mis kolm leidu roheliste väravate taha peitis.

test("SOL-CALL-11: katkenud LiveKit-liitumine koristab track'i, ühenduse JA serveriosaluse", async () => {
  const source = await read("components/rooms/useRoomCall.js");

  // connect/create/publish on ühe catch'i all, mis koristab ja viskab edasi.
  assert.match(source, /const connectLiveKit = useCallback\(async \(\{ token, url \}\) => \{[\s\S]*?try \{[\s\S]*?openLiveKitSession\(\{ token, url \}\);[\s\S]*?\} catch \(error\) \{[\s\S]*?await cleanupLiveKit\(\);[\s\S]*?throw error;/);

  // Liitumis-ID kirja ENNE providerit — mõlemal rajal (start ja join).
  const joinBlock = source.slice(source.indexOf("const join = useCallback"));
  const claimIndex = joinBlock.indexOf("joinedCallIdRef.current = claimedCallId;");
  const connectIndex = joinBlock.indexOf("await connectLiveKit(");
  assert.ok(claimIndex > 0 && connectIndex > 0, "join peab kandma nii claim'i kui providerikutset");
  assert.ok(claimIndex < connectIndex, "liitumis-ID peab olema kirjas enne providerikutset");

  const startBlock = source.slice(source.indexOf("const start = useCallback"), source.indexOf("const join = useCallback"));
  assert.ok(
    startBlock.indexOf("joinedCallIdRef.current = claimedCallId;") < startBlock.indexOf("await connectLiveKit("),
    "start peab claim'ima kõne enne providerikutset"
  );

  // Vea korral käib serveri leave, mitte ainult veateade.
  assert.match(source, /const releaseFailedJoin = useCallback\(async callSessionId => \{[\s\S]*?await cleanupLiveKit\(\);[\s\S]*?postAction\("\/leave", \{ callSessionId \}\)/);
  assert.match(startBlock, /catch \(err\) \{\s*\n\s*await releaseFailedJoin\(claimedCallId\);/);
  assert.match(joinBlock, /catch \(err\) \{\s*\n\s*await releaseFailedJoin\(claimedCallId\);/);
});

test("SOL-CALL-12: vaigistus vajab selle vahekaardi track'i ja tema kinnitust", async () => {
  const source = await read("components/rooms/useRoomCall.js");
  const callBar = await read("components/rooms/RoomCallBar.jsx");

  // Track'i omanikuks saadakse alles publitseerimise järel; cleanup võtab selle maha.
  // NB: `.` ei matchi `\r`-i, fail on CRLF — kommentaaride vahelejätt käib `[^\n]*`-ga.
  assert.match(source, /publishTrack\(track, \{[\s\S]*?\}\);\s*(?:\/\/[^\n]*\s*)*setAudioOwner\(true\);/);
  assert.match(source, /audioTrackRef\.current = null;\s*\n\s*setAudioOwner\(false\);/);

  // Otsus tuleb jagatud moodulist, mitte JSX-ist ega hooki sisemisest valemist.
  assert.match(source, /resolveMicControl\(\{[\s\S]*?joinedHere: joined,[\s\S]*?audioOwner[\s\S]*?\}\)/);

  // Juhtimiseta vahekaart EI kirjuta andmebaasi — enne oli see vaikne no-op + lipp.
  assert.match(source, /if \(!micControl\.available\) \{\s*\n\s*setError\("call\.mic_not_controlled_here"\);\s*\n\s*return;/);
  assert.doesNotMatch(source, /audioTrackRef\.current\?\.mute\?\.\(\)/);
  assert.doesNotMatch(source, /audioTrackRef\.current\?\.unmute\?\.\(\)/);

  // Track peab ise kinnitama uue seisu, alles siis läheb lipp serverisse.
  assert.match(source, /track\.isMuted !== nextMuted/);

  // Pind: nupp on kinni ja põhjus on väljas, mitte lihtsalt hall.
  assert.match(callBar, /micControlBlocked/);
  assert.match(callBar, /disabled=\{busy \|\| micControlBlocked\}/);
  assert.match(callBar, /calls\.mic_control_other_tab/);
  assert.match(callBar, /calls\.mic_control_no_audio/);
});

test("SOL-CALL-13: vana ruumi vastust ei rakendata ja ta ei korista uut ühendust", async () => {
  const source = await read("components/rooms/useRoomCall.js");

  // Põlvkond antakse enne päringut ja kontrollitakse pärast vastust.
  assert.match(source, /const generation = loadGenerationRef\.current \+ 1;\s*\n\s*loadGenerationRef\.current = generation;/);
  assert.match(source, /shouldApplyCallSnapshot\(\{[\s\S]*?requestGeneration: generation,[\s\S]*?currentGeneration: loadGenerationRef\.current,[\s\S]*?requestRoomId,[\s\S]*?currentRoomId: roomIdRef\.current/);
  // Kontroll on ENNE esimest setState'i ja enne cleanup'i — see on kogu parandus.
  const applyIndex = source.indexOf("if (!fresh()) return;");
  const setCallIndex = source.indexOf("setCall(payload.call || null);");
  assert.ok(applyIndex > 0 && applyIndex < setCallIndex, "värskuse kontroll peab eelnema state'i kirjutusele");

  // Ruumivahetus katkestab lennus päringu ja aegub tema põlvkonna.
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /roomIdRef\.current = roomId;\s*\n\s*loadGenerationRef\.current \+= 1;/);
  assert.match(source, /err\?\.name === "AbortError"/);
});
