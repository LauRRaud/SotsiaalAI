import { runOpenAIPrivacyFilter } from "./openaiPrivacyFilter.js";

const PERSONAL_DATA_PATTERNS = Object.freeze([
  {
    type: "email",
    label: "e-posti aadress",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu
  },
  {
    type: "phone",
    label: "telefoninumber",
    pattern: /(?:\+372\s*)?(?:\d[\s-]?){7,8}\b/gu
  },
  {
    type: "estonian_personal_code",
    label: "isikukood",
    pattern: /\b[1-6]\d{10}\b/gu
  },
  {
    type: "address",
    label: "aadress",
    pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{L}.'-]+(?:\s+[\p{Lu}ÕÄÖÜŠŽ]?[\p{L}.'-]+){0,3}\s+(?:tn|tänav|tee|mnt|maantee|pst|puiestee)\s+\d+[a-z]?(?:-\d+)?\b/giu
  }
]);

function findLocalPersonalDataSpans(value = "") {
  const source = String(value || "");
  if (!source.trim()) return [];

  const spans = [];
  for (const rule of PERSONAL_DATA_PATTERNS) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const text = String(match?.[0] || "");
      const start = Number(match?.index);
      if (!text || !Number.isFinite(start)) continue;
      spans.push({
        type: rule.type,
        label: rule.label,
        text,
        start,
        end: start + text.length,
        provider: "local_regex"
      });
    }
  }

  return spans;
}

function mergeSpans(spans = []) {
  return spans
    .filter((span) => Number.isFinite(span?.start) && Number.isFinite(span?.end) && span.end > span.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((accepted, span) => {
      const overlaps = accepted.some((item) => span.start < item.end && span.end > item.start);
      if (!overlaps) accepted.push(span);
      return accepted;
    }, []);
}

export function detectPersonalData(...values) {
  const source = values
    .map((value) => String(value || ""))
    .join("\n")
    .trim();
  if (!source) {
    return {
      hasPersonalData: false,
      categories: [],
      findings: []
    };
  }

  const spans = findPersonalDataSpans(source);
  const grouped = new Map();
  for (const span of spans) {
    const key = span.type;
    const current = grouped.get(key) || {
      type: span.type,
      label: span.label,
      count: 0,
      provider: span.provider || "local_regex"
    };
    current.count += 1;
    if (current.provider !== span.provider && span.provider === "openai_privacy_filter") {
      current.provider = span.provider;
    }
    grouped.set(key, current);
  }
  const findings = [...grouped.values()];

  return {
    hasPersonalData: findings.length > 0,
    categories: findings.map((finding) => finding.type),
    findings
  };
}

function findPersonalDataSpans(value = "") {
  const source = String(value || "");
  if (!source.trim()) return [];

  const openAIResult = runOpenAIPrivacyFilter(source);
  return mergeSpans([
    ...(Array.isArray(openAIResult?.spans) ? openAIResult.spans : []),
    ...findLocalPersonalDataSpans(source)
  ]);
}

export function redactPersonalData(value = "") {
  const source = String(value || "");
  const spans = findPersonalDataSpans(source);
  if (!spans.length) {
    return {
      redactedText: source,
      spans
    };
  }

  let cursor = 0;
  const parts = [];
  for (const span of spans) {
    parts.push(source.slice(cursor, span.start));
    parts.push(`[${span.label}]`);
    cursor = span.end;
  }
  parts.push(source.slice(cursor));

  return {
    redactedText: parts.join(""),
    spans
  };
}

export function buildPersonalDataWarning(result) {
  const findings = Array.isArray(result?.findings) ? result.findings : [];
  if (!findings.length) return "";
  const labels = findings.map((finding) => finding.label).join(", ");
  return `Tekst võib sisaldada isikuandmeid (${labels}). Enne AI-töötlust, logimist või jagamist kasuta ainult minimaalselt vajalikku infot ja varja detailid, mida töövoog ei vaja.`;
}
