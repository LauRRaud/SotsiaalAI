import fs from "node:fs/promises";
import path from "node:path";

export function decodeCloudflareEmail(encoded) {
  if (!/^[a-fA-F0-9]{4,}$/u.test(String(encoded || "")) || encoded.length % 2 !== 0) {
    throw new Error(`Invalid Cloudflare email token: ${encoded}`);
  }
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let email = "";
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }
  return email;
}

export function decodeRot13ProtectedEmail(encoded) {
  return String(encoded || "")
    .replace(/\[at\]/giu, "@")
    .replace(/[a-z]/giu, char => {
      const base = char <= "Z" ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
    });
}

export function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&#160;/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

export function htmlToText(html = "") {
  return decodeHtmlEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim());
}

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function phoneTokens(value = "") {
  const tokens = String(value)
    .match(/\d[\d\s-]{4,}\d/gu)
    ?.map(token => token.replace(/\D/gu, ""))
    .filter(token => token.length >= 6) || [];
  const variants = tokens.flatMap(token => token.startsWith("372") && token.length > 8 ? [token, token.slice(3)] : [token]);
  return [...new Set(variants)];
}

export function isProblemEmail(value) {
  if (value === null || value === undefined) return true;
  const clean = String(value).trim();
  if (!clean) return true;
  return clean === "[email protected]" || clean === "*protected email*" || clean.includes("*protected email*");
}

export function extractCloudflareEmails(html = "", { contextChars = 800 } = {}) {
  const matches = [...String(html).matchAll(/data-cfemail=["']([a-fA-F0-9]+)["']/gu)];
  return matches.map(match => {
    const encoded = match[1];
    const start = Math.max(0, match.index - contextChars);
    const end = Math.min(html.length, match.index + match[0].length + contextChars);
    return {
      encoded,
      email: decodeCloudflareEmail(encoded),
      index: match.index,
      context: htmlToText(html.slice(start, end))
    };
  });
}

export function extractPlainEmails(html = "", { contextChars = 800 } = {}) {
  const text = htmlToText(html);
  const matches = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu)];
  const seen = new Set();
  return matches
    .map(match => {
      const email = match[0].toLowerCase();
      if (seen.has(email)) return null;
      seen.add(email);
      const start = Math.max(0, match.index - contextChars);
      const end = Math.min(text.length, match.index + email.length + contextChars);
      return {
        encoded: "",
        email,
        index: match.index,
        context: text.slice(start, end)
      };
    })
    .filter(Boolean);
}

function emailCandidatesFromText(value = "") {
  return [...String(value).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu)]
    .map(match => ({ email: match[0].toLowerCase(), index: match.index }));
}

export function extractProtectedEmails(html = "", { contextChars = 800 } = {}) {
  const candidates = [];

  for (const match of String(html).matchAll(/data-enc-email=["']([^"']+)["']/giu)) {
    const email = decodeRot13ProtectedEmail(decodeHtmlEntities(match[1])).toLowerCase();
    if (!emailCandidatesFromText(email).length) continue;
    const start = Math.max(0, match.index - contextChars);
    const end = Math.min(html.length, match.index + match[0].length + contextChars);
    candidates.push({
      encoded: match[1],
      email,
      index: match.index,
      context: htmlToText(html.slice(start, end))
    });
  }

  for (const match of String(html).matchAll(/decodeURIComponent\(["']([^"']+)["']\)/giu)) {
    const decoded = decodeURIComponent(match[1]);
    for (const emailMatch of emailCandidatesFromText(decoded)) {
      const start = Math.max(0, match.index - contextChars);
      const end = Math.min(html.length, match.index + match[0].length + contextChars);
      candidates.push({
        encoded: match[1],
        email: emailMatch.email,
        index: match.index,
        context: htmlToText(html.slice(start, end))
      });
    }
  }

  for (const match of String(html).matchAll(/var\s+ml=["']([^"']+)["']\s*,\s*mi=["']([^"']+)["'][\s\S]{0,300}?decodeURIComponent\(o\)/giu)) {
    const [, ml, mi] = match;
    let decoded = "";
    for (let index = 0; index < mi.length; index += 1) decoded += ml.charAt(mi.charCodeAt(index) - 48);
    decoded = decodeURIComponent(decoded);
    for (const emailMatch of emailCandidatesFromText(decoded)) {
      const start = Math.max(0, match.index - contextChars);
      const end = Math.min(html.length, match.index + match[0].length + contextChars);
      candidates.push({
        encoded: mi,
        email: emailMatch.email,
        index: match.index,
        context: htmlToText(html.slice(start, end))
      });
    }
  }

  const seen = new Set();
  return candidates.filter(candidate => {
    const key = `${candidate.email}:${candidate.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveEmailFromHtml({ html, name = "", title = "", phone = "" }) {
  const emails = [...extractCloudflareEmails(html), ...extractProtectedEmails(html), ...extractPlainEmails(html)];
  if (!emails.length) return { email: "", confidence: "none", reasons: ["no_email_found"] };

  const normalizedName = normalizeText(name || title);
  const nameParts = normalizedName.split(" ").filter(part => part.length >= 3);
  const phones = phoneTokens(phone);

  const scored = emails.map(candidate => {
    const reasons = [];
    const context = normalizeText(candidate.context);
    const localPart = normalizeText(candidate.email.split("@")[0] || "").replace(/\s/gu, "");

    if (normalizedName && context.includes(normalizedName)) reasons.push("name_context");
    if (phones.some(token => context.replace(/\D/gu, "").includes(token))) reasons.push("phone_context");
    if (nameParts.length && nameParts.every(part => localPart.includes(part))) reasons.push("email_name_match");

    const score =
      (reasons.includes("name_context") ? 2 : 0) +
      (reasons.includes("phone_context") ? 2 : 0) +
      (reasons.includes("email_name_match") ? 1 : 0);

    return {
      ...candidate,
      reasons,
      score,
      confidence: score >= 3 ? "high" : score >= 2 ? "medium" : "low"
    };
  }).sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  if (!best || best.score < 2) {
    return { email: "", confidence: "none", reasons: ["no_safe_match"], candidates: scored };
  }
  if (second && second.score === best.score && second.email !== best.email) {
    return { email: "", confidence: "none", reasons: ["ambiguous_match"], candidates: scored };
  }

  return {
    email: best.email,
    confidence: best.confidence,
    reasons: best.reasons,
    candidates: scored
  };
}

export function parseSelection(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return null;
  const selected = new Set();
  for (const part of clean.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)-(\d+)$/u);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      for (let index = Math.min(start, end); index <= Math.max(start, end); index += 1) selected.add(index);
      continue;
    }
    if (!/^\d+$/u.test(token)) throw new Error(`Invalid --only value: ${token}`);
    selected.add(Number.parseInt(token, 10));
  }
  return selected;
}

function formatPath(parts) {
  return parts.map(part => typeof part === "number" ? `[${part}]` : (parts.indexOf(part) === 0 ? part : `.${part}`)).join("");
}

export function findProblemEmailFields(node, { slug = "", file = "" } = {}) {
  const rows = [];

  function walk(value, parts = []) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...parts, index]));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(value, "email") && isProblemEmail(value.email)) {
      rows.push({
        slug,
        file,
        path: formatPath([...parts, "email"]),
        objectPath: [...parts],
        currentEmail: value.email ?? null,
        name: value.name || value.title || "",
        title: value.title || "",
        role: value.role || "",
        phone: value.phone || "",
        officialUrl: value.officialUrl || value.official_url || ""
      });
    }

    for (const [key, child] of Object.entries(value)) walk(child, [...parts, key]);
  }

  walk(node);
  return rows;
}

export function queueItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function findQueueEmailFields(data, { file = "" } = {}) {
  return queueItems(data).flatMap((item, itemIndex) => {
    const updateField = Object.prototype.hasOwnProperty.call(item, "emailToFill") ? "emailToFill" : "email";
    if (!isProblemEmail(item[updateField])) return [];
    return [{
      slug: item.slug || "",
      file,
      path: `[${itemIndex}].${updateField}`,
      objectPath: [itemIndex],
      itemIndex,
      updateField,
      sourceFile: item.sourceFile || "",
      sourceRow: item.sourceRow || null,
      municipality: item.municipality || "",
      currentEmail: item[updateField] ?? null,
      name: item.name || item.title || "",
      title: item.title || "",
      role: item.role || "",
      phone: item.phone || "",
      officialUrl: item.officialUrl || item.official_url || ""
    }];
  });
}

export function setValueAtPath(root, objectPath, key, value) {
  let target = root;
  for (const part of objectPath) target = target?.[part];
  if (!target || typeof target !== "object") throw new Error(`Cannot update path ${objectPath.join(".")}`);
  target[key] = value;
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function ensureParentDir(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}
