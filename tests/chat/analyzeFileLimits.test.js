import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeMimeConflict, resolveAnalyzeMimeType } from "../../lib/chat/analyzeFileConfig.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

/**
 * SOL-CHAT-09 — deklareeritud MIME ei vali parserit, ja vastus ei ole piiramatu.
 *
 * `resolveAnalyzeMimeType()` valib tüübi kolme KLIENDI antud kandidaadi seast; ükski neist ei ole
 * tõend. Siin mõõdetakse teist väravat: kas sisu deklaratsiooni kinnitab. RAG-teenuse pool on
 * kaetud `rag-service/test_upload_limits.py`-s (12 testi) — kaks protsessi, kaks väravat.
 */

const bytes = (...values) => Uint8Array.from(values);
const ascii = (text) => new TextEncoder().encode(text);
const PDF_HEAD = ascii("%PDF-1.7\nstartxref");
const ZIP_HEAD = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00);
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

test("resolveAnalyzeMimeType valib endiselt kliendi kandidaatide seast — see EI OLE tõend", () => {
  // Leiu lähtekoht: kõik kolm sisendit tulevad kliendilt.
  assert.equal(
    resolveAnalyzeMimeType({ mimeTypeFromRequest: "text/plain", fileName: "pomm.zip" }),
    "text/plain"
  );
});

test("deklareeritud text/plain koos konteineri sisuga lükatakse tagasi", () => {
  // SEE OLI RÜNNAK: vali ise parser, saada ZIP-pomm.
  assert.equal(analyzeMimeConflict(ZIP_HEAD, "text/plain"), "declared_text_but_content_is_a_container");
  assert.equal(analyzeMimeConflict(PDF_HEAD, "text/markdown"), "declared_text_but_content_is_a_container");
});

test("deklareeritud PDF ja DOCX peavad sisu järgi paika pidama", () => {
  assert.equal(analyzeMimeConflict(PDF_HEAD, "application/pdf"), null);
  assert.equal(analyzeMimeConflict(ascii("tavaline tekst"), "application/pdf"), "declared_pdf_but_content_is_not_pdf");
  assert.equal(analyzeMimeConflict(ZIP_HEAD, DOCX), null);
  assert.equal(analyzeMimeConflict(ascii("tekst"), DOCX), "declared_docx_but_content_is_not_zip");
});

test("binaarne sisu ei kinnita tekstideklaratsiooni ja tühi fail ei lähe läbi", () => {
  assert.equal(analyzeMimeConflict(bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x01), "text/plain"), "declared_text_but_content_is_binary");
  assert.equal(analyzeMimeConflict(new Uint8Array(), "text/plain"), "empty_file");
  assert.equal(analyzeMimeConflict(PDF_HEAD, ""), "missing_declared_mime");
});

test("NEGATIIVKONTROLL: lubatud sisendid peavad läbi minema", () => {
  // Ilma selleta tõendaks „lükka kõik tagasi" sama hästi kui õige kontroll.
  assert.equal(analyzeMimeConflict(ascii("Tere, see on tekst õäöü"), "text/plain"), null);
  assert.equal(analyzeMimeConflict(ascii("<!DOCTYPE html><html>"), "text/html"), null);
});

test("marsruut kontrollib sisu ENNE edasisaatmist ja loeb vastust lae all", () => {
  const source = read("app/api/chat/analyze-file/route.js");

  const conflictGate = source.indexOf("analyzeMimeConflict(headBytes");
  const forward = source.indexOf("new FormData()");
  assert.ok(conflictGate > 0, "sisu kontroll peab marsruudil olemas olema");
  assert.ok(conflictGate < forward, "kontroll peab olema ENNE faili edasisaatmist");
  assert.match(source, /analyzeMimeConflict\(headBytes, resolvedMimeType\)[\s\S]*?mime_not_allowed", 415/);

  // Vastuse lugemine on lae all ja ületamine on viga, mitte vaikne kärbe.
  assert.match(source, /const text = await readBoundedText\(res\)/);
  assert.match(source, /ANALYZE_RESPONSE_MAX_BYTES[\s\S]*?response_too_large/);
  assert.ok(!/const text = await res\.text\(\);/.test(source), "piiramatu lugemine oli leiu osa");
});

test("RAG-teenuse pool on kaetud oma testidega ja `/analyze` leping on versioonitud", () => {
  const python = read("rag-service/main.py");
  assert.match(python, /conflict = mime_conflict\(mime, raw, file\.filename or ""\)/);
  assert.match(python, /zip_ok, zip_reason, _zip_total = zip_expansion_guard\(raw\)/);
  assert.match(python, /pages, pages_truncated = clamp_pages\(pages\)/);
  assert.match(python, /"analyzeContract": "v2"/);
  assert.match(python, /"fullText": full_text/);
  assert.ok(!/"fullText": raw_text/.test(python), "kärpimata fullText oli leiu osa");

  const tests = read("rag-service/test_upload_limits.py");
  assert.match(tests, /def test_zip_bomb_is_rejected_by_ratio_before_extraction/);
  assert.match(tests, /def test_negative_control_allowed_inputs_still_pass/);
});
