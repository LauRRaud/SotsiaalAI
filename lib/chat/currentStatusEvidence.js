function normalizeCurrentStatusText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CURRENT_STATUS_CUE_RE = /(?:^|\s)(?:praeg\p{Letter}*|hetkel|hetkeseis\p{Letter}*|tana\p{Letter}*|tanapaev\p{Letter}*|kehti\p{Letter}*|ajakoh\p{Letter}*|varsk\p{Letter}*|uusi\p{Letter}*|viima\p{Letter}*|current\p{Letter}*|latest|fresh|recent\p{Letter}*|now|today|valid|сейчас|сегодня|текущ\p{Letter}*|действ\p{Letter}*|актуальн\p{Letter}*|свеж\p{Letter}*|последн\p{Letter}*)(?:$|\s)/iu;
const CURRENT_STATUS_PHRASE_RE = /(?:^|\s)(?:hetke seisuga|andmete seisuga|up to date|as of|most recent|по состоянию|на данный момент)(?:$|\s)/iu;

export function currentStatusEvidenceRequested(query = "") {
  const normalized = normalizeCurrentStatusText(query);
  return CURRENT_STATUS_CUE_RE.test(normalized) || CURRENT_STATUS_PHRASE_RE.test(normalized);
}
