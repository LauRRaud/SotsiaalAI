import { fail } from '../contracts.js';

export function localPostgresUrl(value) {
  let url; try { url = new URL(value); } catch { fail('local_postgres_required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55432'
    || url.pathname !== '/rag_v2_dev' || url.username !== 'rag_v2_dev' || !url.password || url.search || url.hash) fail('local_postgres_required');
  return value;
}
export function localQdrantUrl(value) {
  if (value !== 'http://127.0.0.1:56333') fail('local_qdrant_required');
  return value;
}
