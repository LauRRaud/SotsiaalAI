import { spawn } from 'node:child_process';
import path from 'node:path';
import { fail } from '../contracts.js';

export const ESTNLTK_ANALYZER_VERSION = 'estnltk-vabamorf-1.7.5-rag-v2-1';
export const ESTNLTK_LIMITS = Object.freeze({ texts: 96, textChars: 50000, batchChars: 200000 });
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const workerFile = () => path.resolve('lib/rag-v2/search/estnltk-worker.py');
const errorFor = code => Object.assign(new Error(code), { code });
const errors = new Set(['morphology_input_limit', 'morphology_version_mismatch', 'morphology_unavailable',
  'morphology_protocol_error', 'morphology_analysis_failed']);

/** One bounded local process, shared by index/query callers; no user text cache. */
export class EstnltkAnalyzer {
  constructor({ python, timeoutMs = 30000, idleMs = 60000, spawnProcess = spawn } = {}) {
    this.python = python; this.timeoutMs = timeoutMs; this.idleMs = idleMs; this.spawnProcess = spawnProcess;
    this.sequence = 0; this.pending = new Map(); this.child = null; this.idleTimer = null;
  }
  start() {
    if (this.child) return this.child;
    const python = this.python || process.env.RAG_V2_ESTNLTK_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const child = this.spawnProcess(python, ['-u', '-B', workerFile()], {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
    });
    this.child = child;
    let buffer = Buffer.alloc(0);
    child.on('error', () => this.stop('morphology_unavailable', child));
    child.on('exit', () => this.stop('morphology_unavailable', child));
    child.stdin.on('error', () => this.stop('morphology_unavailable', child));
    child.stdout.on('data', data => {
      if (this.child !== child) return;
      buffer = Buffer.concat([buffer, data]);
      if (buffer.length > MAX_RESPONSE_BYTES) return this.stop('morphology_output_limit', child);
      let end;
      while ((end = buffer.indexOf(10)) >= 0) {
        const line = buffer.subarray(0, end); buffer = buffer.subarray(end + 1);
        let message;
        try { message = JSON.parse(line.toString('utf8')); } catch { return this.stop('morphology_protocol_error', child); }
        const item = this.pending.get(message?.id);
        if (!item || message.version !== ESTNLTK_ANALYZER_VERSION) return this.stop('morphology_protocol_error', child);
        this.pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(errorFor(errors.has(message.error) ? message.error : 'morphology_analysis_failed'));
        else if (!Array.isArray(message.texts) || message.texts.length !== item.count
          || message.texts.some(text => typeof text !== 'string' || text && !/^(?:vmet[\p{L}\p{M}-]+)(?: vmet[\p{L}\p{M}-]+)*$/u.test(text))) {
          item.reject(errorFor('morphology_protocol_error')); return this.stop('morphology_protocol_error', child);
        } else item.resolve(message.texts);
      }
      if (!this.pending.size) this.idle(child);
    });
    return child;
  }
  idle(child) {
    // Pipes keep Node alive by default. Only in-flight analysis should do so.
    child.unref(); child.stdin.unref?.(); child.stdout.unref?.();
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop('morphology_closed', child), this.idleMs);
    this.idleTimer.unref();
  }
  stop(code, child = this.child) {
    if (!child || this.child !== child) return;
    this.child = null; clearTimeout(this.idleTimer);
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(errorFor(code)); }
    this.pending.clear();
    child.stdin.destroy(); child.stdout.destroy(); child.kill();
  }
  close() { this.stop('morphology_closed'); }
  async analyze(texts) {
    if (!Array.isArray(texts) || !texts.length || texts.length > ESTNLTK_LIMITS.texts
      || texts.some(text => typeof text !== 'string' || text.length > ESTNLTK_LIMITS.textChars)
      || texts.reduce((sum, text) => sum + text.length, 0) > ESTNLTK_LIMITS.batchChars) fail('morphology_input_limit');
    if (this.pending.size >= 16) fail('morphology_busy');
    const child = this.start(), id = ++this.sequence;
    clearTimeout(this.idleTimer);
    child.ref(); child.stdin.ref?.(); child.stdout.ref?.();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop('morphology_timeout', child), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, count: texts.length });
      child.stdin.write(`${JSON.stringify({ id, version: ESTNLTK_ANALYZER_VERSION, texts })}\n`, 'utf8', error => {
        if (error) this.stop('morphology_unavailable', child);
      });
    });
  }
}

const sharedKey = Symbol.for('rag-v2/estnltk-v1');
export function defaultEstnltkAnalyzer() {
  return globalThis[sharedKey] ||= new EstnltkAnalyzer();
}
