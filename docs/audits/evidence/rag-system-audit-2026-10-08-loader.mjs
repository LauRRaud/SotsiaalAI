// Read immutable Git objects without changing the checkout or creating a worktree.
// Only JS modules are loaded from the audited SHA. npm dependencies stay local.
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const revision = 'e499edfb1cb30bc4056979e2feddc74cf9f9bdb6';
const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const cache = new Map();
function blob(file) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (rel.startsWith('../') || rel.startsWith('node_modules/') || rel.startsWith('docs/audits/') || !/\.(?:js|mjs)$/.test(rel)) return null;
  if (!cache.has(rel)) {
    let source = null;
    try { source = execFileSync('git', ['show', `${revision}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 5e6 }); } catch {}
    cache.set(rel, source);
  }
  return cache.get(rel);
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [base, `${base}.js`, `${base}.mjs`]) {
        if (blob(candidate) !== null) return { shortCircuit: true, url: pathToFileURL(candidate).href };
      }
    }
    return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      const source = blob(fileURLToPath(url));
      if (source !== null) return { shortCircuit: true, format: 'module', source };
    }
    return nextLoad(url, context);
  },
});
