// The visible text of an answer while the model is still writing it (ADR-040). The model writes the answer as JSON in
// the order of ANSWER_SCHEMA (kind, blocks, limitations, clarification, then any dialogue_state). This reads that text
// once, character by character, and passes on only what a reader will see: each block's text, each limitation and the
// clarification, in that order and separated as renderAnswer separates them. The text is provisional: references are
// added, and the whole answer checked, only once the complete answer has been validated. Anything unexpected stops
// the provisional text; it never throws.
const VISIBLE_PATHS = new Set(['clarification', 'limitations/[]', 'blocks/[]/text']);
const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/** The text a reader sees of a complete answer before its references are added. */
export const provisionalText = answer => [...(answer.blocks || []).map(block => block.text), ...(answer.limitations || []),
  ...(answer.clarification ? [answer.clarification] : [])].join('\n\n');

export function answerTextStream(onText) {
  // Open containers: an object ({ key, expect: 'key' | 'colon' | 'value' | 'comma' }) or an array ({ array: true, expect }).
  const stack = [];
  let string = null; // the string being read: { key: boolean, visible: boolean, text: string }
  let escape = null; // null, '' after a backslash, or the hex digits of a \u escape
  let high = null; // a UTF-16 high surrogate waiting for its low half
  let sections = 0, stopped = false, rootClosed = false;
  const path = () => stack.map(frame => frame.array ? '[]' : frame.key).join('/');
  const top = () => stack.at(-1);
  const valueDone = () => { const frame = top(); if (frame) frame.expect = 'comma'; else rootClosed = true; };
  const valueStarts = () => {
    const frame = top();
    if (!frame) return !rootClosed && stack.length === 0;
    if (frame.array) return frame.expect === 'value' || frame.expect === 'first';
    return frame.expect === 'value';
  };
  function character(c, out) {
    if (string) {
      if (escape !== null) {
        if (escape === '') {
          if (c === 'u') { escape = 'u'; return true; }
          if (!(c in ESCAPES)) return false;
          escape = null;
          return add(ESCAPES[c], out);
        }
        if (!/[0-9a-fA-F]/.test(c)) return false;
        escape += c;
        if (escape.length < 5) return true;
        const code = parseInt(escape.slice(1), 16);
        escape = null;
        if (code >= 0xd800 && code <= 0xdbff) { high = String.fromCharCode(code); return true; }
        const text = (high || '') + String.fromCharCode(code);
        high = null;
        return add(text, out);
      }
      if (c === '\\') { escape = ''; return true; }
      if (c === '"') {
        const done = string;
        string = null;
        if (done.key) { top().key = done.text; top().expect = 'colon'; } else valueDone();
        return true;
      }
      if (c < ' ') return false;
      return add(c, out);
    }
    if (/\s/.test(c)) return true;
    const frame = top();
    if (c === '"') {
      if (frame && !frame.array && frame.expect === 'key') { string = { key: true, visible: false, text: '' }; return true; }
      if (!valueStarts()) return false;
      if (frame?.array) frame.expect = 'inside';
      const visible = VISIBLE_PATHS.has(path());
      if (visible && sections++) out.push('\n\n');
      string = { key: false, visible, text: '' };
      return true;
    }
    if (c === '{' || c === '[') {
      if (!valueStarts()) return false;
      if (frame?.array) frame.expect = 'inside';
      stack.push(c === '{' ? { key: null, expect: 'key' } : { array: true, expect: 'first' });
      return true;
    }
    if (c === '}' || c === ']') {
      if (!frame || Boolean(frame.array) !== (c === ']')) return false;
      if (!frame.array && !['key', 'comma'].includes(frame.expect)) return false;
      stack.pop();
      valueDone();
      return true;
    }
    if (c === ':') { if (!frame || frame.array || frame.expect !== 'colon') return false; frame.expect = 'value'; return true; }
    if (c === ',') {
      if (!frame || frame.expect !== 'comma' && !(frame.array && frame.expect === 'literal')) return false;
      frame.expect = frame.array ? 'value' : 'key';
      return true;
    }
    // A literal (number, true, false, null): its characters are skipped; the value ends at the next ',' '}' or ']'.
    if (/[-0-9a-z.+E]/.test(c)) {
      if (frame?.array) { if (!['value', 'first', 'literal'].includes(frame.expect)) return false; frame.expect = 'literal'; return true; }
      if (frame && frame.expect === 'value') { frame.expect = 'literal'; return true; }
      return Boolean(frame && frame.expect === 'literal');
    }
    return false;
  }
  function add(text, out) {
    if (string.key || !string.visible) { string.text += text; return true; }
    out.push(text);
    return true;
  }
  // A literal ends where a ',' '}' or ']' follows: treat 'literal' like 'comma' for those characters.
  function settleLiteral(c) {
    const frame = top();
    if (frame?.expect === 'literal' && [',', '}', ']'].includes(c)) frame.expect = 'comma';
  }
  return {
    push(delta) {
      if (stopped || typeof delta !== 'string' || !delta) return;
      const out = [];
      for (const c of delta) {
        if (!string && escape === null) settleLiteral(c);
        if (!character(c, out)) { stopped = true; break; }
      }
      if (out.length) { try { onText(out.join('')); } catch { /* the reader went away; the answer is still checked and saved */ } }
    },
    get stopped() { return stopped; },
  };
}
