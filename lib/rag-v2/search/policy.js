import { readJson } from '../catalog.js';
import { fail, id, stable } from '../contracts.js';
import { tenantId } from './snapshot.js';

export function accessContext(context) {
  tenantId(context?.tenant);
  if (context.usage !== 'development_only' || typeof context.subject !== 'string' || !context.subject.trim()) fail('trusted_local_context_required');
  return context;
}
export function grants(value, context) {
  accessContext(context);
  const grant = value?.tenants?.[context.tenant]?.[context.subject];
  if (!Array.isArray(grant) || !grant.every(x => typeof x === 'string' && x.trim())) fail('local_access_denied');
  return { documents: [...new Set(grant)].sort(), revision: id('policy', stable(grant)) };
}
export class FilePolicy {
  constructor(file) { this.file = file; }
  async allowed(context) { return grants(await readJson(this.file), context); }
}
export class LocalPolicy {
  constructor(value) { this.value = value; }
  async allowed(context) { return grants(this.value, context); }
}
