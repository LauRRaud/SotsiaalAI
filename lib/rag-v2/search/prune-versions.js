// ADR-060: the search index of a document version that no generation lists any more. In the version layout (ADR-036) a
// version's unit rows, its seal and its Qdrant points are shared by every generation that lists it; when the last such
// generation is dropped they stay, unread. Removing them keeps the catalog (rag_v2_version, rag_v2_object) and the
// store: a later generation that lists the version again writes its index anew.
import { fail } from '../contracts.js';
import { VERSION_LAYOUT } from './layout.js';
import { PRUNE_LOCK } from './postgres.js';

const BUSY_SQL = `SELECT (SELECT count(*) FROM rag_v2_generation WHERE tenant=$1 AND state<>'ready')::integer
  + (SELECT count(*) FROM rag_v2_index_job WHERE tenant=$1 AND state<>'ready')::integer AS busy`;
// A version is unreferenced when no generation of the tenant, whatever its state, lists it.
const UNREFERENCED = `NOT EXISTS (SELECT 1 FROM rag_v2_generation_document d WHERE d.tenant=v.tenant AND d.version_id=v.version_id)`;

async function notBusy(query, tenant) {
  if ((await query(BUSY_SQL, [tenant])).rows[0].busy) fail('prune_index_work_pending');
}
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));
const filter = (tenant, configId, versions) => ({ must: [{ key: 'tenant', match: { value: tenant } }, { key: 'config_id', match: { value: configId } },
  { key: 'version_id', match: { any: versions } }] });
async function transaction(client, fn) {
  await client.query('BEGIN');
  try { const result = await fn(); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
}

/** Counts, and with `execute` removes, the index of every version no generation of `tenant` lists: first its seal is
 *  set back to 'staged' (an index job then no longer reuses it), then its Qdrant points are deleted and counted again,
 *  then its unit rows and seal. A run stopped part-way leaves staged seals of unlisted versions, which the next run
 *  takes up. With `execute` the run holds the tenant's prune lock (PRUNE_LOCK) from before its first check to after its
 *  last delete, on one session that runs every statement (one pool client, never waiting for a second while holding it):
 *  meanwhile beginGeneration refuses to start a generation and a second run is refused. A generation begun before the
 *  lock is not ready, so the run refuses; both transactions check that again. Counting takes no lock.
 *  The lock ends with its session, and a Qdrant delete already sent can be applied after that. So the marks are written
 *  together with the tenant's row in rag_v2_prune_run, which goes only with the last delete: while it stands,
 *  beginGeneration refuses (index_prune_unresolved), whether the run is alive or not. The next run deletes the points
 *  again and waits for it (a single Qdrant node applies a collection's updates in the order it received them, so a delete sent earlier
 *  is applied by then), removes the rows and with them the barrier. `unresolved` in the report says the row stands. */
export async function pruneUnreferencedVersions({ postgres, qdrant, tenant, execute = false, batch = 200 }) {
  if (!execute) return prune({ query: (text, values) => postgres.pool.query(text, values), qdrant, tenant, execute, batch });
  const client = await postgres.pool.connect();
  // A checked-out client has no error listener of the pool; a connection lost between statements must not end the process.
  let broken = null, locked = false;
  const lost = error => { broken = error; };
  client.on('error', lost);
  try {
    locked = (await client.query(`SELECT pg_try_advisory_lock(${PRUNE_LOCK}) AS locked`, [tenant])).rows[0].locked;
    if (!locked) fail('prune_index_work_pending');
    return await prune({ query: (text, values) => client.query(text, values), client, qdrant, tenant, execute, batch });
  } finally {
    if (locked && !broken) await client.query(`SELECT pg_advisory_unlock(${PRUNE_LOCK})`, [tenant]).catch(error => { broken = error; });
    client.off('error', lost);
    // A client whose session is gone (and with it the lock) is destroyed, not returned to the pool.
    client.release(broken || undefined);
  }
}

async function prune({ query, client, qdrant, tenant, execute, batch }) {
  await notBusy(query, tenant);
  const candidates = (await query(`SELECT v.config_id,v.version_id,v.state,
      (SELECT count(*) FROM rag_v2_version_unit u WHERE u.tenant=v.tenant AND u.config_id=v.config_id AND u.version_id=v.version_id)::integer AS units
    FROM rag_v2_version_index v WHERE v.tenant=$1 AND ${UNREFERENCED} ORDER BY v.config_id,v.version_id`, [tenant])).rows;
  // The shared collection of each config, from the generations that use it (versionCollectionName needs the mode).
  const collections = new Map((await query(`SELECT DISTINCT config->>'id' AS config_id,collection FROM rag_v2_generation
    WHERE tenant=$1 AND layout=$2`, [tenant, VERSION_LAYOUT])).rows.map(row => [row.config_id, row.collection]));
  const byConfig = new Map();
  for (const row of candidates) byConfig.set(row.config_id, [...(byConfig.get(row.config_id) || []), row]);
  const configs = [];
  for (const [configId, rows] of byConfig) {
    const collection = collections.get(configId);
    if (!collection) fail('prune_collection_unknown');
    let points = 0;
    for (const versions of chunks(rows.map(row => row.version_id), batch)) {
      points += (await qdrant.request(`/collections/${collection}/points/count`, 'POST', { exact: true, filter: filter(tenant, configId, versions) })).count;
    }
    configs.push({ config_id: configId, collection, versions: rows.length, units: rows.reduce((sum, row) => sum + row.units, 0), points,
      staged: rows.filter(row => row.state === 'staged').length });
  }
  const unresolved = (await query('SELECT 1 FROM rag_v2_prune_run WHERE tenant=$1', [tenant])).rowCount > 0;
  const report = { tenant, execute, unresolved, versions: candidates.length, units: configs.reduce((sum, c) => sum + c.units, 0),
    points: configs.reduce((sum, c) => sum + c.points, 0), configs };
  if (!execute) return report;
  if (!candidates.length) {
    // A stopped run's row with nothing left to remove: the barrier goes, under the lock and with nothing else running.
    if (unresolved) await transaction(client, async () => { await notBusy(query, tenant); await query('DELETE FROM rag_v2_prune_run WHERE tenant=$1', [tenant]); });
    return report;
  }

  // 1. The seals go back to 'staged', in one transaction that checks again that nothing else is running and writes the
  // run's row: from this commit to the commit of step 3 no generation of the tenant begins, with or without this session.
  const marked = await transaction(client, async () => {
    await notBusy(query, tenant);
    await query('INSERT INTO rag_v2_prune_run(tenant) VALUES($1) ON CONFLICT(tenant) DO NOTHING', [tenant]);
    return (await query(`UPDATE rag_v2_version_index v SET state='staged' WHERE v.tenant=$1 AND ${UNREFERENCED}
      RETURNING v.config_id,v.version_id`, [tenant])).rows;
  });
  // 2. The points of every marked version, config by config; a count after the delete must find none. Before each
  // delete a statement on the lock's session proves it still holds the lock: a lost session fails it and stops the run.
  const deleted = { points: 0, units: 0, versions: 0 };
  for (const configId of new Set(marked.map(row => row.config_id))) {
    const collection = collections.get(configId), versions = marked.filter(row => row.config_id === configId).map(row => row.version_id);
    if (!collection) fail('prune_collection_unknown');
    for (const part of chunks(versions, batch)) {
      const scope = filter(tenant, configId, part);
      const before = (await qdrant.request(`/collections/${collection}/points/count`, 'POST', { exact: true, filter: scope })).count;
      await query('SELECT 1');
      await qdrant.request(`/collections/${collection}/points/delete?wait=true`, 'POST', { filter: scope });
      if ((await qdrant.request(`/collections/${collection}/points/count`, 'POST', { exact: true, filter: scope })).count !== 0) fail('prune_points_remain');
      deleted.points += before;
    }
  }
  // 3. The unit rows and seals of versions still staged and still unlisted, and the run's row, on the same session (its
  // BEGIN is the last proof that the lock is held).
  await transaction(client, async () => {
    await notBusy(query, tenant);
    const listed = (await query(`SELECT count(*)::integer AS n FROM rag_v2_generation_document WHERE tenant=$1 AND version_id=ANY($2::text[])`,
      [tenant, marked.map(row => row.version_id)])).rows[0].n;
    if (listed) fail('prune_version_listed_meanwhile');
    await query("SET LOCAL statement_timeout='600s'");
    const pairs = [marked.map(row => row.config_id), marked.map(row => row.version_id)];
    deleted.units = (await query(`DELETE FROM rag_v2_version_unit u USING rag_v2_version_index v
      WHERE v.tenant=u.tenant AND v.config_id=u.config_id AND v.version_id=u.version_id AND v.tenant=$1 AND v.state='staged' AND ${UNREFERENCED}
        AND (v.config_id,v.version_id) IN (SELECT * FROM unnest($2::text[],$3::text[]))`, [tenant, ...pairs])).rowCount;
    deleted.versions = (await query(`DELETE FROM rag_v2_version_index v WHERE v.tenant=$1 AND v.state='staged' AND ${UNREFERENCED}
      AND (v.config_id,v.version_id) IN (SELECT * FROM unnest($2::text[],$3::text[]))`, [tenant, ...pairs])).rowCount;
    await query('DELETE FROM rag_v2_prune_run WHERE tenant=$1', [tenant]);
  });
  return { ...report, deleted };
}
