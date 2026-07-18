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

test("PDF export fails closed for text the current generator cannot represent", () => {
  assert.equal(isPdfTextSupported("Latin basic text 123"), true);
  assert.equal(isPdfTextSupported("Šokis"), false);
  assert.equal(isPdfTextSupported("Привет"), false);
  assert.match(createPdfBufferFromText("Latin basic text 123").subarray(0, 8).toString("ascii"), /^%PDF-1\.4/);
  assert.throws(() => createPdfBufferFromText("Привет"), { code: "PDF_UNSUPPORTED_TEXT" });
});
