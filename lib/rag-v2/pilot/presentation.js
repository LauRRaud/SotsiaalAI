// No HTML interpretation: callers render the returned text through the existing escaped UI.
export const ANSWER_VERSION = 'm4-text-refs-4';
export const LEGACY_ANSWER_VERSION = 'm4-text-refs-1';
export const PREVIOUS_ANSWER_VERSION = 'm4-text-refs-2';
export const SOURCE_CLAIMS_ANSWER_VERSION = 'm4-text-refs-3';
export const SUPPORTED_ANSWER_VERSIONS = Object.freeze([LEGACY_ANSWER_VERSION, PREVIOUS_ANSWER_VERSION, SOURCE_CLAIMS_ANSWER_VERSION, ANSWER_VERSION]);
const MARKER = /\[S[1-9]\d*\]|\uE200cite(?:\uE202S[1-9]\d*)+\uE201/gu;
// V4 reserves standalone S-number tokens for refs, including unknown IDs. Reject
// ambiguous tokens; never delete them or guess whether they denote a real-world code.
const BARE_MARKER = /(?<![\p{L}\p{N}_])S[1-9]\d*(?![\p{L}\p{N}_])/u;
const LEGACY_SUFFIX = /(?:\s*(?:\[S[1-9]\d*\]|\uE200cite(?:\uE202S[1-9]\d*)+\uE201))+\s*$/u;
export function hasInlineReferences(text, version = LEGACY_ANSWER_VERSION) {
  return [...text.matchAll(MARKER)].length > 0 || version === ANSWER_VERSION && BARE_MARKER.test(text);
}
export function renderAnswer(answer, version = LEGACY_ANSWER_VERSION) {
  if (!SUPPORTED_ANSWER_VERSIONS.includes(version)) throw Object.assign(new Error('unsupported_answer_version'), { code: 'unsupported_answer_version' });
  const blocks = answer.blocks.map(block => {
    const refs = [...new Set(block.refs)];
    let text = block.text;
    if (version === LEGACY_ANSWER_VERSION) {
      const suffix = text.match(LEGACY_SUFFIX);
      if (suffix) {
        const markers = [...suffix[0].matchAll(MARKER)];
        const inlineRefs = markers.flatMap(m => m[0].match(/S[1-9]\d*/gu));
        // A mixed/unknown suffix stays completely intact; no guessed replacement or broad cleanup.
        if (inlineRefs.length && inlineRefs.every(ref => refs.includes(ref))) text = text.slice(0, suffix.index).trimEnd();
      }
    }
    return text + (refs.length ? ' [' + refs.join(', ') + ']' : '');
  });
  return [...blocks, ...answer.limitations, ...(answer.clarification ? [answer.clarification] : [])].join('\n\n');
}

// The forms an answer relies on, read from the turn's own record context and never from the model's text: a form
// record the answer cites, and a form that a record it cites and shows in full declares (relatedForms). Only the https
// address the source declares. The chat lists them under the answer: the assistant gives the form's link, and the
// form's text stays with the municipality (owner 30.09.2026).
const FORM_URL = /^https:\/\/[^\s"<>]+$/u;
const FILE_FORMAT = /^(?:pdf|docx?|rtf|odt|xlsx?)$/iu;
const FULL_RECORD = new Set(['selected_detail', 'relevant_detail']);
export const ANSWER_FORMS_LIMIT = 5;
export function answerForms(packet, answer) {
  const context = packet?.record_context;
  if (!context || !Array.isArray(context.entries)) return [];
  const used = new Set(answer.blocks.flatMap(block => block.refs));
  const cited = context.entries.filter(entry => Object.values(entry.fields).some(field => field.refs?.some(ref => used.has(ref))));
  const byKey = new Map(context.entries.map(entry => [entry.key, entry]));
  const declared = cited.filter(entry => entry.kind !== 'form' && FULL_RECORD.has(entry.detail))
    .flatMap(entry => (context.relations || []).filter(link => link.from === entry.key && link.relation === 'form' && link.to)
      .map(link => byKey.get(link.to)));
  const forms = [], seen = new Set();
  for (const form of [...cited.filter(entry => entry.kind === 'form'), ...declared]) {
    const url = form?.kind === 'form' ? form.fields.official_url?.value : null, title = form?.fields.title?.value;
    if (typeof url !== 'string' || url.length > 2000 || !FORM_URL.test(url) || typeof title !== 'string' || !title.trim() || seen.has(url)) continue;
    seen.add(url);
    const format = form.fields.format?.value;
    forms.push({ title: title.trim(), url, ...(typeof format === 'string' && FILE_FORMAT.test(format) ? { format: format.toLowerCase() } : {}) });
    if (forms.length === ANSWER_FORMS_LIMIT) break;
  }
  return forms;
}
