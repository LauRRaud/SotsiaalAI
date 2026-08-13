import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  FIELD_RECORDING_MAX_BYTES,
  FIELD_RECORDING_MAX_MS,
  fieldRecordingSeconds,
  nextFieldRecordingChunk
} from "../../lib/field/recordingLimits.js";

const ROOM_SOURCE = fs.readFileSync(new URL("../../components/field/FieldVisitRoom.jsx", import.meta.url), "utf8");

test("a chunk that would cross the local byte ceiling is never retained", () => {
  const almostFull = FIELD_RECORDING_MAX_BYTES - 5;
  const accepted = nextFieldRecordingChunk(almostFull, 5);
  const rejected = nextFieldRecordingChunk(accepted.totalBytes, 1);
  assert.equal(accepted.accept, true);
  assert.equal(accepted.totalBytes, FIELD_RECORDING_MAX_BYTES);
  assert.equal(rejected.accept, false);
  assert.equal(rejected.totalBytes, FIELD_RECORDING_MAX_BYTES);
  assert.equal(rejected.limitReached, true);
});

test("elapsed time is capped at the same ten-minute local contract", () => {
  assert.equal(FIELD_RECORDING_MAX_MS, 600_000);
  assert.equal(fieldRecordingSeconds(FIELD_RECORDING_MAX_MS + 60_000), 600);
});

test("room cleanup owns recorder, stream, pagehide and visibility boundaries", () => {
  assert.match(ROOM_SOURCE, /const streamRef = useRef\(null\)/u);
  assert.match(ROOM_SOURCE, /window\.addEventListener\("pagehide", stopHiddenRecording\)/u);
  assert.match(ROOM_SOURCE, /document\.addEventListener\("visibilitychange", stopWhenHidden\)/u);
  assert.match(ROOM_SOURCE, /streamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(ROOM_SOURCE, /recorder\.start\(1000\)/u);
  assert.match(ROOM_SOURCE, /FIELD_RECORDING_MAX_MS/u);
  assert.match(ROOM_SOURCE, /nextFieldRecordingChunk/u);
});
