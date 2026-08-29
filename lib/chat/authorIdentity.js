function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function canonicalAuthorKey(value = "") {
  return normalize(value);
}

function inflectionCompatible(left = "", right = "") {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = Math.min(left.length, right.length);
  if (shorter < 3 || Math.abs(left.length - right.length) > 2) return false;
  let common = 0;
  while (common < shorter && left[common] === right[common]) common += 1;
  return common >= Math.max(3, shorter - 1);
}

export function authorNamesCompatible(left = "", right = "") {
  const requested = canonicalAuthorKey(left).split(" ").filter(Boolean);
  const candidate = canonicalAuthorKey(right).split(" ").filter(Boolean);
  if (requested.length < 2 || candidate.length < 2) return false;
  if (!inflectionCompatible(requested[0], candidate[0])) return false;
  return inflectionCompatible(requested.at(-1), candidate.at(-1));
}

export function sourceDocumentId(source = {}, fallback = "") {
  return String(
    source?.docId || source?.doc_id || source?.documentId || source?.document_id ||
    source?.canonicalItemId || source?.canonical_item_id || fallback || ""
  ).trim();
}
