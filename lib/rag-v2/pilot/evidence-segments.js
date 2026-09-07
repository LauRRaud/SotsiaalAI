import { hash } from '../contracts.js';

// Segment boundaries are deliberately conservative.  A line break is a boundary
// only when it separates complete-looking prose; soft PDF wraps inside a sentence
// remain in one segment.  The source string is never normalized or copied around.
const CLOSING = new Set(['"', "'", '\u2019', '\u201d', '\u00bb', ')', ']', '}', '\u3009', '\u300b']);
const NEXT_SENTENCE = /^[\p{Lu}\d\u2022\u25e6\u25aa\u25ab\-*\u2013\u2014]/u;

function boundaryAfterBlankLine(text, start) {
  const match = text.slice(start).match(/^(?:\r?\n[ \t]*){2,}/u);
  return match ? start + match[0].length : null;
}

function boundaryAfterSentenceLine(text, newlineEnd) {
  let cursor = newlineEnd;
  while (cursor < text.length && (text[cursor] === ' ' || text[cursor] === '\t')) cursor += 1;
  return NEXT_SENTENCE.test(text.slice(cursor)) ? cursor : null;
}

function sourceBoundaries(text) {
  const boundaries = new Set();
  for (let cursor = 0; cursor < text.length;) {
    const newline = text.indexOf('\n', cursor);
    if (newline < 0) break;
    const newlineEnd = newline + 1;
    const blankBoundary = boundaryAfterBlankLine(text, newline - (newline > 0 && text[newline - 1] === '\r' ? 1 : 0));
    if (blankBoundary !== null) boundaries.add(blankBoundary);
    else {
      let terminal = newline - 1;
      if (terminal >= 0 && text[terminal] === '\r') terminal -= 1;
      while (terminal >= 0 && CLOSING.has(text[terminal])) terminal -= 1;
      if (terminal >= 0 && '.!?'.includes(text[terminal])) {
        const sentenceBoundary = boundaryAfterSentenceLine(text, newlineEnd);
        if (sentenceBoundary !== null) boundaries.add(sentenceBoundary);
      }
    }
    cursor = newlineEnd;
  }
  return [...boundaries].filter(boundary => boundary > 0 && boundary < text.length).sort((a, b) => a - b);
}

export function evidenceSegments(ref, text) {
  if (typeof ref !== 'string' || !ref || typeof text !== 'string' || !text.length) return [];
  const sourceHash = hash(text), boundaries = sourceBoundaries(text), ends = [...boundaries, text.length];
  let start = 0;
  return ends.map((end, ordinal) => {
    const segment = { segmentId: `m4seg_${ref}_${sourceHash.slice(0, 12)}_${ordinal}`, ref, ordinal,
      text: text.slice(start, end), start, end, sourceTextSha256: sourceHash };
    start = end;
    return segment;
  });
}

export function segmentedEvidenceContext(context) {
  if (context === null || context === undefined) return context;
  return { ...context, evidence: context.evidence.map(item => {
    const segments = evidenceSegments(item.ref, item.text);
    const { text: _text, ...metadata } = item;
    return { ...metadata, segments: segments.map(({ segmentId, text }) => ({ segmentId, text })) };
  }) };
}
