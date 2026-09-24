#!/usr/bin/env node
// Reads an approved RAG v2 pilot plan on stdin and prints one word: "current" when its
// implementationHash matches the runtime code in the working directory, "stale" when it
// does not, "invalid" when the plan cannot be read. Never prints plan contents.
// A stale plan cannot run new answers (implementation_approval_mismatch), so a deploy
// that changes the runtime code must say so instead of stopping the pilot silently.
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let plan = null;
try { plan = JSON.parse(input); } catch { /* reported below */ }
if (!plan || typeof plan.implementationHash !== 'string') {
  console.log('invalid');
} else {
  console.log(plan.implementationHash === (await implementationManifest()).hash ? 'current' : 'stale');
}
