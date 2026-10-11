import { buildAnonymizedDraft, detectAnonymityIssues } from '../covisionShared.js';

export const ETHICS_FIELDS = Object.freeze(['question', 'facts', 'interpretations', 'voices', 'rights', 'role', 'options', 'missing', 'review']);
export const ETHICS_TEXT_LIMIT = 2000;
export const ETHICS_SHARE_LIMIT = 2800;
export const canUseEthics = (role, admin = false) => admin || ['SOCIAL_WORKER', 'SERVICE_PROVIDER', 'ADMIN'].includes(role);
export class EthicsError extends Error {
  constructor(key, status = 400) { super(`ethics.errors.${key}`); this.status = status; }
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function normalizeEthicsContent(input) {
  if (!object(input) || Object.keys(input).some(key => !['title', 'shareDraft', ...ETHICS_FIELDS].includes(key))) throw new EthicsError('invalid');
  const result = {};
  for (const key of ['title', ...ETHICS_FIELDS, 'shareDraft']) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || !value.isWellFormed() || value.length > (key === 'title' ? 160 : key === 'shareDraft' ? ETHICS_SHARE_LIMIT : ETHICS_TEXT_LIMIT)) throw new EthicsError('invalid');
    result[key] = value.trim();
  }
  if (![result.title, ...ETHICS_FIELDS.map(key => result[key])].some(Boolean)) throw new EthicsError('empty');
  return result;
}
export function ethicsIdentifierTypes(text) {
  const types = detectAnonymityIssues(text).map(issue => issue.type);
  // The shared Estonian detector uses ASCII word boundaries. Supplement names
  // here so accented and Cyrillic names are also flagged, without changing Covision.
  if (/(?<![\p{L}\p{N}])[\p{Lu}][\p{Ll}-]{1,}[^\S\r\n]+[\p{Lu}][\p{Ll}-]{1,}(?![\p{L}\p{N}])/u.test(String(text || ''))) types.push('name');
  return [...new Set(types)];
}
export function checkedEthicsSnapshot(text, confirmed) {
  if (confirmed !== true) throw new EthicsError('confirmation');
  if (typeof text !== 'string' || !text.trim() || text.length > ETHICS_SHARE_LIMIT) throw new EthicsError('snapshot');
  if (ethicsIdentifierTypes(text).length) throw new EthicsError('identifiers');
  return text.trim();
}
// A separate, deliberately small copy. No private field is silently sent with it.
export function ethicsDraftSuggestion(content) {
  return buildAnonymizedDraft([content.question, content.facts, content.options, content.missing].filter(Boolean).join('\n\n')).slice(0, ETHICS_SHARE_LIMIT);
}
export function ethicsAssistantQuestion(snapshot, locale = 'et') {
  const task = {
    et: 'Aita mul spetsialistina seda eetilist küsimust läbi mõelda. Erista faktid oletustest, küsi puuduvaid vaatenurki ning aita sõnastada alternatiive ja puuduvaid andmeid. Ära vali minu eest tegevust, reasta valikuid ega anna eetilisuse skoori. Toeta allikapõhiseid väiteid leitud viidetega; ütle, kui alus puudub. Erista Eesti aluseid välisriigi võrdlusmaterjalist. See ei ole eksperdi otsus ega ESTA Eetikakompassi metoodika.',
    en: 'Help me reflect on this ethical question as a professional. Separate facts from assumptions, ask about missing perspectives, and help describe alternatives and missing information. Do not choose or rank actions or give an ethics score. Support source-based claims with retrieved references; say when evidence is missing. Distinguish Estonian sources from foreign comparison material. This is not an expert decision or the ESTA Ethics Compass method.',
    ru: 'Помоги мне как специалисту обдумать этический вопрос. Отдели факты от предположений, спроси о недостающих точках зрения, помоги описать варианты и недостающую информацию. Не выбирай и не ранжируй действия, не оценивай этичность баллами. Подкрепляй утверждения найденными источниками и указывай отсутствие оснований. Отличай эстонские источники от зарубежных. Это не решение эксперта и не методика ESTA.'
  };
  return `${task[locale] || task.et}\n\n${snapshot}`;
}
