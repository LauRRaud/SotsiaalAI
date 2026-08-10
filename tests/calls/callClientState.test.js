import assert from "node:assert/strict";
import test from "node:test";

import {
  MIC_CONTROL_AVAILABLE,
  MIC_CONTROL_NOT_IN_CALL,
  MIC_CONTROL_NO_AUDIO,
  MIC_CONTROL_OTHER_TAB,
  providerNeedsLocalTrack,
  resolveMicControl,
  shouldApplyCallSnapshot,
  shouldReleaseLocalCall
} from "@/lib/calls/clientState";

/**
 * VANA TEOSTUS, mille vastu need testid mõõdavad. Ilma temata ei tõenda roheline
 * sviit siin midagi — iga „available: false" võib olla ka lihtsalt liiga range uus
 * reegel. Negatiivkontroll ütleb, et vana valem oleks andnud VASTUPIDISE vastuse.
 */
const legacyJoined = (joinedHere, serverParticipant) => joinedHere || Boolean(serverParticipant);

test("SOL-CALL-12: teise vahekaardi serveriosalus EI anna selle vahekaardi mikrofoni juhtimist", () => {
  const serverParticipant = { userId: "user_1", micMuted: false };

  // Negatiivkontroll: vana valem luges selle vahekaardi kõnes olevaks ja pind pakkus
  // vaigistusnuppu, mille taga oli `null` track — vaikne no-op + andmebaasi lipp.
  assert.equal(legacyJoined(false, serverParticipant), true);

  const control = resolveMicControl({
    provider: "LIVEKIT_SELF_HOSTED",
    joinedHere: false,
    hasServerParticipant: true,
    audioOwner: false
  });
  assert.equal(control.available, false);
  assert.equal(control.reason, MIC_CONTROL_OTHER_TAB);
});

test("SOL-CALL-12: liitumine SIIT ilma publitseeritud track'ita ei anna samuti juhtimist", () => {
  // See on lehe taaslaadimise ja katkenud ühenduse juht: `joined` on tõsi, track ei ole.
  const control = resolveMicControl({
    provider: "LIVEKIT_SELF_HOSTED",
    joinedHere: true,
    hasServerParticipant: true,
    audioOwner: false
  });
  assert.equal(control.available, false);
  assert.equal(control.reason, MIC_CONTROL_NO_AUDIO);
});

test("SOL-CALL-12: publitseeritud track selles vahekaardis annab juhtimise", () => {
  const control = resolveMicControl({
    provider: "LIVEKIT_SELF_HOSTED",
    joinedHere: true,
    hasServerParticipant: true,
    audioOwner: true
  });
  assert.equal(control.available, true);
  assert.equal(control.reason, MIC_CONTROL_AVAILABLE);
});

test("SOL-CALL-12: mock-provideril on lipp kogu tõde ja nupp jääb alles", () => {
  // Mock ei publitseeri brauserist midagi — seal ei ole track'i, mille kohta valetada.
  assert.equal(providerNeedsLocalTrack("MOCK"), false);
  assert.equal(providerNeedsLocalTrack("livekit_self_hosted"), true);

  const control = resolveMicControl({
    provider: "MOCK",
    joinedHere: true,
    hasServerParticipant: true,
    audioOwner: false
  });
  assert.equal(control.available, true);
});

test("SOL-CALL-12: kõnest väljas olles ei ole nuppu ega valet põhjust", () => {
  const control = resolveMicControl({ provider: "LIVEKIT_SELF_HOSTED" });
  assert.equal(control.available, false);
  assert.equal(control.reason, MIC_CONTROL_NOT_IN_CALL);
});

test("SOL-CALL-13: vana ruumi vastus ei tohi uue ruumi vaadet üle kirjutada", () => {
  // Ruum A küsis (põlvkond 4), kasutaja läks ruumi B (põlvkond 5) ja alles siis
  // saabus A vastus. Vana kood kirjutas ta tingimusteta state'i.
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: 4,
    currentGeneration: 5,
    requestRoomId: "room_a",
    currentRoomId: "room_b"
  }), false);

  // Ka siis, kui number juhtumisi klapib, otsustab ruumi identiteet.
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: 5,
    currentGeneration: 5,
    requestRoomId: "room_a",
    currentRoomId: "room_b"
  }), false);

  // Sama ruumi VANEM poll ei tohi uuemat üle kirjutada.
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: 4,
    currentGeneration: 5,
    requestRoomId: "room_a",
    currentRoomId: "room_a"
  }), false);

  // Ja värske vastus omas ruumis jõuab kohale — muidu oleks parandus lihtsalt lukk.
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: 5,
    currentGeneration: 5,
    requestRoomId: "room_a",
    currentRoomId: "room_a"
  }), true);
});

test("SOL-CALL-13: puuduv number või ruum ei ole „värske“, vaid „ei tea“", () => {
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: Number.NaN,
    currentGeneration: 5,
    requestRoomId: "room_a",
    currentRoomId: "room_a"
  }), false);
  assert.equal(shouldApplyCallSnapshot({
    requestGeneration: 5,
    currentGeneration: 5,
    requestRoomId: "",
    currentRoomId: ""
  }), false);
  assert.equal(shouldApplyCallSnapshot(), false);
});

test("SOL-CALL-13: koristatakse ainult siis, kui olime ise liitunud", () => {
  // Vana vastus ei tohi kutsuda cleanup'i ühenduse peal, mida ta ei loonud.
  assert.equal(shouldReleaseLocalCall({ snapshotCallId: "call_b", joinedCallId: "" }), false);
  assert.equal(shouldReleaseLocalCall({ snapshotCallId: "call_a", joinedCallId: "call_a" }), false);
  assert.equal(shouldReleaseLocalCall({ snapshotCallId: "call_b", joinedCallId: "call_a" }), true);
  assert.equal(shouldReleaseLocalCall({ snapshotCallId: null, joinedCallId: "call_a" }), true);
});
