/**
 * FIELD-V1 OCR (doc ptk 5, O-FD-5): server-side, command-driven (Tesseract
 * `est`), strictly on user command and only over an already-synced photo.
 * The output is returned as an UNSAVED draft — the client shows it next to
 * the image and only a user confirmation turns it into a note with
 * AI_MUSTAND provenance. When no OCR binary is configured the endpoint says
 * so honestly (503) and the UI falls back to manual typing.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const MAX_OCR_OUTPUT_CHARS = 20000;

function enabled(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "false").trim().toLowerCase());
}

export function isFieldOcrConfigured(env = process.env) {
  return enabled(env.FIELD_OCR_ENABLED) && Boolean(String(env.FIELD_OCR_CMD || "tesseract").trim());
}

function runCommand(cmd, args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout || ""));
    });
  });
}

/**
 * Runs OCR over an image buffer. `exec` is injectable for tests; the real
 * runner shells out to `tesseract <tmp> stdout -l est+eng`. The temp file is
 * always removed, also on failure.
 */
export async function runFieldOcr(buffer, { env = process.env, exec = runCommand } = {}) {
  if (!isFieldOcrConfigured(env)) {
    const error = new Error("field.errors.ocr_unavailable");
    error.status = 503;
    throw error;
  }
  const cmd = String(env.FIELD_OCR_CMD || "tesseract").trim();
  const lang = String(env.FIELD_OCR_LANG || "est+eng").trim();
  const tmpPath = path.join(os.tmpdir(), `sotsiaalai-field-ocr-${crypto.randomBytes(8).toString("hex")}`);
  await fs.writeFile(tmpPath, buffer);
  try {
    const text = await exec(cmd, [tmpPath, "stdout", "-l", lang]);
    const trimmed = String(text || "").trim();
    return {
      text: trimmed.length > MAX_OCR_OUTPUT_CHARS ? trimmed.slice(0, MAX_OCR_OUTPUT_CHARS) : trimmed,
      truncated: trimmed.length > MAX_OCR_OUTPUT_CHARS
    };
  } catch (cause) {
    const error = new Error("field.errors.ocr_failed");
    error.status = 502;
    error.cause = cause;
    throw error;
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
