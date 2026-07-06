import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("transcript summary prompt requires thematic accuracy without sentence-by-sentence paraphrase", () => {
  const generation = read("lib/documents/generation.js");

  assert.match(generation, /must not change the transcript's meaning/);
  assert.match(generation, /participant claims, certainty level, or emphasis/);
  assert.match(generation, /If a sentence cannot be justified by the transcript, leave it out/);
  assert.match(generation, /Do not create a sentence-by-sentence paraphrase/);
  assert.match(generation, /consolidate repeated points under the same theme/);
  assert.match(generation, /remove filler words, interruptions, repetitions/);
  assert.match(generation, /Transkriptist ei selgu/);
  assert.match(generation, /splitTranscriptIntoBlocks/);
});

test("summary endpoint creates a transcript summary artifact from transcript content only", () => {
  const summaryRoute = read("app/api/documents/[id]/summary/route.js");

  assert.match(summaryRoute, /TRANSCRIPT_KINDS/);
  assert.match(summaryRoute, /generateTranscriptSummaryContent/);
  assert.match(summaryRoute, /transcriptText/);
  assert.match(summaryRoute, /type:\s*"TRANSCRIPT_SUMMARY"/);
  assert.match(summaryRoute, /sourceTranscriptDocumentId:\s*transcript\.id/);
  assert.match(summaryRoute, /sourceDocuments:\s*\{/);
  assert.doesNotMatch(summaryRoute, /readStoredDocument/);
  assert.match(summaryRoute, /generateTranscriptSummaryContent\(\{\s*transcriptText,/);
});

test("summary and transcription endpoints do not expose provider error messages", () => {
  const server = read("lib/documents/server.js");
  const safeError = read("lib/privacy/safeError.js");
  const summaryRoute = read("app/api/documents/[id]/summary/route.js");
  const transcriptionRoute = read("app/api/documents/[id]/transcribe/route.js");

  assert.match(server, /publicErrorMessageKey/);
  assert.match(server, /publicErrorStatus/);
  assert.match(safeError, /redacted-api-key/);
  assert.match(summaryRoute, /publicErrorMessageKey\(error,\s*"documents\.errors\.summary_failed"\)/);
  assert.match(transcriptionRoute, /publicErrorMessageKey\(error,\s*"documents\.errors\.transcription_failed"\)/);
  assert.doesNotMatch(summaryRoute, /error\?\.(message|status)[\s\S]{0,80}documents\.errors\.summary_failed/);
  assert.doesNotMatch(transcriptionRoute, /error\?\.(message|status)[\s\S]{0,80}documents\.errors\.transcription_failed/);
});
