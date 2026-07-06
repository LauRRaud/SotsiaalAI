import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { waitForReadableStableFile } from "../../lib/calls/recordingStorage.js";

test("recording storage waits for Egress output before finalizing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-recording-storage-"));
  const recordingDir = path.join(root, "recordings");
  const fileName = "call-recording-test.ogg";
  const sourcePath = path.join(recordingDir, fileName);

  await fs.mkdir(recordingDir, { recursive: true });
  const delayedWrite = setTimeout(() => {
    fs.writeFile(sourcePath, Buffer.from("audio-bytes")).catch(() => {});
  }, 150);

  try {
    const stat = await waitForReadableStableFile(sourcePath, {
      RECORDING_FINALIZE_WAIT_MS: "2500",
      RECORDING_FINALIZE_POLL_MS: "50"
    });

    assert.equal(stat.size, 11);
  } finally {
    clearTimeout(delayedWrite);
    await fs.rm(root, { recursive: true, force: true });
  }
});
