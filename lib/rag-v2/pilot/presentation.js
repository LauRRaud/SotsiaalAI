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
