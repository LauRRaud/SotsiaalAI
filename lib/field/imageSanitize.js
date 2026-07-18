/**
 * FIELD-V1 image safety (doc ptk 5): only JPEG/PNG photos are accepted and
 * every metadata segment that can carry EXIF/GPS/XMP is stripped server-side
 * as a backstop — the client canvas re-encode is the first line, this is the
 * guarantee. Pure buffer manipulation, no dependencies.
 */

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const FIELD_PHOTO_MIMES = Object.freeze(["image/jpeg", "image/png"]);

export function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  return null;
}

export function assertFieldPhotoSignature(buffer, declaredMime = "") {
  const sniffed = sniffImageMime(buffer);
  if (!sniffed) {
    const error = new Error("field.errors.invalid_photo");
    error.status = 400;
    throw error;
  }
  const declared = String(declaredMime || "").toLowerCase().trim();
  if (declared && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg")) {
    const error = new Error("field.errors.invalid_photo");
    error.status = 400;
    throw error;
  }
  return sniffed;
}

/**
 * Remove JPEG metadata segments: APP1 (EXIF/XMP, incl. GPS), APP2 (ICC beside
 * the color profile is safe to drop for evidence photos), APP13 (IPTC) and
 * COM comments. Keeps APP0 (JFIF) so the file stays broadly decodable.
 */
export function stripJpegMetadata(buffer) {
  if (!buffer.subarray(0, 3).equals(JPEG_MAGIC)) return buffer;
  const kept = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    // Start of scan: everything from here on is entropy-coded image data.
    if (marker === 0xda) {
      kept.push(buffer.subarray(offset));
      return Buffer.concat(kept);
    }
    // Standalone markers without a length field.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    const isMetadata =
      marker === 0xe1 || // APP1: EXIF + GPS + XMP
      marker === 0xe2 || // APP2: ICC/FlashPix
      marker === 0xed || // APP13: Photoshop/IPTC
      marker === 0xfe; // COM
    if (!isMetadata) kept.push(buffer.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  // Malformed tail: keep the remainder untouched rather than truncating.
  kept.push(buffer.subarray(offset));
  return Buffer.concat(kept);
}

const PNG_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** Remove PNG ancillary text/EXIF chunks; critical chunks pass through. */
export function stripPngMetadata(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) return buffer;
  const kept = [buffer.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("latin1");
    const total = 12 + length;
    if (offset + total > buffer.length) break;
    if (!PNG_METADATA_CHUNKS.has(type)) kept.push(buffer.subarray(offset, offset + total));
    offset += total;
    if (type === "IEND") break;
  }
  return Buffer.concat(kept);
}

export function sanitizeFieldPhoto(buffer, declaredMime = "") {
  const mime = assertFieldPhotoSignature(buffer, declaredMime);
  const cleaned = mime === "image/jpeg" ? stripJpegMetadata(buffer) : stripPngMetadata(buffer);
  return { mime, buffer: cleaned };
}
