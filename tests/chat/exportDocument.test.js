import assert from "node:assert/strict";
import zlib from "node:zlib";
import test from "node:test";

import {
  createChatDocxBuffer,
  createPdfBufferFromText,
  isPdfTextSupported
} from "../../lib/chat/exportDocument.js";

function readStoredZipEntry(buffer, expectedName) {
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (name === expectedName) {
      return compressionMethod === 8 ? zlib.inflateRawSync(compressed) : compressed;
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

test("chat Word export is a DOCX ZIP and preserves Estonian and Cyrillic text", () => {
  const docx = createChatDocxBuffer("Šokis žest: Привет", "SotsiaalAI summary");
  const documentXml = readStoredZipEntry(docx, "word/document.xml");

  assert.equal(docx.subarray(0, 2).toString("ascii"), "PK");
  assert.ok(documentXml);
  assert.match(documentXml.toString("utf8"), /Šokis žest: Привет/);
});

test("PDF export renders full Estonian via WinAnsi and still fails closed for Cyrillic", () => {
  assert.equal(isPdfTextSupported("Latin basic text 123"), true);
  // Full Estonian is now representable: õäöü (were wrong-glyph) AND š ž (were 409).
  assert.equal(isPdfTextSupported("Šokis žest põõsas üü"), true);
  // No WinAnsi glyphs for these -> still fail closed.
  assert.equal(isPdfTextSupported("Привет"), false);
  assert.equal(isPdfTextSupported("日本語"), false);

  const pdf = createPdfBufferFromText("šžõäöü");
  const latin1 = pdf.toString("latin1");
  assert.match(latin1.slice(0, 8), /^%PDF-1\.4/);
  // The font must declare WinAnsiEncoding, else the viewer draws StandardEncoding glyphs.
  assert.ok(latin1.includes("/Encoding /WinAnsiEncoding"), "font declares WinAnsiEncoding");
  // Estonian letters encode to their cp1252 bytes (š=9A ž=9E õ=F5 ä=E4 ö=F6 ü=FC),
  // not latin1 low-byte truncations (which would turn š into 'a').
  assert.ok(latin1.includes("\x9A\x9E\xF5\xE4\xF6\xFC"), "cp1252 byte sequence present");

  assert.throws(() => createPdfBufferFromText("Привет"), { code: "PDF_UNSUPPORTED_TEXT" });
});
