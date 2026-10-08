import { digest } from './contracts.js';

export const RERANK_CACHE_POLICY = 'uncached-full-text-1';

// GPT-5.6+ explicit mode without breakpoints neither reads nor writes a cache.
// This opt-in policy is for workloads whose full-prompt reuse does not pay for cache writes.
// It preserves the complete request, evidence and instructions; only API cache accounting changes.
export function applyRerankCachePolicy(config, body) {
  if (config.rerankCachePolicy !== RERANK_CACHE_POLICY) return { body, measurements: null };
  return { body: { ...body, prompt_cache_options: { mode: 'explicit', ttl: '30m' } },
    measurements: { policy: RERANK_CACHE_POLICY, inputHash: digest(body.input), instructionsHash: digest(body.instructions),
      fullSourceText: true, cacheReads: false, cacheWrites: false } };
}
