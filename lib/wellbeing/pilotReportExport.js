const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const year = Math.max(1980, date.getFullYear());
  const month = Math.max(1, date.getMonth() + 1);
  const day = Math.max(1, date.getDate());
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

function writeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = toDosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, endRecord]);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function percent(value, sampleSize) {
  const count = Number(value || 0);
  const total = Number(sampleSize || 0);
  if (!total) return "0%";
  return `${Math.round((count / total) * 1000) / 10}%`;
}

function filterSummary(filters = {}) {
  return [
    filters.roleGroup ? `Rolligrupp: ${filters.roleGroup}` : null,
    filters.workflowType ? `Töövoog: ${filters.workflowType}` : null,
    filters.periodStart ? `Algus: ${filters.periodStart}` : null,
    filters.periodEnd ? `Lõpp: ${filters.periodEnd}` : null
  ].filter(Boolean).join(" | ");
}

export function exportWellbeingPilotReportHtml(report = {}, options = {}) {
  const priorities = report.priorities || [];
  const agreements = report.recommendedAgreements || [];
  const filters = filterSummary(options.filters);

  return `<!doctype html>
<html lang="et">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KOV piloodi aruanne</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f5f2; color: #1d1d1f; }
    main { max-width: 980px; margin: 0 auto; padding: 40px 28px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    p { line-height: 1.5; }
    .muted { color: #65615d; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }
    .card { border: 1px solid #ddd6ce; border-radius: 8px; background: #fff; padding: 14px; }
    .decision { border-left: 5px solid #9c5c63; background: #fff; padding: 16px 18px; margin: 22px 0; }
    .kpi { font-size: 26px; font-weight: 750; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #ddd6ce; }
    th, td { border-top: 1px solid #e6ded5; padding: 9px 10px; text-align: left; vertical-align: top; }
    th { background: #ede7df; font-size: 13px; }
    @media print {
      body { background: #fff; }
      main { padding: 0; max-width: none; }
      .card, table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <h1>KOV piloodi aruanne</h1>
    <p class="muted">${escapeHtml(filters || "Kõik lubatud piloodi andmed")}</p>
    <p>${escapeHtml(report.privacyNotice || "")}</p>
    <section class="decision">
      <div class="muted">Otsustaja kokkuvõte</div>
      <h2>${escapeHtml(report.executiveSummary?.statusLabel || "Koondseis")}</h2>
      <p>${escapeHtml(report.decisionSummary || "")}</p>
      ${report.primaryRecommendation ? `<p><strong>Esimene kokkulepe:</strong> ${escapeHtml(report.primaryRecommendation.title)}. ${escapeHtml(report.primaryRecommendation.description)}</p>` : ""}
    </section>
    <div class="grid">
      <section class="card"><div class="muted">Valim</div><div class="kpi">${escapeHtml(report.sampleSize ?? "-")}</div></section>
      <section class="card"><div class="muted">Kirjeid</div><div class="kpi">${escapeHtml(report.recordCount ?? "-")}</div></section>
      <section class="card"><div class="muted">Punased</div><div class="kpi">${escapeHtml(report.signal?.redCount ?? 0)}</div></section>
      <section class="card"><div class="muted">Kollased</div><div class="kpi">${escapeHtml(report.signal?.yellowCount ?? 0)}</div></section>
    </div>
    <h2>Töökorralduslikud prioriteedid</h2>
    <table>
      <thead><tr><th>Kategooria</th><th>Prioriteet</th><th>Esinemus</th><th>Osakaal</th></tr></thead>
      <tbody>${priorities.map((item) => `<tr><td>${escapeHtml(item.categoryLabel)}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.count)}/${escapeHtml(item.sampleSize)}</td><td>${escapeHtml(percent(item.count, item.sampleSize))}</td></tr>`).join("")}</tbody>
    </table>
    <h2>Soovitatavad kokkulepped</h2>
    <table>
      <thead><tr><th>Kokkulepe</th><th>Mida teha</th></tr></thead>
      <tbody>${agreements.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.description)}</td></tr>`).join("")}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function cell(value) {
  return `<c t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function row(values) {
  return `<row>${values.map((value) => cell(value)).join("")}</row>`;
}

function worksheet(rows) {
  return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.map((values) => row(values)).join("\n")}
  </sheetData>
</worksheet>`;
}

function workbookXml() {
  return `${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Aruanne" sheetId="1" r:id="rId1"/>
    <sheet name="Prioriteedid" sheetId="2" r:id="rId2"/>
    <sheet name="Kokkulepped" sheetId="3" r:id="rId3"/>
    <sheet name="Mõõdikud" sheetId="4" r:id="rId4"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
}

export function exportWellbeingPilotReportXlsx(report = {}, options = {}) {
  const dataset = options.dataset || {};
  const metrics = dataset.metrics || [];
  const priorities = report.priorities || [];
  const agreements = report.recommendedAgreements || [];

  const entries = [
    { name: "[Content_Types].xml", data: contentTypesXml() },
    { name: "_rels/.rels", data: rootRelsXml() },
    { name: "xl/workbook.xml", data: workbookXml() },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml() },
    {
      name: "xl/worksheets/sheet1.xml",
      data: worksheet([
        ["KOV piloodi aruanne"],
        ["Valim", report.sampleSize],
        ["Kirjeid", report.recordCount],
        ["Miinimumgrupp", report.minimumGroupSize],
        ["Punased", report.signal?.redCount || 0],
        ["Kollased", report.signal?.yellowCount || 0],
        ["Rohelised", report.signal?.greenCount || 0],
        ["Privaatsus", report.privacyNotice || ""]
      ])
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: worksheet([
        ["Kategooria", "Prioriteet", "Esinemus", "Valim"],
        ...priorities.map((item) => [item.categoryLabel, item.label, item.count, item.sampleSize])
      ])
    },
    {
      name: "xl/worksheets/sheet3.xml",
      data: worksheet([
        ["Kokkulepe", "Kirjeldus"],
        ...agreements.map((item) => [item.title, item.description])
      ])
    },
    {
      name: "xl/worksheets/sheet4.xml",
      data: worksheet([
        ["metricKey", "metricValue", "sampleSize", "aggregationLevel", "exportEligible"],
        ...metrics.map((item) => [item.metricKey, item.metricValue, item.sampleSize, item.aggregationLevel, item.exportEligible])
      ])
    }
  ];

  return writeZip(entries);
}
