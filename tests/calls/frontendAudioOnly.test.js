import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("room call frontend uses LiveKit audio track without camera or video track creation", async () => {
  const source = await readFile(new URL("../../components/rooms/useRoomCall.js", import.meta.url), "utf8");

  assert.match(source, /createLocalAudioTrack/);
  assert.match(source, /Track\.Source\.Microphone/);
  assert.match(source, /RoomEvent\.TrackSubscribed/);
  assert.match(source, /track\?\.kind !== "audio"/);
  assert.doesNotMatch(source, /createLocalVideoTrack/);
  assert.doesNotMatch(source, /getUserMedia\s*\([^)]*video\s*:/s);
  assert.doesNotMatch(source, /Track\.Source\.Camera/);
});

test("recording consent UI is role-neutral and does not imply automatic recording or transcription", async () => {
  const source = await readFile(new URL("../../components/rooms/RoomCallBar.jsx", import.meta.url), "utf8");

  assert.match(source, /requesterName/);
  assert.match(source, /soovib selle helik/);
  assert.match(source, /Alusta salvestamist/);
  assert.match(source, /Salvestamine käib/);
  assert.doesNotMatch(source.toLowerCase(), /sotsiaalt/);
  assert.doesNotMatch(source, /createLocalVideoTrack/);
  assert.doesNotMatch(source, /getUserMedia\s*\([^)]*video\s*:/s);
});
