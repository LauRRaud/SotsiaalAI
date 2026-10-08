// USD nano-units; source: https://developers.openai.com/api/docs/models/gpt-6-luna
// A receipt is priced separately from its reservation. Missing usage is never zero cost.
export const COST_RATE_VERSION = 'openai-2026-10-08-v1';
const RATES = Object.freeze({ input: 100, cachedInput: 10, cacheWriteInput: 125, output: 500 });
const integer = value => Number.isSafeInteger(value) && value >= 0;
const unknown = reason => ({ status: 'unknown', currency: 'USD', reason, rateVersion: COST_RATE_VERSION });

export function priceProviderUsage({ stage, usage, billing, model, embeddingModel, mode }) {
  if (mode === 'test') return { status: 'test', currency: 'USD', nanoUsd: 0, rateVersion: COST_RATE_VERSION };
  if (!usage || !integer(usage.input) || !integer(usage.output)) return unknown('usage_missing');
  if (stage === 'embedding') {
    const name = billing?.model || embeddingModel;
    const rate = { 'text-embedding-3-large': 130, 'text-embedding-3-small': 20 }[name];
    if (!rate || usage.output !== 0) return unknown('embedding_rate_unknown');
    if (!integer(usage.input * rate)) return unknown('cost_overflow');
    return { status: 'priced', currency: 'USD', nanoUsd: usage.input * rate, rateVersion: COST_RATE_VERSION,
      model: name, rates: { input: rate }, components: { input: usage.input * rate }, longContext: false };
  }
  if ((billing?.model || model) !== 'gpt-6-luna') return unknown('model_rate_unknown');
  if (!['default', 'flex'].includes(billing?.serviceTier)) return unknown('service_tier_unknown');
  if (![usage.cachedInput, usage.cacheWriteInput].every(integer)) return unknown('cache_usage_missing');
  const ordinary = usage.input - usage.cachedInput - usage.cacheWriteInput;
  if (ordinary < 0 || (usage.reasoning != null && (!integer(usage.reasoning) || usage.reasoning > usage.output))) return unknown('usage_inconsistent');
  const longContext = usage.input > 272000;
  const rates = Object.fromEntries(Object.entries(RATES).map(([key, rate]) => [key,
    rate * (longContext ? key === 'output' ? 1.5 : 2 : 1) / (billing.serviceTier === 'flex' ? 2 : 1)]));
  const counts = { input: ordinary, cachedInput: usage.cachedInput, cacheWriteInput: usage.cacheWriteInput, output: usage.output };
  const components = Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count * rates[key]]));
  const nanoUsd = Math.ceil(Object.values(components).reduce((a, b) => a + b, 0));
  if (!integer(nanoUsd)) return unknown('cost_overflow');
  return { status: 'priced', currency: 'USD', nanoUsd, rateVersion: COST_RATE_VERSION,
    model: 'gpt-6-luna', serviceTier: billing.serviceTier, longContext, rates, components };
}

export function reserveProviderCost(config, stage, input, output = 0) {
  if (config.mode === 'test') return 0;
  if (stage === 'embedding') return input * Math.max(config.prices.embeddingInput,
    { 'text-embedding-3-large': 130, 'text-embedding-3-small': 20 }[config.embedding.model] || 0);
  // A byte bound can cross the long-context threshold even when the actual tokens do not.
  // Reserve the higher tariff, then settle against the provider's token counts.
  const long = config.model === 'gpt-6-luna' && input > 272000;
  return Math.ceil(input * Math.max(config.prices.answerInput, config.model === 'gpt-6-luna' ? 125 : 0) * (long ? 2 : 1)
    + output * Math.max(config.prices.answerOutput, config.model === 'gpt-6-luna' ? 500 : 0) * (long ? 1.5 : 1));
}
