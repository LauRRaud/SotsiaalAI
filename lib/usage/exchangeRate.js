export const ECB_RATE_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const MAX_AGE_MS = 10 * 86400000;
let cached = null;

export function parseEcbRate(xml, now = new Date()) {
  const date = xml.match(/\btime=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const amount = xml.match(/\bcurrency=['"]USD['"]\s+rate=['"](\d+(?:\.\d{1,6})?)['"]/)?.[1];
  const usdPerEurMicros = Math.round(Number(amount) * 1e6);
  const rateAt = new Date(`${date}T00:00:00Z`);
  if (!date || !Number.isSafeInteger(usdPerEurMicros) || usdPerEurMicros < 100000 || usdPerEurMicros > 10000000
    || rateAt > now || now - rateAt > MAX_AGE_MS) throw new Error('exchange_rate_unavailable');
  return { date, usdPerEurMicros, source: ECB_RATE_URL };
}

export function nanoUsdToEur(nanoUsd, rate) {
  const numerator = BigInt(nanoUsd) * 1000000n, denominator = BigInt(rate.usdPerEurMicros);
  if (numerator < 0n || denominator <= 0n) throw new Error('invalid_cost_conversion');
  return (numerator + denominator - 1n) / denominator;
}

// Fetch once per day. Persist the public rate so a brief ECB outage does not stop requests.
// A receipt always uses its reservation's rate; a late response cannot change currencies.
export async function getCostExchangeRate(db, { now = new Date(), transport = fetch } = {}) {
  const day = now.toISOString().slice(0, 10);
  if (cached?.checkedDay === day) return cached.rate;
  let rate;
  try {
    const response = await transport(ECB_RATE_URL, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) throw new Error('exchange_rate_unavailable');
    const reader = response.body.getReader(); let xml = '', length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length; if (length > 64000) throw new Error('exchange_rate_too_large');
        xml += new TextDecoder().decode(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    rate = parseEcbRate(xml, now);
    await db.aiExchangeRate.upsert({ where: { date: rate.date }, create: rate, update: {} });
  } catch {
    const stored = await db.aiExchangeRate.findFirst({ where: { date: { lte: day } }, orderBy: { date: 'desc' } });
    if (!stored || now - new Date(`${stored.date}T00:00:00Z`) > MAX_AGE_MS) {
      throw Object.assign(new Error('exchange_rate_unavailable'), { code: 'exchange_rate_unavailable', status: 503 });
    }
    rate = { date: stored.date, usdPerEurMicros: stored.usdPerEurMicros, source: stored.source };
  }
  cached = { checkedDay: day, rate };
  return rate;
}
