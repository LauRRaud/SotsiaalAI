import crypto from "node:crypto";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

// A small store-only ZIP writer keeps the copy portable without introducing a
// broad archive dependency. Files arrive in bounded batches in the export job.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const value = date instanceof Date ? date : new Date(date);
  const year = Math.max(1980, value.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((value.getUTCMonth() + 1) << 5) | value.getUTCDate(),
    time: (value.getUTCHours() << 11) | (value.getUTCMinutes() << 5) | Math.floor(value.getUTCSeconds() / 2)
  };
}

export function buildPortableZip(entries = [], now = new Date()) {
  const files = [];
  const central = [];
  let offset = 0;
  const { date, time } = dosDateTime(now);

  for (const entry of entries) {
    const name = String(entry?.name || "").replace(/\\/g, "/");
    if (!name || name.startsWith("/") || name.includes("../")) throw new Error("data_export.invalid_entry_name");
    const nameBuffer = Buffer.from(name, "utf8");
    const content = Buffer.isBuffer(entry?.content) ? entry.content : Buffer.from(entry?.content || "");
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_FILE_HEADER, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    files.push(local, nameBuffer, content);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(CENTRAL_FILE_HEADER, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(time, 12);
    directory.writeUInt16LE(date, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(content.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(nameBuffer.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBuffer);
    offset += local.length + nameBuffer.length + content.length;
  }

  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const ending = Buffer.alloc(22);
  ending.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  ending.writeUInt16LE(0, 4);
  ending.writeUInt16LE(0, 6);
  ending.writeUInt16LE(entries.length, 8);
  ending.writeUInt16LE(entries.length, 10);
  ending.writeUInt32LE(centralSize, 12);
  ending.writeUInt32LE(offset, 16);
  ending.writeUInt16LE(0, 20);
  return Buffer.concat([...files, ...central, ending]);
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
