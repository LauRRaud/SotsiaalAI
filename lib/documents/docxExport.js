import zlib from "node:zlib"
import {
  MAX_DOCX_TEMPLATE_ENTRIES,
  MAX_DOCX_TEMPLATE_TOTAL_UNCOMPRESSED_BYTES
} from "./constants.js"

const ZIP_LOCAL_FILE_HEADER = 0x04034b50
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const DOCX_XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

let crcTable = null

function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    crcTable[index] = value >>> 0
  }
  return crcTable
}

function crc32(buffer) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toDosDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now())
  const year = Math.max(1980, date.getFullYear())
  const month = Math.max(1, date.getMonth() + 1)
  const day = Math.max(1, date.getDate())
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)

  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  return { dosDate, dosTime }
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\u0000")
    .join("")
    .trim()
}

function toWordParagraphs(text, options = {}) {
  const normalized = normalizeText(text)
  if (!normalized) {
    return "<w:p/>"
  }

  const styleXml = options.styleId
    ? `<w:pPr><w:pStyle w:val="${escapeXml(options.styleId)}"/></w:pPr>`
    : ""

  return normalized
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<w:p/>"
      return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    })
    .join("")
}

function buildSourcesBlock(sources = []) {
  if (!Array.isArray(sources) || !sources.length) {
    return `${toWordParagraphs("Sources", { styleId: "Heading2" })}${toWordParagraphs("No source documents linked.")}`
  }

  return [
    toWordParagraphs("Sources", { styleId: "Heading2" }),
    ...sources.map((source) =>
      toWordParagraphs(`- ${source.title || source.originalName}${source.originalName ? ` (${source.originalName})` : ""}`)
    )
  ].join("")
}

function buildArtifactBodyXml({ artifact, approvedAtLabel, sources }) {
  const title = artifact.title || String(artifact.type || "Artifact").replace(/_/g, " ")
  const metaLines = [
    `Type: ${String(artifact.type || "").replace(/_/g, " ")}`,
    artifact.approvedAt ? `Approved: ${approvedAtLabel}` : null
  ].filter(Boolean)

  return [
    toWordParagraphs(title, { styleId: "Title" }),
    ...metaLines.map((line) => toWordParagraphs(line)),
    toWordParagraphs("Content", { styleId: "Heading2" }),
    toWordParagraphs(artifact.content),
    buildSourcesBlock(sources)
  ].join("")
}

function buildStandardDocumentXml({ artifact, approvedAtLabel, sources }) {
  const body = buildArtifactBodyXml({ artifact, approvedAtLabel, sources })
  return `${DOCX_XML_HEADER}
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" mc:Ignorable="w14 w15">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function buildCoreXml({ title, approvedAtLabel }) {
  const nowIso = new Date().toISOString()
  return `${DOCX_XML_HEADER}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>SotsiaalAI</dc:creator>
  <cp:lastModifiedBy>SotsiaalAI</cp:lastModifiedBy>
  <dc:description>${escapeXml(`Approved artifact ${approvedAtLabel || ""}`.trim())}</dc:description>
  <cp:revision>1</cp:revision>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`
}

function buildAppXml() {
  return `${DOCX_XML_HEADER}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>SotsiaalAI</Application>
</Properties>`
}

function buildContentTypesXml() {
  return `${DOCX_XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
}

function buildRootRelationshipsXml() {
  return `${DOCX_XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function buildDocumentRelationshipsXml() {
  return `${DOCX_XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildStylesXml() {
  return `${DOCX_XML_HEADER}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`
}

function buildStandardDocxEntries(context) {
  const title = context.artifact.title || String(context.artifact.type || "Artifact").replace(/_/g, " ")
  return [
    { name: "[Content_Types].xml", data: buildContentTypesXml() },
    { name: "_rels/.rels", data: buildRootRelationshipsXml() },
    { name: "docProps/app.xml", data: buildAppXml() },
    { name: "docProps/core.xml", data: buildCoreXml({ title, approvedAtLabel: context.approvedAtLabel }) },
    { name: "word/document.xml", data: buildStandardDocumentXml(context) },
    { name: "word/_rels/document.xml.rels", data: buildDocumentRelationshipsXml() },
    { name: "word/styles.xml", data: buildStylesXml() }
  ]
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset
    }
  }
  throw new Error("Invalid ZIP: end of central directory not found")
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  if (totalEntries > MAX_DOCX_TEMPLATE_ENTRIES) {
    throw new Error("Template ZIP has too many entries")
  }
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries = []
  let cursor = centralDirectoryOffset
  let totalUncompressed = 0

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Invalid ZIP: central directory header missing")
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const fileNameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8")

    if (buffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error("Invalid ZIP: local file header missing")
    }

    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_DOCX_TEMPLATE_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error("Template ZIP is too large when unpacked")
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)

    let data
    if (compressionMethod === 0) {
      data = Buffer.from(compressed)
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressed)
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`)
    }

    entries.push({ name, data })
    cursor += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function writeZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const now = new Date()

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8")
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8")
    const compressed = zlib.deflateRawSync(dataBuffer)
    const crc = crc32(dataBuffer)
    const { dosDate, dosTime } = toDosDateTime(now)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(dataBuffer.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBuffer, compressed)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(dataBuffer.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, nameBuffer)

    offset += localHeader.length + nameBuffer.length + compressed.length
  }

  const centralDirectoryOffset = offset
  const centralDirectory = Buffer.concat(centralParts)
  const localDirectory = Buffer.concat(localParts)
  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(centralDirectoryOffset, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([localDirectory, centralDirectory, endRecord])
}

function replaceTemplateDocumentXml(documentXml, context) {
  const normalizedDocumentXml = normalizeTemplatePlaceholders(documentXml)
  const title = escapeXml(context.artifact.title || String(context.artifact.type || "Artifact").replace(/_/g, " "))
  const approvedAtLabel = escapeXml(context.approvedAtLabel)
  const artifactType = escapeXml(String(context.artifact.type || "").replace(/_/g, " "))
  const contentBlock = toWordParagraphs(context.artifact.content)
  const sourcesBlock = buildSourcesBlock(context.sources)

  let output = normalizedDocumentXml
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{APPROVED_AT\}\}/g, approvedAtLabel)
    .replace(/\{\{ARTIFACT_TYPE\}\}/g, artifactType)

  const contentBlockPattern = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?\{\{CONTENT_BLOCK\}\}(?:(?!<w:p\b)[\s\S])*?<\/w:p>/
  if (contentBlockPattern.test(output)) {
    output = output.replace(contentBlockPattern, contentBlock)
  } else {
    output = output.replace("</w:body>", `${contentBlock}</w:body>`)
  }

  const sourcesBlockPattern = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?\{\{SOURCES_BLOCK\}\}(?:(?!<w:p\b)[\s\S])*?<\/w:p>/
  if (sourcesBlockPattern.test(output)) {
    output = output.replace(sourcesBlockPattern, sourcesBlock)
  } else {
    output = output.replace("</w:body>", `${sourcesBlock}</w:body>`)
  }

  return output
}

function normalizeTemplatePlaceholders(documentXml) {
  let output = String(documentXml || "")
  const placeholders = [
    "{{TITLE}}",
    "{{APPROVED_AT}}",
    "{{ARTIFACT_TYPE}}",
    "{{CONTENT_BLOCK}}",
    "{{SOURCES_BLOCK}}"
  ]

  for (const placeholder of placeholders) {
    output = collapseSplitPlaceholder(output, placeholder)
  }

  return output
}

function collapseSplitPlaceholder(documentXml, placeholder) {
  const chars = Array.from(placeholder).map((char) => escapeRegExp(char))
  const splitPattern = chars.join("(?:</w:t></w:r>[\\s\\S]*?<w:r[^>]*><w:t[^>]*>)?")
  const regex = new RegExp(splitPattern, "g")
  return documentXml.replace(regex, placeholder)
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildTemplateBasedDocx(templateBuffer, context) {
  const entries = readZipEntries(templateBuffer)
  let replaced = false
  const nextEntries = entries.map((entry) => {
    if (entry.name !== "word/document.xml") return entry
    replaced = true
    return {
      name: entry.name,
      data: Buffer.from(replaceTemplateDocumentXml(entry.data.toString("utf8"), context), "utf8")
    }
  })

  if (!replaced) {
    throw new Error("Template does not contain word/document.xml")
  }

  return writeZip(nextEntries)
}

export function createArtifactDocxBuffer({ artifact, sources = [], templateBuffer = null }) {
  const approvedAtLabel = artifact.approvedAt
    ? new Date(artifact.approvedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const context = {
    artifact,
    sources,
    approvedAtLabel
  }

  if (templateBuffer) {
    try {
      return buildTemplateBasedDocx(templateBuffer, context)
    } catch (error) {
      console.error("[documents] template docx export failed, using fallback", error)
    }
  }

  return writeZip(
    buildStandardDocxEntries(context).map((entry) => ({
      name: entry.name,
      data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8")
    }))
  )
}
