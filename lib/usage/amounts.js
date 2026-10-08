export function displayUsageAmount(metric, value) {
  if (value == null || value === '') return '';
  if (metric !== 'AI_COST_NANO_EUR') return String(value);
  const amount = BigInt(value);
  return `${amount / 1000000000n}.${(amount % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '') || '00'}`;
}

export function storeUsageAmount(metric, value) {
  if (value == null || value === '') return null;
  if (metric !== 'AI_COST_NANO_EUR') return String(value);
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,9})?$/.test(normalized)) throw new TypeError('Invalid EUR amount');
  const [whole, fraction = ''] = normalized.split('.');
  return (BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, '0'))).toString();
}
