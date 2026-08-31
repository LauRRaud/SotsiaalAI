import { createHash, randomUUID } from "node:crypto";

export const SOURCE_SELECTION_VERSION = "source_selection_v1";
export const SOURCE_SELECTION_TTL_MS = 30 * 60 * 1000;
const id = value => typeof value === "string" && /^[\p{L}\p{N}_.:/+-]{1,180}$/u.test(value) && !/^sk-/iu.test(value);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalized = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const title = value => typeof value === "string" ? value.replace(/[\r\n\t]+/gu, " ").trim().slice(0, 240) : "";
const markdown = value => title(value).replace(/[\\`*_{}[\]()<>#+.!|~-]/gu, "\\$&");

function normalizeOption(value) {
  if (!value || ![value.documentId, value.sourceId, value.documentVersion].every(id) || !title(value.title)) return null;
  return { documentId: value.documentId, sourceId: value.sourceId, documentVersion: value.documentVersion,
    title: title(value.title), year: /^(?:19|20)\d{2}$|^2100$/u.test(String(value.year || "")) ? String(value.year) : null };
}

// The revision covers the ordered offer, not a client-generated ordinal. The
// owning message and conversation are checked separately by the server store.
export function normalizeSourceSelection(raw) {
  if (!raw || raw.version !== SOURCE_SELECTION_VERSION || !id(raw.offerId) || !digest(raw.operationId) ||
    !Number.isSafeInteger(raw.issuedAt) || raw.issuedAt < 0 || !Number.isSafeInteger(raw.expiresAt) ||
    raw.expiresAt - raw.issuedAt !== SOURCE_SELECTION_TTL_MS ||
    !Array.isArray(raw.options) || raw.options.length < 1 || raw.options.length > 5) return null;
  const options = raw.options.map(normalizeOption);
  if (options.some(item => !item) || new Set(options.map(item => item.documentId)).size !== options.length ||
    new Set(options.map(item => item.sourceId)).size !== options.length) return null;
  const offer = { version: SOURCE_SELECTION_VERSION, offerId: raw.offerId, operationId: raw.operationId,
    issuedAt: raw.issuedAt, expiresAt: raw.expiresAt, options };
  const revision = hash(offer);
  if (raw.revision !== revision) return null;
  return { ...offer, revision };
}

export function createSourceSelection(options, rootUserMessageId, { now = Date.now(), offerId = randomUUID() } = {}) {
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(rootUserMessageId || "")) return null;
  const normalizedOptions = (Array.isArray(options) ? options : []).map(normalizeOption);
  if (!normalizedOptions.length || normalizedOptions.some(item => !item) || normalizedOptions.length > 5) return null;
  const offer = { version: SOURCE_SELECTION_VERSION, offerId, operationId: hash(rootUserMessageId),
    issuedAt: now, expiresAt: now + SOURCE_SELECTION_TTL_MS, options: normalizedOptions };
  return normalizeSourceSelection({ ...offer, revision: hash(offer) });
}

const ordinalWords = new Map([
  ["1", 0], ["esimene", 0], ["esimest", 0], ["first", 0], ["первый", 0], ["первую", 0],
  ["2", 1], ["teine", 1], ["teist", 1], ["second", 1], ["второй", 1], ["вторую", 1],
  ["3", 2], ["kolmas", 2], ["kolmandat", 2], ["third", 2], ["третий", 2],
  ["4", 3], ["neljas", 3], ["neljandat", 3], ["fourth", 3], ["четвертый", 3],
  ["5", 4], ["viies", 4], ["viiendat", 4], ["fifth", 4], ["пятый", 4]
].map(([word, index]) => [normalized(word), index]));

export function resolveSourceSelection(message, raw, now = Date.now()) {
  const offer = normalizeSourceSelection(raw);
  if (!offer) return { status: "unavailable", selectedIds: [] };
  const text = normalized(message);
  const named = offer.options.filter(option => normalized(option.title) === text);
  let indexes = named.length === 1 ? [offer.options.indexOf(named[0])] : [];
  const short = text.replace(/^(?:(?:palun|please|пожалуйста)\s+)?(?:(?:vali|vota|kasuta|choose|use|выбери|используи)\s+)?/u, "")
    .replace(/\s+(?:artikkel|artiklit|teos|teost|article|work|статью)$/u, "");
  if (!indexes.length && /^(?:molemad|both|оба|обе)$/u.test(short)) {
    if (offer.options.length !== 2) return { status: "clarify", selectedIds: [] };
    indexes = [0, 1];
  }
  if (!indexes.length) {
    const parts = short.split(/\s+(?:ja|ning|and|и)\s+/u);
    if (parts.length <= 2 && parts.every(part => ordinalWords.has(part))) indexes = parts.map(part => ordinalWords.get(part));
    else if (named.length > 1 || /^(?:jah|yes|да|see|seda|that|это|molemad|both)$/u.test(short)) return { status: "clarify", selectedIds: [] };
    else return { status: "new_question", selectedIds: [] };
  }
  if (indexes.some(index => index >= offer.options.length) || new Set(indexes).size !== indexes.length) return { status: "clarify", selectedIds: [] };
  if (now < offer.issuedAt || now >= offer.expiresAt) return { status: "expired", selectedIds: [] };
  return { status: "selected", selectedIds: indexes.map(index => offer.options[index].documentId) };
}

export function projectSourceSelectionBinding(raw) {
  if (!raw || raw.version !== SOURCE_SELECTION_VERSION || !id(raw.issuingMessageId) ||
    ![raw.revision, raw.operationId, raw.inputHash].every(digest) ||
    !["selected", "clarify", "expired"].includes(raw.action) || !Array.isArray(raw.selectedIds) || raw.selectedIds.length > 2 ||
    raw.selectedIds.some(value => !id(value)) || new Set(raw.selectedIds).size !== raw.selectedIds.length ||
    (raw.action === "selected" ? raw.selectedIds.length < 1 : raw.selectedIds.length !== 0)) return null;
  return { version: SOURCE_SELECTION_VERSION, issuingMessageId: raw.issuingMessageId, revision: raw.revision,
    operationId: raw.operationId, inputHash: raw.inputHash, action: raw.action, selectedIds: [...raw.selectedIds] };
}

export function bindSourceSelection(message, raw, issuingMessageId, now = Date.now()) {
  const offer = normalizeSourceSelection(raw);
  const resolution = resolveSourceSelection(message, offer, now);
  return offer ? projectSourceSelectionBinding({ version: SOURCE_SELECTION_VERSION, issuingMessageId,
    revision: offer.revision, operationId: offer.operationId, inputHash: hash(String(message || "").trim()),
    action: resolution.status, selectedIds: resolution.selectedIds }) : null;
}

export function sourceSelectionBindingMatches(binding, raw, message, { allowExpired = false, now = Date.now() } = {}) {
  const normalizedBinding = projectSourceSelectionBinding(binding);
  const offer = normalizeSourceSelection(raw);
  if (!normalizedBinding || !offer) return false;
  const rebuilt = bindSourceSelection(message, offer, normalizedBinding.issuingMessageId,
    allowExpired ? (normalizedBinding.action === "expired" ? offer.expiresAt : offer.issuedAt) : now);
  return !!rebuilt && hash(rebuilt) === hash(normalizedBinding);
}

export function sourceSelectionOperationMatches(offer, rootUserMessageId) {
  return id(rootUserMessageId) && normalizeSourceSelection(offer)?.operationId === hash(rootUserMessageId);
}

export function sameSourceSelectionBinding(left, right) {
  const a = projectSourceSelectionBinding(left);
  const b = projectSourceSelectionBinding(right);
  return (!left && !right) || (!!a && !!b && hash(a) === hash(b));
}

export function renderSourceSelection(options, replyLang = "et", reason = "offer") {
  const lang = ["en", "ru"].includes(replyLang) ? replyLang : "et";
  const copy = {
    et: { offer: "Leidsin küsimusega sobivaid teoseid. Millist soovid kasutada?", refresh: "Varasem allikavalik vajab uuendamist. Palun vali praegusest loetelust uuesti.", hint: "Võid vastata järjekorranumbri või pealkirjaga.", both: "Võid vastata ka „mõlemad”.", missing: "Varasemat allikavalikut ei õnnestunud praegu kinnitada. Palun proovi uuesti või täpsusta teose pealkirja." },
    en: { offer: "I found works relevant to your question. Which would you like to use?", refresh: "The earlier source selection needs updating. Please choose again from the current list.", hint: "Reply with its number or title.", both: "You can also reply “both”.", missing: "I could not confirm the earlier source selection. Please retry or specify the work's title." },
    ru: { offer: "Найдены работы по вашему вопросу. Какую использовать?", refresh: "Предыдущий выбор источников требует обновления. Пожалуйста, выберите снова из текущего списка.", hint: "Укажите номер или название.", both: "Можно также ответить «обе».", missing: "Не удалось подтвердить предыдущий выбор источников. Повторите попытку или уточните название работы." }
  }[lang];
  if (!options?.length) return copy.missing;
  const continueLabel = { et: "Soovi korral saad sama küsimuse jaoks valida allika uuesti:",
    en: "You can choose a source again for the same question:", ru: "Для того же вопроса можно снова выбрать источник:" }[lang];
  return [reason === "continue" ? continueLabel : reason === "offer" ? copy.offer : copy.refresh, "",
    ...options.map((option, index) => `${index + 1}. ${markdown(option.title)}${option.year ? ` (${option.year})` : ""}`), "",
    copy.hint + (options.length === 2 ? " " + copy.both : "")].join("\n");
}

export function sourceSelectionRecovery(offer, rootUserMessageId) {
  const normalizedOffer = normalizeSourceSelection(offer);
  return normalizedOffer && sourceSelectionOperationMatches(normalizedOffer, rootUserMessageId) ? { version: "conversational_recovery_v1", active: true, action: "ask_clarification",
    trigger: "source_selection", reason: "source_selection_required", target: "source_selection",
    reply_source: "deterministic_source_selection", question_asked: true, model_call_count: 0,
    missing_fields: ["selected_document"], root_user_message_id: rootUserMessageId, source_selection: normalizedOffer } : null;
}

export function projectSourceSelectionTrace(raw) {
  if (!raw || raw.version !== SOURCE_SELECTION_VERSION) return null;
  const binding = projectSourceSelectionBinding(raw.binding);
  const allowed = ["offered", "selected", "clarify", "expired", "changed", "unavailable", "answered_separately"];
  return { version: SOURCE_SELECTION_VERSION, ...(allowed.includes(raw.status) ? { status: raw.status } : {}),
    ...(binding ? { binding } : {}),
    selected_document_ids: (Array.isArray(raw.selected_document_ids) ? raw.selected_document_ids : []).filter(id).slice(0, 2),
    parts: (Array.isArray(raw.parts) ? raw.parts : []).slice(0, 2).flatMap(part =>
      [part.document_id, part.source_id, part.document_version].every(id) ? [{
        document_id: part.document_id, source_id: part.source_id, document_version: part.document_version,
        ...(digest(part.reply_hash) ? { reply_hash: part.reply_hash } : {}),
        ...(digest(part.context_hash) ? { context_hash: part.context_hash } : {}),
        identity_eligible: part.identity_eligible === true,
        published: part.published === true,
        ...(["FULL", "PARTIAL", "NONE"].includes(part.semantic_outcome) ? { semantic_outcome: part.semantic_outcome } : {}),
        fact_validation_passed: typeof part.fact_validation_passed === "boolean" ? part.fact_validation_passed : null,
        ...(/^[a-z][a-z_]{0,100}$/u.test(part.fact_validation_reason || "") ? { fact_validation_reason: part.fact_validation_reason } : {}),
        displayed_source_ids: (Array.isArray(part.displayed_source_ids) ? part.displayed_source_ids : []).filter(id).slice(0, 8)
      }] : []),
    offered_document_ids: (Array.isArray(raw.offered_document_ids) ? raw.offered_document_ids : []).filter(id).slice(0, 5),
    ...(digest(raw.revision) ? { revision: raw.revision } : {}) };
}
