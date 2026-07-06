import crypto from "node:crypto";

const DEFAULT_PARAGRAPH_MAX_CHARS = 2400;
const DEFAULT_SUBSECTION_MAX_CHARS = 1400;
const SECTION_SIGN = "\u00A7";
const CHAPTER_LABEL = "peat\u00fckk";

function cleanTagName(tagName = "") {
  return String(tagName || "").trim().replace(/^.*:/, "");
}

function decodeXmlEntities(text = "") {
  return String(text || "").replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    const normalized = String(entity || "").trim().toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return "\"";
    if (normalized === "apos") return "'";
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return match;
  });
}

function normalizeInlineWhitespace(text = "") {
  return decodeXmlEntities(String(text || ""))
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeChunkBodyText(text = "") {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseXmlTree(xmlText = "") {
  const xml = String(xmlText || "").replace(/^\uFEFF/, "");
  const root = { name: "#document", children: [], textParts: [] };
  const stack = [root];
  const tokenRe = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([^>\s]+)\s*>|<([^>\s/]+)(?:[^<>]*?)\/>|<([^>\s/]+)(?:[^<>]*?)>|([^<]+)/g;

  let match;
  while ((match = tokenRe.exec(xml))) {
    if (match[1] != null) {
      stack[stack.length - 1].textParts.push(match[1]);
      continue;
    }

    if (match[2]) {
      const closingName = cleanTagName(match[2]);
      while (stack.length > 1) {
        const node = stack.pop();
        if (node?.name === closingName) break;
      }
      continue;
    }

    if (match[3]) {
      stack[stack.length - 1].children.push({
        name: cleanTagName(match[3]),
        children: [],
        textParts: []
      });
      continue;
    }

    if (match[4]) {
      const node = {
        name: cleanTagName(match[4]),
        children: [],
        textParts: []
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    if (match[5]) {
      stack[stack.length - 1].textParts.push(match[5]);
    }
  }

  return root;
}

function childElements(node, name = null) {
  const target = name ? String(name).trim() : null;
  const children = Array.isArray(node?.children) ? node.children : [];
  return target ? children.filter(child => child?.name === target) : children.slice();
}

function firstChild(node, name) {
  return childElements(node, name)[0] || null;
}

function textContent(node) {
  if (!node) return "";

  const textParts = Array.isArray(node.textParts) ? node.textParts.slice() : [];
  const children = Array.isArray(node.children) ? node.children : [];
  let combined = textParts.join(" ");

  for (const child of children) {
    const childText = textContent(child);
    if (!childText) continue;
    combined = combined ? `${combined} ${childText}` : childText;
  }

  return normalizeInlineWhitespace(combined);
}

function readDirectBodyText(node, excludedChildNames = []) {
  if (!node) return "";

  const excluded = new Set((excludedChildNames || []).map(value => String(value).trim()));
  const texts = [];

  for (const child of childElements(node)) {
    if (excluded.has(child.name)) continue;
    if (child.name === "sisuTekst" || child.name === "tavatekst") {
      const value = textContent(child);
      if (value) texts.push(value);
    }
  }

  return normalizeInlineWhitespace(texts.join(" "));
}

function municipalityFromIssuer(issuer = "", fallback = "") {
  const normalizedIssuer = normalizeInlineWhitespace(issuer);
  if (!normalizedIssuer) return normalizeInlineWhitespace(fallback);

  const municipalityMatch = normalizedIssuer.match(/^(.+?)\s+Vallavolikogu$/i);
  if (municipalityMatch?.[1]) return `${municipalityMatch[1].trim()} vald`;

  const cityMatch = normalizedIssuer.match(/^(.+?)\s+Linnavolikogu$/i);
  if (cityMatch?.[1]) return `${cityMatch[1].trim()} linn`;

  return normalizeInlineWhitespace(fallback) || normalizedIssuer;
}

function isMunicipalIssuer(issuer = "") {
  return /\b(Vallavolikogu|Linnavolikogu)\b/i.test(normalizeInlineWhitespace(issuer));
}

function slugifyMunicipalityId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableShortHash(text = "") {
  return crypto.createHash("sha1").update(String(text || ""), "utf8").digest("hex").slice(0, 12);
}

function dateOnly(value = "") {
  const text = normalizeInlineWhitespace(value);
  if (!text) return null;
  const matched = text.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0] : null;
}

function todayDateOnly(now = new Date()) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return date.toISOString().slice(0, 10);
}

function isCurrentOnDate(effectiveEnd, now = new Date()) {
  const endDate = dateOnly(effectiveEnd);
  if (!endDate) return true;
  return endDate >= todayDateOnly(now);
}

function stableChunkKey(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `chunk-${stableShortHash(value)}`;
}

function paragraphHeading(paragraph) {
  const number = normalizeInlineWhitespace(paragraph?.number);
  const title = normalizeInlineWhitespace(paragraph?.title);

  if (number && title) return `${SECTION_SIGN} ${number}. ${title}`;
  if (number) return `${SECTION_SIGN} ${number}`;
  return title || SECTION_SIGN;
}

function chapterHeading(chapter) {
  const number = normalizeInlineWhitespace(chapter?.number);
  const title = normalizeInlineWhitespace(chapter?.title);

  if (number && title) return `${number}. ${CHAPTER_LABEL} - ${title}`;
  if (number) return `${number}. ${CHAPTER_LABEL}`;
  return title || "";
}

function structuralSectionHeading(section) {
  const number = normalizeInlineWhitespace(section?.number);
  const label = normalizeInlineWhitespace(section?.label);
  const title = normalizeInlineWhitespace(section?.title);
  const prefix = label || (number ? `${number}. jagu` : "");

  if (prefix && title) return `${prefix} - ${title}`;
  return title || prefix || "";
}

function paragraphSectionTitle(paragraph, chapter) {
  return normalizeInlineWhitespace(paragraph?.sectionTitle || chapter?.title || chapter?.number || "");
}

function paragraphTitleForSearch(paragraph) {
  const number = normalizeInlineWhitespace(paragraph?.number);
  const title = normalizeInlineWhitespace(paragraph?.title);
  if (number && title) return `${SECTION_SIGN} ${number} ${title}`;
  if (number) return `${SECTION_SIGN} ${number}`;
  return title || "";
}

function renderPointLine(point) {
  const number = normalizeInlineWhitespace(point?.number);
  const body = normalizeInlineWhitespace(point?.body);

  if (number && body) return `${number}) ${body}`;
  if (number) return `${number})`;
  return body || "";
}

function renderSubsectionBody(subsection, { includePoints = true } = {}) {
  const lines = [];
  const number = normalizeInlineWhitespace(subsection?.number);
  const body = normalizeInlineWhitespace(subsection?.body);

  if (number && body) lines.push(`(${number}) ${body}`);
  else if (number) lines.push(`(${number})`);
  else if (body) lines.push(body);

  if (includePoints) {
    for (const point of subsection?.points || []) {
      const line = renderPointLine(point);
      if (line) lines.push(line);
    }
  }

  return normalizeChunkBodyText(lines.join("\n"));
}

function footerLines(act) {
  const lines = ["Allikas: Riigi Teataja"];
  if (act?.actReference) lines.push(`Akti viide: ${act.actReference}`);
  return lines;
}

function actScopeLabel(act) {
  return normalizeInlineWhitespace(act?.scopeLabel || act?.municipality || act?.issuer || "Eesti");
}

function buildChunkText({ act, chapter, paragraph, subsection = null, point = null, subsectionIntro = "" }) {
  const lines = [];
  lines.push(`${actScopeLabel(act)} - ${act.actTitle}`);

  const chapterLine = chapterHeading(chapter);
  if (chapterLine) lines.push(chapterLine);

  const sectionLine = structuralSectionHeading(paragraph?.section);
  if (sectionLine && sectionLine !== chapterLine) lines.push(sectionLine);

  lines.push(paragraphHeading(paragraph));

  if (subsection && !point) {
    lines.push(renderSubsectionBody(subsection));
  } else if (subsection && point) {
    const subsectionNumber = normalizeInlineWhitespace(subsection.number);
    if (subsectionIntro) {
      lines.push(`(${subsectionNumber}) ${subsectionIntro}`);
      lines.push("");
    } else if (subsectionNumber) {
      lines.push(`(${subsectionNumber})`);
      lines.push("");
    }
    lines.push(renderPointLine(point));
  } else {
    const paragraphBody = (paragraph?.subsections || [])
      .map(item => renderSubsectionBody(item))
      .filter(Boolean)
      .join("\n\n");
    const directBody = normalizeInlineWhitespace(paragraph?.body);
    lines.push([directBody, paragraphBody].filter(Boolean).join("\n\n"));
  }

  lines.push("");
  lines.push(...footerLines(act));

  return normalizeChunkBodyText(lines.join("\n"));
}

function buildParagraphMetadata(act, chapter, paragraph, extra = {}) {
  return {
    source_type: "riigiteataja_regulation",
    municipality: act.municipality || null,
    municipality_name: act.municipality || null,
    issuer: act.issuer,
    act_title: act.actTitle,
    act_reference: act.actReference,
    chapter_number: chapter?.number || null,
    chapter_title: chapter?.title || null,
    structural_section_number: paragraph?.section?.number || null,
    structural_section_label: paragraph?.section?.label || null,
    structural_section_title: paragraph?.section?.title || null,
    paragraph_number: paragraph?.number || null,
    paragraph_title: paragraph?.title || null,
    source_format: "xml",
    source_file: act.sourceFile || null,
    canonical_source_id: act.canonicalSourceId,
    act_type: act.actType || null,
    effective_start: act.effectiveStart || null,
    effective_end: act.effectiveEnd || null,
    is_current_version: act.isCurrentVersion,
    text_type: act.textType || null,
    language: "et",
    country: "EE",
    jurisdiction_level: act.jurisdictionLevel || "MUNICIPALITY",
    ...extra
  };
}

function parseParagraphNode(paragraphNode, context = {}) {
  const subsections = childElements(paragraphNode, "loige").map(subsectionNode => {
    const points = childElements(subsectionNode, "alampunkt").map(pointNode => ({
      number: textContent(firstChild(pointNode, "alampunktNr")),
      body: readDirectBodyText(pointNode)
    }));

    return {
      number: textContent(firstChild(subsectionNode, "loigeNr")),
      body: readDirectBodyText(subsectionNode, ["alampunkt"]),
      points
    };
  });

  return {
    number: textContent(firstChild(paragraphNode, "paragrahvNr")),
    title: textContent(firstChild(paragraphNode, "paragrahvPealkiri")),
    body: readDirectBodyText(paragraphNode, ["loige"]),
    section: context.section || null,
    sectionTitle: context.section?.title || null,
    subsections
  };
}

function readStructuralSectionNode(node) {
  if (!node) return null;
  const title =
    textContent(firstChild(node, "jaguPealkiri"))
    || textContent(firstChild(node, "jaotisPealkiri"))
    || textContent(firstChild(node, "osaPealkiri"));
  const number =
    textContent(firstChild(node, "jaguNr"))
    || textContent(firstChild(node, "jaotisNr"))
    || textContent(firstChild(node, "osaNr"));
  const label = textContent(firstChild(node, "kuvatavNr"));
  if (!title && !number && !label) return null;
  return {
    number: number || null,
    label: label || null,
    title: title || null
  };
}

function collectParagraphs(node, context = {}) {
  const paragraphs = [];
  if (!node) return paragraphs;

  for (const child of childElements(node)) {
    if (child.name === "paragrahv") {
      paragraphs.push(parseParagraphNode(child, context));
      continue;
    }

    const section = readStructuralSectionNode(child);
    paragraphs.push(...collectParagraphs(child, {
      ...context,
      section: section || context.section || null
    }));
  }

  return paragraphs;
}

export function parseRtRegulationXml(xmlText, options = {}) {
  const tree = parseXmlTree(xmlText);
  const actNode = firstChild(tree, "oigusakt");
  if (!actNode) {
    throw new Error("RT XML root <oigusakt> is missing");
  }

  const metaNode = firstChild(actNode, "metaandmed");
  const titleNode = firstChild(firstChild(firstChild(actNode, "aktinimi"), "nimi"), "pealkiri");
  const bodyNode = firstChild(actNode, "sisu");

  if (!metaNode) throw new Error("RT XML <metaandmed> is missing");
  if (!titleNode) throw new Error("RT XML act title is missing");
  if (!bodyNode) throw new Error("RT XML <sisu> is missing");

  const issuer = textContent(firstChild(metaNode, "valjaandja"));
  const actType = textContent(firstChild(metaNode, "dokumentLiik"));
  const textType = textContent(firstChild(metaNode, "tekstiliik"));
  const globalId = textContent(firstChild(metaNode, "globaalID"));
  const currentPublication = firstChild(metaNode, "avaldamismarge");
  const initialPublication = firstChild(firstChild(metaNode, "vastuvoetud"), "avaldamismarge");
  const actReference = textContent(firstChild(currentPublication, "aktViide"))
    || textContent(firstChild(initialPublication, "aktViide"))
    || globalId;
  const effectiveNode = firstChild(metaNode, "kehtivus");
  const effectiveStart = textContent(firstChild(effectiveNode, "kehtivuseAlgus"))
    || textContent(firstChild(firstChild(metaNode, "vastuvoetud"), "joustumine"));
  const effectiveEnd = textContent(firstChild(effectiveNode, "kehtivuseLopp")) || null;
  const jurisdictionLevel = normalizeInlineWhitespace(options.jurisdictionLevel || "MUNICIPALITY").toUpperCase();
  const municipality = normalizeInlineWhitespace(
    options.municipality || (jurisdictionLevel === "NATIONAL" ? "" : municipalityFromIssuer(issuer, options.displayName || ""))
  );
  const scopeLabel = normalizeInlineWhitespace(options.scopeLabel || municipality || issuer || "Eesti");
  const actTitle = textContent(titleNode);
  const canonicalSourceId = normalizeInlineWhitespace(
    options.canonicalSourceId || (actReference ? `riigiteataja:${actReference}` : `riigiteataja:${stableShortHash(xmlText)}`)
  );
  const chapters = [];
  const ungroupedParagraphs = [];

  for (const child of childElements(bodyNode)) {
    if (child.name === "peatykk") {
      const chapter = {
        number: textContent(firstChild(child, "peatykkNr")),
        title: textContent(firstChild(child, "peatykkPealkiri")),
        paragraphs: collectParagraphs(child)
      };
      chapters.push(chapter);
      continue;
    }

    if (child.name === "paragrahv") {
      ungroupedParagraphs.push(parseParagraphNode(child));
      continue;
    }

    ungroupedParagraphs.push(...collectParagraphs(child));
  }

  if (ungroupedParagraphs.length) {
    chapters.unshift({
      number: null,
      title: null,
      paragraphs: ungroupedParagraphs
    });
  }

  return {
    municipality,
    scopeLabel,
    jurisdictionLevel,
    issuer,
    actTitle,
    actReference,
    canonicalSourceId,
    actType,
    textType,
    effectiveStart: effectiveStart || null,
    effectiveEnd,
    isCurrentVersion: isCurrentOnDate(effectiveEnd, options.now),
    sourceFormat: "xml",
    sourceFile: normalizeInlineWhitespace(options.sourceFile || ""),
    sourcePath: normalizeInlineWhitespace(options.sourcePath || ""),
    sourceUrl: normalizeInlineWhitespace(options.sourceUrl || ""),
    chapters
  };
}

function buildRtRegulationChunks(act, options = {}) {
  const paragraphMaxChars = Number(options.paragraphMaxChars || DEFAULT_PARAGRAPH_MAX_CHARS);
  const subsectionMaxChars = Number(options.subsectionMaxChars || DEFAULT_SUBSECTION_MAX_CHARS);
  const chunks = [];

  for (const chapter of act?.chapters || []) {
    for (const paragraph of chapter?.paragraphs || []) {
      const paragraphText = buildChunkText({ act, chapter, paragraph });
      const paragraphKey = `paragraph-${paragraph.number || stableShortHash(paragraphText)}`;

      if (paragraphText.length <= paragraphMaxChars || !(paragraph?.subsections || []).length) {
        chunks.push({
          key: paragraphKey,
          text: paragraphText,
          metadata: {
            ...buildParagraphMetadata(act, chapter, paragraph, {
              chunk_level: "paragraph",
              title: `${actScopeLabel(act)} - ${act.actTitle} - ${paragraphTitleForSearch(paragraph)}`.trim(),
              section: paragraphSectionTitle(paragraph, chapter) || null
            })
          }
        });
        continue;
      }

      for (const subsection of paragraph.subsections || []) {
        const subsectionText = buildChunkText({ act, chapter, paragraph, subsection });
        const subsectionKey = `${paragraphKey}-lg-${subsection.number || stableShortHash(subsectionText)}`;

        if (subsectionText.length <= subsectionMaxChars || !(subsection?.points || []).length) {
          chunks.push({
            key: subsectionKey,
            text: subsectionText,
            metadata: {
              ...buildParagraphMetadata(act, chapter, paragraph, {
                subsection_number: subsection.number || null,
                chunk_level: "subsection",
                title: `${actScopeLabel(act)} - ${act.actTitle} - ${paragraphTitleForSearch(paragraph)} lg ${subsection.number || ""}`.trim(),
                section: paragraphSectionTitle(paragraph, chapter) || null
              })
            }
          });
          continue;
        }

        const subsectionIntro = normalizeInlineWhitespace(subsection.body);
        for (const point of subsection.points || []) {
          const pointKey = `${subsectionKey}-p-${point.number || stableShortHash(renderPointLine(point))}`;
          chunks.push({
            key: pointKey,
            text: buildChunkText({
              act,
              chapter,
              paragraph,
              subsection,
              point,
              subsectionIntro
            }),
            metadata: {
              ...buildParagraphMetadata(act, chapter, paragraph, {
                subsection_number: subsection.number || null,
                point_number: point.number || null,
                chunk_level: "point",
                title: `${actScopeLabel(act)} - ${act.actTitle} - ${paragraphTitleForSearch(paragraph)} lg ${subsection.number || ""} p ${point.number || ""}`.trim(),
                section: paragraphSectionTitle(paragraph, chapter) || null
              })
            }
          });
        }
      }
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    key: stableChunkKey(chunk.key || `chunk-${index + 1}`)
  }));
}

export function buildKovRtXmlIngestPayload(entry, { xmlText, sourceFile = "", sourcePath = "", generatedMetadata = null } = {}) {
  const act = parseRtRegulationXml(xmlText, {
    municipality: entry?.municipality?.displayName || entry?.displayName || "",
    displayName: entry?.municipality?.displayName || entry?.displayName || "",
    scopeLabel: entry?.municipality?.displayName || entry?.displayName || "",
    jurisdictionLevel: "MUNICIPALITY",
    sourceFile,
    sourcePath,
    sourceUrl: entry?.riigiTeatajaUrl || ""
  });

  let chunks = buildRtRegulationChunks(act);
  if (!chunks.length) {
    const sourceUrl = entry?.riigiTeatajaUrl || act.sourceUrl || "";
    chunks = [{
      key: "metadata-only",
      text: [
        `${act.municipality} - ${act.actTitle}`,
        act.actReference ? `Riigi Teataja viide: ${act.actReference}` : "",
        sourceUrl ? `Allikas: ${sourceUrl}` : "",
        "RT XML ei sisaldanud paragrahvide tekstisisu. See chunk kinnitab akti metaandmeid, mitte paragrahvide sisu."
      ].filter(Boolean).join("\n"),
      metadata: {
        title: `${actScopeLabel(act)} - ${act.actTitle}`.trim(),
        section: "RT akti metaandmed",
        chunk_level: "metadata",
        evidence_strength: "metadata_only",
        evidence_status: "metadata_only",
        act_title: act.actTitle,
        act_reference: act.actReference || null,
        act_url: sourceUrl || null,
        legal_basis: true
      }
    }];
  }

  const docId =
    entry?.rtRagDocId
    || `kov-rt-${String(entry?.municipality?.slug || entry?.slug || "").trim().toLowerCase()}`;
  const sourceId = `kov_rt_${stableChunkKey(entry?.municipality?.slug || entry?.slug || act.canonicalSourceId).replace(/-/g, "_")}`;
  const checkedAt = dateOnly(entry?.rtCheckedAt?.toISOString?.() || new Date().toISOString());
  const sourceStatus = act.isCurrentVersion ? "active" : "inactive";

  const payload = {
    doc_id: docId,
    chunks: chunks.map(chunk => ({
      text: chunk.text,
      metadata: {
        ...chunk.metadata,
        source_id: sourceId,
        document_id: docId,
        source_type: "kov_regulation",
        legacy_source_type: "riigiteataja_regulation",
        authority: "official_legal",
        last_checked: checkedAt,
        valid_from: dateOnly(act.effectiveStart),
        valid_to: dateOnly(act.effectiveEnd),
        historical: !act.isCurrentVersion,
        source_status: sourceStatus,
        municipality_id: String(entry?.municipality?.slug || entry?.slug || "").trim().toLowerCase().replace(/-/g, "_") || null,
        canonical_chunk_id: `${act.canonicalSourceId}:${chunk.key}`,
        chunk_key: chunk.key
      }
    })),
    metadata: {
      title: act.actTitle,
      description: `${act.municipality} Riigi Teataja oigusakt`,
      source_id: sourceId,
      document_id: docId,
      source_type: "kov_regulation",
      legacy_source_type: "riigiteataja_regulation",
      authority: "official_legal",
      source_format: "xml",
      source_path: sourcePath || null,
      source_url: entry?.riigiTeatajaUrl || null,
      url_canonical: entry?.riigiTeatajaUrl || null,
      fileName: sourceFile || null,
      mimeType: "application/xml",
      collection_id: "kov_regulations",
      audience: "BOTH",
      audiences: ["CLIENT", "SOCIAL_WORKER"],
      language: "et",
      country: "EE",
      county: entry?.municipality?.county || entry?.county || null,
      jurisdiction_level: "MUNICIPALITY",
      municipality_name: act.municipality,
      municipality: act.municipality,
      municipality_id: String(entry?.municipality?.slug || entry?.slug || "").trim().toLowerCase().replace(/-/g, "_") || null,
      issuer: act.issuer,
      act_title: act.actTitle,
      act_reference: act.actReference,
      canonical_source_id: act.canonicalSourceId,
      act_type: act.actType || null,
      effective_start: act.effectiveStart || null,
      effective_end: act.effectiveEnd || null,
      valid_from: dateOnly(act.effectiveStart),
      valid_to: dateOnly(act.effectiveEnd),
      is_current_version: act.isCurrentVersion,
      text_type: act.textType || null,
      checked_at: checkedAt,
      last_checked: checkedAt,
      historical: !act.isCurrentVersion,
      source_status: sourceStatus,
      content_hash: stableShortHash(xmlText)
    }
  };

  if (!generatedMetadata || typeof generatedMetadata !== "object") return payload;

  const metadata = {
    ...payload.metadata,
    ...generatedMetadata,
    document_id: generatedMetadata.docId || payload.metadata.document_id,
    source_url: generatedMetadata.act_url || payload.metadata.source_url,
    url_canonical: generatedMetadata.act_url || payload.metadata.url_canonical,
    fileName: generatedMetadata.xml_file || payload.metadata.fileName,
    legal_basis: true
  };

  return {
    ...payload,
    doc_id: generatedMetadata.docId || payload.doc_id,
    metadata,
    chunks: payload.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        docId: generatedMetadata.docId || chunk.metadata.docId,
        document_id: generatedMetadata.docId || chunk.metadata.document_id,
        municipality_id: generatedMetadata.municipality_id || chunk.metadata.municipality_id,
        municipality_name: generatedMetadata.municipality_name || chunk.metadata.municipality_name,
        collection_id: generatedMetadata.collection_id || chunk.metadata.collection_id,
        source_type: generatedMetadata.source_type || chunk.metadata.source_type,
        source_format: generatedMetadata.source_format || chunk.metadata.source_format,
        jurisdiction_level: generatedMetadata.jurisdiction_level || chunk.metadata.jurisdiction_level,
        legal_basis: true,
        act_reference: generatedMetadata.act_reference || chunk.metadata.act_reference,
        act_title: generatedMetadata.act_title || chunk.metadata.act_title,
        act_url: generatedMetadata.act_url || chunk.metadata.act_url,
        source_status: generatedMetadata.source_status || chunk.metadata.source_status,
        historical: generatedMetadata.historical ?? chunk.metadata.historical,
        is_current_version: generatedMetadata.is_current_version ?? chunk.metadata.is_current_version
      }
    }))
  };
}

export function buildNationalRtXmlIngestPayload({ xmlText, sourceFile = "", sourcePath = "", sourceUrl = "", docId = "" } = {}) {
  const act = parseRtRegulationXml(xmlText, {
    jurisdictionLevel: "NATIONAL",
    scopeLabel: "Eesti",
    sourceFile,
    sourcePath,
    sourceUrl
  });

  const chunks = buildRtRegulationChunks(act);
  if (!chunks.length) {
    throw new Error("RT XML did not produce any ingestable chunks");
  }

  const resolvedDocId =
    String(docId || "").trim()
    || `rt-${String(act.actReference || stableShortHash(xmlText)).trim().toLowerCase()}`;
  const sourceId = `national_rt_${stableChunkKey(act.actReference || stableShortHash(xmlText)).replace(/-/g, "_")}`;
  const checkedAt = dateOnly(new Date().toISOString());
  const sourceStatus = act.isCurrentVersion ? "active" : "inactive";

  return {
    doc_id: resolvedDocId,
    chunks: chunks.map(chunk => ({
      text: chunk.text,
      metadata: {
        ...chunk.metadata,
        source_id: sourceId,
        document_id: resolvedDocId,
        source_type: "national_law",
        legacy_source_type: "riigiteataja_regulation",
        authority: "official_legal",
        last_checked: checkedAt,
        valid_from: dateOnly(act.effectiveStart),
        valid_to: dateOnly(act.effectiveEnd),
        historical: !act.isCurrentVersion,
        source_status: sourceStatus,
        canonical_chunk_id: `${act.canonicalSourceId}:${chunk.key}`,
        chunk_key: chunk.key
      }
    })),
    metadata: {
      title: act.actTitle,
      description: `Riiklik Riigi Teataja oigusakt: ${act.actTitle}`,
      source_id: sourceId,
      document_id: resolvedDocId,
      source_type: "national_law",
      legacy_source_type: "riigiteataja_regulation",
      authority: "official_legal",
      source_format: "xml",
      source_path: sourcePath || null,
      source_url: sourceUrl || (act.actReference ? `https://www.riigiteataja.ee/akt/${act.actReference}` : null),
      url_canonical: sourceUrl || (act.actReference ? `https://www.riigiteataja.ee/akt/${act.actReference}` : null),
      fileName: sourceFile || null,
      mimeType: "application/xml",
      collection_id: "national_regulations",
      audience: "BOTH",
      audiences: ["CLIENT", "SOCIAL_WORKER"],
      language: "et",
      country: "EE",
      county: null,
      jurisdiction_level: "NATIONAL",
      municipality_name: null,
      municipality: null,
      issuer: act.issuer,
      act_title: act.actTitle,
      act_reference: act.actReference,
      canonical_source_id: act.canonicalSourceId,
      act_type: act.actType || null,
      effective_start: act.effectiveStart || null,
      effective_end: act.effectiveEnd || null,
      valid_from: dateOnly(act.effectiveStart),
      valid_to: dateOnly(act.effectiveEnd),
      is_current_version: act.isCurrentVersion,
      text_type: act.textType || null,
      checked_at: checkedAt,
      last_checked: checkedAt,
      historical: !act.isCurrentVersion,
      source_status: sourceStatus,
      content_hash: stableShortHash(xmlText)
    }
  };
}

export function buildRtXmlIngestPayload({
  xmlText,
  sourceFile = "",
  sourcePath = "",
  sourceUrl = "",
  docId = "",
  municipality = "",
  municipalityId = "",
  generatedMetadata = null
} = {}) {
  const preview = parseRtRegulationXml(xmlText, {
    jurisdictionLevel: "MUNICIPALITY",
    municipality,
    sourceFile,
    sourcePath,
    sourceUrl
  });

  if (municipality || municipalityId || isMunicipalIssuer(preview.issuer)) {
    const resolvedMunicipality = municipality || preview.municipality || municipalityFromIssuer(preview.issuer, "");
    const slug = String(municipalityId || slugifyMunicipalityId(resolvedMunicipality)).trim();
    return buildKovRtXmlIngestPayload({
      slug,
      rtRagDocId: String(docId || "").trim() || `kov-rt-${slug}`,
      riigiTeatajaUrl: sourceUrl || (preview.actReference ? `https://www.riigiteataja.ee/akt/${preview.actReference}` : ""),
      municipality: {
        slug,
        displayName: resolvedMunicipality
      }
    }, {
      xmlText,
      sourceFile,
      sourcePath,
      generatedMetadata
    });
  }

  return buildNationalRtXmlIngestPayload({
    xmlText,
    sourceFile,
    sourcePath,
    sourceUrl,
    docId
  });
}
