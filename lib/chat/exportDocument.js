const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN_X = 54;
const PDF_MARGIN_Y = 54;
const PDF_FONT_SIZE = 11;
const PDF_LINE_HEIGHT = 14;
const PDF_LINES_PER_PAGE = Math.max(
  1,
  Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN_Y * 2) / PDF_LINE_HEIGHT)
);
const PDF_MAX_LINE_CHARS = 92;

function normalizeLineValue(value) {
  const raw = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ");
  if (!raw) return "";
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code === 10) {
      out += "\n";
      continue;
    }
    if (code >= 32 && code <= 255) {
      out += raw[i];
      continue;
    }
    out += "?";
  }
  return out;
}

function escapePdfText(value) {
  return normalizeLineValue(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text, maxChars = PDF_MAX_LINE_CHARS) {
  const normalized = normalizeLineValue(text);
  if (!normalized.trim()) return ["(empty)"];
  const lines = [];
  const paragraphs = normalized.split("\n");
  for (const paragraph of paragraphs) {
    const source = paragraph.trimEnd();
    if (!source.trim()) {
      lines.push("");
      continue;
    }
    const words = source.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!word) continue;
      if (!current) {
        if (word.length <= maxChars) {
          current = word;
          continue;
        }
        let start = 0;
        while (start < word.length) {
          lines.push(word.slice(start, start + maxChars));
          start += maxChars;
        }
        continue;
      }
      if (current.length + 1 + word.length <= maxChars) {
        current = `${current} ${word}`;
        continue;
      }
      lines.push(current);
      if (word.length <= maxChars) {
        current = word;
        continue;
      }
      let start = 0;
      while (start < word.length) {
        lines.push(word.slice(start, start + maxChars));
        start += maxChars;
      }
      current = "";
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["(empty)"];
}

function makePdfStream(lines) {
  const safeLines = Array.isArray(lines) && lines.length ? lines : ["(empty)"];
  let body = "";
  body += "BT\n";
  body += `/F1 ${PDF_FONT_SIZE} Tf\n`;
  body += `${PDF_LINE_HEIGHT} TL\n`;
  body += `${PDF_MARGIN_X} ${PDF_PAGE_HEIGHT - PDF_MARGIN_Y} Td\n`;
  for (let i = 0; i < safeLines.length; i += 1) {
    const line = escapePdfText(safeLines[i]);
    if (i > 0) body += "T*\n";
    body += `(${line}) Tj\n`;
  }
  body += "ET\n";
  return Buffer.from(body, "latin1");
}

function buildPdfObjects(pages) {
  const objects = [];
  objects.push({
    id: 1,
    data: Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1")
  });

  const kids = [];
  const pageObjectStart = 4;
  for (let i = 0; i < pages.length; i += 1) {
    const pageObjId = pageObjectStart + i * 2;
    kids.push(`${pageObjId} 0 R`);
  }
  objects.push({
    id: 2,
    data: Buffer.from(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`, "latin1")
  });
  objects.push({
    id: 3,
    data: Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1")
  });

  for (let i = 0; i < pages.length; i += 1) {
    const pageObjId = pageObjectStart + i * 2;
    const contentObjId = pageObjId + 1;
    const content = pages[i];
    objects.push({
      id: pageObjId,
      data: Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>`,
        "latin1"
      )
    });
    const streamHeader = Buffer.from(
      `<< /Length ${content.length} >>\nstream\n`,
      "latin1"
    );
    const streamFooter = Buffer.from("endstream", "latin1");
    objects.push({
      id: contentObjId,
      data: Buffer.concat([streamHeader, content, streamFooter])
    });
  }
  return objects;
}

export function createPdfBufferFromText(text) {
  const lines = wrapText(text);
  const pages = [];
  for (let i = 0; i < lines.length; i += PDF_LINES_PER_PAGE) {
    pages.push(makePdfStream(lines.slice(i, i + PDF_LINES_PER_PAGE)));
  }
  if (!pages.length) {
    pages.push(makePdfStream(["(empty)"]));
  }

  const objects = buildPdfObjects(pages);
  const sorted = [...objects].sort((a, b) => a.id - b.id);
  const maxId = sorted[sorted.length - 1]?.id || 0;
  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary");
  const chunks = [header];
  const offsets = new Array(maxId + 1).fill(0);
  let offset = header.length;

  for (const obj of sorted) {
    const head = Buffer.from(`${obj.id} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    offsets[obj.id] = offset;
    chunks.push(head, obj.data, tail);
    offset += head.length + obj.data.length + tail.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${maxId + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= maxId; i += 1) {
    const value = String(offsets[i] || 0).padStart(10, "0");
    xref += `${value} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"), Buffer.from(trailer, "latin1"));
  return Buffer.concat(chunks);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createWordBufferFromText(text, title = "SotsiaalAI Document") {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(
    String(text ?? "").replace(/\r\n?/g, "\n").trim() || "(empty)"
  ).replace(/\n/g, "<br/>");
  const html = [
    "<html>",
    "<head>",
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>',
    `<title>${safeTitle}</title>`,
    "</head>",
    "<body>",
    `<h1>${safeTitle}</h1>`,
    `<p>${safeBody}</p>`,
    "</body>",
    "</html>"
  ].join("");
  return Buffer.from(html, "utf8");
}

