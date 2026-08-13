import pg from "pg";

const LOCK_KEY = "sotsiaalai:retention-cleanup:v1";

/**
 * A dedicated PostgreSQL session owns the advisory lock for the full sweep.
 * Competing app processes return a controlled retry instead of starting a
 * second cleanup. The lock is session-scoped deliberately: the cleanup itself
 * spans many transactions and must not hold one giant transaction open.
 */
export async function runRetentionMaintenanceWithSharedLock({
  databaseUrl = process.env.DATABASE_URL,
  run,
  retryAfterSeconds = 60
} = {}) {
  if (!String(databaseUrl || "").trim()) throw new Error("RETENTION_DATABASE_URL_REQUIRED");
  if (typeof run !== "function") throw new Error("RETENTION_RUNNER_REQUIRED");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let locked = false;
  try {
    const result = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [LOCK_KEY]
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) {
      return { ok: true, ran: false, reason: "already_running", retryAfterSeconds };
    }
    return { ok: true, ran: true, result: await run() };
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]).catch(() => null);
    }
    await client.end().catch(() => null);
  }
}
